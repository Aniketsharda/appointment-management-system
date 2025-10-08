import { Slot } from "../models/Slot.js";
import { Appointment } from "../models/Appointment.js";
import { User } from "../models/User.js";
import { Op } from "sequelize";
import dayjs from "dayjs";
// ----------------- Create Slot -----------------
import customParseFormat from "dayjs/plugin/customParseFormat.js";

dayjs.extend(customParseFormat);

// ----------------- Create Slot -----------------
export const createSlot = async (req, res) => {
  try {
    const { startTime, endTime } = req.body;
    const adminId = req.user.id; // from JWT

    // ✅ Parse input time - support both ISO (from datetime-local) and DD-MM-YYYY HH:mm
    let start = dayjs(startTime, "DD-MM-YYYY HH:mm", true);
    let end = dayjs(endTime, "DD-MM-YYYY HH:mm", true);
    if (!start.isValid()) start = dayjs(startTime);
    if (!end.isValid()) end = dayjs(endTime);

    if (!start.isValid() || !end.isValid()) {
      return res
        .status(400)
        .json({ message: "Invalid date format. Use DD-MM-YYYY HH:mm" });
    }
    if (start.isBefore(dayjs())) {
      return res
        .status(400)
        .json({ message: "Cannot create a slot in the past" });
    }

    // ✅ Check slot duration = 30 min
    const diffMs = end.diff(start);
    if (diffMs !== 30 * 60 * 1000) {
      return res
        .status(400)
        .json({ message: "Slot must be exactly 30 minutes" });
    }
    // ✅ Prevent exact same slot (same startTime and endTime) for same admin
    const existingSameSlot = await Slot.findOne({
      where: {
        adminId,
        startTime: start.toDate(),
        endTime: end.toDate(),
      },
    });

    if (existingSameSlot) {
      return res.status(400).json({
        message:
          "A slot with the same date and time already exists for this admin",
      });
    }

    // ✅ Slot date (YYYY-MM-DD for daily limit)
    const slotDate = start.format("YYYY-MM-DD");

    // Count admin's slots for the day
    const slotCount = await Slot.count({
      where: {
        adminId,
        startTime: {
          [Op.gte]: `${slotDate} 00:00:00`,
          [Op.lte]: `${slotDate} 23:59:59`,
        },
      },
    });

    // ✅ Check for overlapping slots
    const overlappingSlot = await Slot.findOne({
      where: {
        adminId,
        [Op.or]: [
          {
            startTime: { [Op.lt]: end.toDate() },
            endTime: { [Op.gt]: start.toDate() },
          },
        ],
      },
    });

    if (overlappingSlot) {
      return res
        .status(400)
        .json({ message: "Slot overlaps with an existing slot" });
    }

    // ✅ Create slot
    const slot = await Slot.create({
      adminId,
      startTime: start.toDate(),
      endTime: end.toDate(),
      isAvailable: true,
    });

    res.status(201).json({ message: "Slot created successfully", slot });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating slot", error: error.message });
  }
};

// ----------------- Delete Appointment (Admin) -----------------
export const deleteAppointmentAdmin = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const adminId = req.user.id;

    const appointment = await Appointment.findOne({
      where: { id: appointmentId, adminId },
    });
    if (!appointment)
      return res.status(404).json({ message: "Appointment not found" });

    // free the slot if any
    await Slot.update(
      { isAvailable: true },
      { where: { id: appointment.slotId } }
    );

    await appointment.destroy();
    res.json({ message: "Appointment deleted" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting appointment", error: error.message });
  }
};
// ----------------- Update Slot -----------------
export const updateSlot = async (req, res) => {
  try {
    const { slotId } = req.params;
    const { startTime, endTime } = req.body;
    const adminId = req.user.id;

    const slot = await Slot.findOne({ where: { id: slotId, adminId } });
    if (!slot) return res.status(404).json({ message: "Slot not found" });

    if (!slot.isAvailable) {
      return res.status(400).json({ message: "Cannot update booked slot" });
    }

    // Parse and validate 30-minute duration (support ISO or DD-MM-YYYY HH:mm)
    let start = dayjs(startTime, "DD-MM-YYYY HH:mm", true);
    let end = dayjs(endTime, "DD-MM-YYYY HH:mm", true);
    if (!start.isValid()) start = dayjs(startTime);
    if (!end.isValid()) end = dayjs(endTime);
    if (!start.isValid() || !end.isValid()) {
      return res
        .status(400)
        .json({ message: "Invalid date format. Use DD-MM-YYYY HH:mm" });
    }
    const diffMs = end.diff(start);
    if (diffMs !== 30 * 60 * 1000) {
      return res
        .status(400)
        .json({ message: "Slot must be exactly 30 minutes" });
    }

    // Prevent overlap with other slots of the same admin
    const overlapping = await Slot.findOne({
      where: {
        adminId,
        id: { [Op.ne]: slotId },
        startTime: { [Op.lt]: end.toDate() },
        endTime: { [Op.gt]: start.toDate() },
      },
    });
    if (overlapping) {
      return res
        .status(400)
        .json({ message: "Slot overlaps with another existing slot" });
    }

    slot.startTime = start.toDate();
    slot.endTime = end.toDate();
    await slot.save();

    res.json({ message: "Slot updated successfully", slot });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating slot", error: error.message });
  }
};

