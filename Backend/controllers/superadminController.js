import { User } from "../models/User.js";
import { Appointment } from "../models/Appointment.js";
import { Slot } from "../models/Slot.js";

// ---------------- ADMIN CRUD ----------------

// List all admins
export const getAdmins = async (req, res) => {
  try {
    const admins = await User.findAll({ where: { role: "admin" } });
    res.json(admins);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create new admin
export const createAdmin = async (req, res) => {
  try {
    const { name, email, password, mobile } = req.body;
    const admin = await User.create({
      name,
      email,
      password,
      mobile,
      role: "admin",
    });
    res.json(admin);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update admin
export const updateAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const [updated] = await User.update(req.body, {
      where: { id, role: "admin" },
    });
    if (!updated) return res.status(404).json({ error: "Admin not found" });
    res.json({ message: "Admin updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete admin
export const deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await User.destroy({ where: { id, role: "admin" } });
    if (!deleted) return res.status(404).json({ error: "Admin not found" });
    res.json({ message: "Admin deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ---------------- APPOINTMENT MANAGEMENT ----------------

// Get all appointments with relations
export const getAllAppointments = async (req, res) => {
  try {
    try {
      const appointments = await Appointment.findAll({
        include: [
          { model: User, as: "user", attributes: ["id", "email"] },
          { model: User, as: "admin", attributes: ["id", "name", "email"] },
          { model: Slot, as: "slot" },
        ],
      });
      return res.json(appointments);
    } catch (innerErr) {
      // If eager-loading fails (e.g., due to FK/association or schema mismatch),
      // return a minimal dataset so the dashboard can still function.
      console.error(
        "getAllAppointments include query failed:",
        innerErr?.message
      );
      if (innerErr?.parent) {
        console.error("code:", innerErr.parent.code);
        console.error("sqlMessage:", innerErr.parent.sqlMessage);
        console.error("sqlState:", innerErr.parent.sqlState);
      }
      const bare = await Appointment.findAll({
        attributes: [
          "id",
          "userId",
          "adminId",
          "slotId",
          "status",
          "updatedAt",
          "createdAt",
        ],
      });
      return res.json(bare);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Reassign (re-slot) appointment
export const reassignAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { newAdminId, newSlotId } = req.body;

    const appointment = await Appointment.findByPk(id);
    if (!appointment)
      return res.status(404).json({ error: "Appointment not found" });

    // free old slot
    await Slot.update(
      { isAvailable: true },
      { where: { id: appointment.slotId } }
    );

    // assign new slot & admin
    appointment.adminId = newAdminId;
    appointment.slotId = newSlotId;
    await appointment.save();

    // mark new slot unavailable
    await Slot.update({ isAvailable: false }, { where: { id: newSlotId } });

    res.json({ message: "Appointment reassigned", appointment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update appointment status
export const updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const [updated] = await Appointment.update({ status }, { where: { id } });
    if (!updated)
      return res.status(404).json({ error: "Appointment not found" });

    res.json({ message: "Status updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete appointment
export const deleteAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Appointment.destroy({ where: { id } });
    if (!deleted)
      return res.status(404).json({ error: "Appointment not found" });
    res.json({ message: "Appointment deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ---------------- AVAILABLE SLOTS FOR ADMIN (for reassignment) ----------------
export const getAvailableSlotsForAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { available } = req.query; // when 'true', only available slots

    const where = { adminId };
    if (available === "true") where.isAvailable = true;

    const slots = await Slot.findAll({ where, order: [["startTime", "ASC"]] });
    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
