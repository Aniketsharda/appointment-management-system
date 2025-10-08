import express from "express";
import {
  getAvailableSlots,
  bookAppointment,
  getAppointmentsByContact,
} from "../controllers/userController.js";

const router = express.Router();

// ✅ View all available slots
router.get("/slots", getAvailableSlots);

// ✅ Book appointment (auto-assign admin)
router.post("/bookappointments", bookAppointment);

// ✅ Get user's appointments by email or mobile
router.get("/appointments", getAppointmentsByContact);
export default router;