// ----------------- List Slots (with optional date filter) -----------------
export const getAdminSlots = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { date } = req.query; // YYYY-MM-DD

    const where = { adminId };
    if (date) {
      const dayStart = new Date(`${date}T00:00:00`);
      const dayEnd = new Date(`${date}T23:59:59`);
      where.startTime = { [Op.between]: [dayStart, dayEnd] };
    }

    // Do not show past slots on the dashboard
    where.endTime = { [Op.gte]: new Date() };

    const slots = await Slot.findAll({
      where,
      include: [{ model: Appointment, as: "appointment", required: false }],
      order: [["startTime", "ASC"]],
    });

    // Reconcile: if a slot is marked booked but has no appointment, free it
    for (const s of slots) {
      if (s.isAvailable === false && !s.appointment) {
        s.isAvailable = true;
        await s.save();
      }
    }

    // Return without the heavy association object (strip appointment for payload)
    const response = slots.map((s) => ({
      id: s.id,
      adminId: s.adminId,
      startTime: s.startTime,
      endTime: s.endTime,
      isAvailable: s.isAvailable,
    }));

    res.json(response);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching slots", error: error.message });
  }
};

// ----------------- Delete Slot -----------------
export const deleteSlot = async (req, res) => {
  try {
    const { slotId } = req.params;
    const adminId = req.user.id;

    const slot = await Slot.findOne({ where: { id: slotId, adminId } });
    if (!slot) return res.status(404).json({ message: "Slot not found" });

    if (!slot.isAvailable) {
      return res.status(400).json({ message: "Cannot delete booked slot" });
    }

    await slot.destroy();
    res.json({ message: "Slot deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting slot", error: error.message });
  }
};

// ----------------- Auto Approve Appointment -----------------
export const approveAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await Appointment.findByPk(appointmentId, {
      include: [{ model: Slot }, { model: User, as: "user" }],
    });

    if (!appointment)
      return res.status(404).json({ message: "Appointment not found" });

    appointment.status = "approved"; // auto-approve
    await appointment.save();

    res.json({ message: "Appointment approved", appointment });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error approving appointment", error: error.message });
  }
};

// ----------------- Update Admin Notes -----------------
export const updateAdminNotes = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { adminNotes } = req.body;
    const adminId = req.user.id;

    const appointment = await Appointment.findOne({
      where: { id: appointmentId, adminId },
    });
    if (!appointment)
      return res.status(404).json({ message: "Appointment not found" });

    appointment.adminNotes = adminNotes?.toString().trim() || null;
    await appointment.save();

    res.json({ message: "Admin notes updated", appointment });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating admin notes", error: error.message });
  }
};

// ----------------- Dashboard Stats -----------------
export const getStats = async (req, res) => {
  try {
    const adminId = req.user.id;

    const now = new Date();

    // Only consider future slots/appointments
    const totalSlots = await Slot.count({
      where: { adminId, endTime: { [Op.gte]: now } },
    });
    const bookedAppointments = await Appointment.count({
      include: [
        {
          model: Slot,
          as: "slot",
          where: { adminId, endTime: { [Op.gte]: now } },
        },
      ],
      where: { status: "approved" },
    });
    const availableSlots = await Slot.count({
      where: { adminId, isAvailable: true, endTime: { [Op.gte]: now } },
    });
    const pendingAppointments = await Appointment.count({
      include: [
        {
          model: Slot,
          as: "slot",
          where: { adminId, endTime: { [Op.gte]: now } },
        },
      ],
      where: { status: "pending" },
    });

    res.json({
      totalSlots,
      bookedAppointments,
      availableSlots,
      pendingAppointments,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching stats", error: error.message });
  }
};

// ----------------- Recent Appointments -----------------
export const getRecentAppointments = async (req, res) => {
  try {
    const adminId = req.user.id;
    const limit = parseInt(req.query.limit) || 5;

    const appointments = await Appointment.findAll({
      include: [
        { model: User, as: "user", attributes: ["id", "name", "email"] },
        // Only include upcoming appointments (slot endTime in the future)
        {
          model: Slot,
          as: "slot",
          where: { adminId, endTime: { [Op.gte]: new Date() } },
        },
      ],
      order: [["createdAt", "DESC"]],
      limit,
    });

    res.json(appointments);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching appointments", error: error.message });
  }
};

// ----------------- Charts Data -----------------
export const getChartsData = async (req, res) => {
  try {
    const adminId = req.user.id;

    // Weekly appointments (last 7 days)
    const labels = [];
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const dayStart = new Date(day.setHours(0, 0, 0, 0));
      const dayEnd = new Date(day.setHours(23, 59, 59, 999));

      const count = await Appointment.count({
        include: [{ model: Slot, as: "slot", where: { adminId } }],
        where: { createdAt: { [Op.between]: [dayStart, dayEnd] } },
      });

      labels.push(day.toLocaleDateString("en-US", { weekday: "short" }));
      data.push(count);
    }

    // Slot status
    const bookedCount = await Slot.count({
      where: { adminId, isAvailable: false },
    });
    const availableCount = await Slot.count({
      where: { adminId, isAvailable: true },
    });
    const pendingCount = await Appointment.count({
      include: [{ model: Slot, as: "slot", where: { adminId } }],
      where: { status: "pending" },
    });

    res.json({
      weeklyAppointments: { labels, data },
      slotStatus: {
        labels: ["Booked", "Available", "Pending"],
        data: [bookedCount, availableCount, pendingCount],
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching charts data", error: error.message });
  }
};
