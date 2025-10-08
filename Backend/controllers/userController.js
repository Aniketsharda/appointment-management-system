// controllers/userController.js
import { sequelize } from "../config/config.js"; // ✅ make sure path is correct
import { Slot } from "../models/Slot.js";
import { Appointment } from "../models/Appointment.js";
import { User } from "../models/User.js";
import { Op } from "sequelize";
import { sendEmailFromNodeMailer } from "../utils/emailService.js";
import { constructAppointmentSlackMessageBlocks } from "../utils/slackUtil.js";
import { sendSlackNotification } from "../utils/sendNotification.js";

// ---------------- Get Available Slots ----------------
export const getAvailableSlots = async (req, res) => {
  try {
    // Fetch available slots only (no admin details exposed)
    const slots = await Slot.findAll({
      where: { isAvailable: true },
      order: [["startTime", "ASC"]],
    });

    // Group by time window (start+end) and pick a representative slot id for booking
    const map = new Map();
    for (const s of slots) {
      const key = `${new Date(s.startTime).toISOString()}|${new Date(
        s.endTime
      ).toISOString()}`;
      if (!map.has(key)) {
        map.set(key, { id: s.id, startTime: s.startTime, endTime: s.endTime });
      }
    }

    const uniqueSlots = Array.from(map.values()).sort(
      (a, b) => new Date(a.startTime) - new Date(b.startTime)
    );

    res.json(uniqueSlots);
  } catch (error) {
    console.error("Error fetching slots:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const bookAppointment = async (req, res) => {
  const { email, mobile, slotId, notes } = req.body;

  if (!email && !mobile) {
    return res
      .status(400)
      .json({ message: "Email or mobile number is required" });
  }

  try {
    // Find or create user by email or mobile
    let user;
    if (email) {
      user = await User.findOne({ where: { email } });
      if (!user) {
        user = await User.create({
          email,
          mobile,
          name: "Guest User",
          password: "defaultpassword",
          role: "user",
        });
      }
    } else if (mobile) {
      user = await User.findOne({ where: { mobile } });
      if (!user) {
        user = await User.create({
          mobile,
          name: "Guest User",
          password: "defaultpassword",
          role: "user",
        });
      }
    }

    // Find the slot requested by the user
    const slot = await Slot.findOne({
      where: { id: slotId, isAvailable: true },
    });

    if (!slot) {
      return res
        .status(404)
        .json({ message: "Slot not available or already booked" });
    }

    // Find all available slots matching the same start and end time
    const candidateSlots = await Slot.findAll({
      where: {
        startTime: slot.startTime,
        endTime: slot.endTime,
        isAvailable: true,
      },
    });

    if (candidateSlots.length === 0) {
      return res
        .status(404)
        .json({ message: "No available slots found at this time" });
    }

    // Pick a random slot among candidates
    const assignedSlot =
      candidateSlots[Math.floor(Math.random() * candidateSlots.length)];

    // Create appointment
    const appointment = await Appointment.create({
      userId: user.id,
      adminId: assignedSlot.adminId,
      slotId: assignedSlot.id,
      status: "approved",
      notes: notes || null,
    });

    // Mark the assigned slot as unavailable
    assignedSlot.isAvailable = false;
    await assignedSlot.save();

    // admin = await User.findOne({ where: { id: assignedSlot.adminId } });
    // const adminName = admin?.name || "Consultant";

    // 🔔 Send email notification to user and admin (if emails exist)
    // try {
    const admin = await User.findOne({
      where: { id: assignedSlot.adminId },
    });

    if (email || admin?.email) {
      await sendEmailNotification(
        email, // may be null if user signed up by mobile
        admin?.email,
        assignedSlot.startTime,
        "booked"
      );
    }
    //  } catch (emailError) {
    /// console.error("Failed to send email notification:", emailError);
    //  }

    res.status(201).json({
      message: "Appointment booked successfully",
      appointment,
    });

    // 🔔 Send Slack notification
    const adminName = admin?.name || "Consultant";
    console.log("🔍 Assigned slot object:", assignedSlot);
    if (process.env.SLACK_WEBHOOK_URL) {
      const appointmentDate = new Date(
        assignedSlot.startTime
      ).toLocaleDateString();
      const appointmentTime = new Date(
        assignedSlot.startTime
      ).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      // Build Slack message blocks
      const blocks = await constructAppointmentSlackMessageBlocks(
        appointmentDate,
        appointmentTime,
        admin.name
      );

      //     // Send to Slack
      const slackWebhookResponse = await sendSlackNotification(
        req,
        process.env.SLACK_WEBHOOK_URL,
        { blocks }
      );

      req?.log?.info({ slackWebhookResponse }, "Slack notification result");
    }
  } catch (error) {
    req?.log?.error({ error }, "Error sending appointment Slack notification");
  }
};

// 3. Get appointments by email or mobile
export const getAppointmentsByContact = async (req, res) => {
  const { email, mobile } = req.query;

  if (!email && !mobile) {
    return res
      .status(400)
      .json({ message: "Please provide email or mobile number" });
  }

  try {
    // find the user by contact
    const user = await User.findOne({
      where: { [Op.or]: [{ email }, { mobile }] },
    });
    if (!user) {
      return res.json([]);
    }

    const appointments = await Appointment.findAll({
      where: { userId: user.id },
      include: [
        { model: Slot, as: "slot" },
        { model: User, as: "admin", attributes: ["id", "name", "email"] },
      ],
      order: [["createdAt", "DESC"]],
    });

    const result = appointments.map((a) => ({
      id: a.id,
      slotTime: a.slot?.startTime || null,
      adminName: a.admin?.name || "Admin",
      status: a.status,
      notes: a.notes || null,
    }));

    res.json(result);
  } catch (error) {
    console.error("Error fetching appointments:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const sendEmailNotification = async (
  userEmail,
  adminEmail,
  slotTime,
  status
) => {
  try {
    const appointmentDate = new Date(slotTime).toLocaleDateString();
    const appointmentTime = new Date(slotTime).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const message = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Appointment Confirmation</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f6f9fc; padding: 20px; margin: 0;">
  <table width="100%" style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
    <tr>
      <td style="padding: 20px; text-align: center;">
        <h2 style="color: #2b6cb0;">CloudsAnalytics</h2>
        <p style="font-size: 18px; color: #333;">Your appointment is confirmed 🎉</p>
        <p style="font-size: 16px; color: #444;">
          We're happy to let you know that your appointment has been successfully booked.
        </p>
        <div style="margin: 30px 0; padding: 15px; background-color: #edf2f7; border-radius: 6px;">
          <p style="font-size: 16px; margin: 0;"><strong>Date:</strong> ${appointmentDate}</p>
          <p style="font-size: 16px; margin: 0;"><strong>Time:</strong> ${appointmentTime}</p>
        </div>
        <p style="font-size: 14px; color: #666;">
  If you have any questions or need to reschedule, feel free to contact us at
  <a href="mailto:support@cloudsanalytics.ai" style="color: #2b6cb0; text-decoration: none; font-weight: bold;">
    support@cloudsanalytics.ai
  </a>.
</p>
        <p style="font-size: 14px; color: #999; margin-top: 30px;">Thank you,<br/>CloudsAnalytics Team</p>
      </td>
    </tr>
  </table>
</body>
</html>
`;

    // Add support@cloudsanalytics.ai as a recipient here
    const recipients = [userEmail, adminEmail, "support@cloudsanalytics.ai"]
      .filter(Boolean)
      .join(",");
    await sendEmailFromNodeMailer(recipients, "Appointment Update", message);

    return { success: true, message: "Emails sent!" };
  } catch (error) {
    console.log("Email error:", error);
  }
};
