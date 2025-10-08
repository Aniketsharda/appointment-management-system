import express from "express";
import {
  createSlot,
  updateSlot,
  deleteSlot,
  approveAppointment,
  getStats,
  getRecentAppointments,
  getChartsData,
  getAdminSlots,
  deleteAppointmentAdmin,
  updateAdminNotes,
} from "../controllers/adminController.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

router.get("/stats", authMiddleware, getStats);
router.get("/appointments", authMiddleware, getRecentAppointments); // legacy
router.get("/recent-appointments", authMiddleware, getRecentAppointments); // alias used by frontend
router.get("/charts", authMiddleware, getChartsData);
router.get("/slots", authMiddleware, getAdminSlots);

router.post("/slots", authMiddleware, createSlot);
router.put("/slots/:slotId", authMiddleware, updateSlot);
router.delete("/slots/:slotId", authMiddleware, deleteSlot);

router.put("/appointments/:appointmentId/approve", authMiddleware, approveAppointment);
router.patch("/appointments/:appointmentId/approve", authMiddleware, approveAppointment); // allow PATCH as used by frontend
router.delete("/appointments/:appointmentId", authMiddleware, deleteAppointmentAdmin);
router.patch("/appointments/:appointmentId/admin-notes", authMiddleware, updateAdminNotes);

export default router;
