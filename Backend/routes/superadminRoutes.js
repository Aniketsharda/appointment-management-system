import express from "express";
import {
  getAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  getAllAppointments,
  reassignAppointment,
  updateAppointmentStatus,
  deleteAppointment,
  getAvailableSlotsForAdmin,
} from "../controllers/superadminController.js";
import { authMiddleware, isSuperadmin } from "../middleware/auth.js";

const router = express.Router();

router.use(authMiddleware, isSuperadmin);

// Admin CRUD
router.get("/getadmins", getAdmins);
router.post("/create/admins", createAdmin);
router.put("/update/admins/:id", updateAdmin);
router.delete("/delete/admins/:id", deleteAdmin);

// Appointment management
router.get("/getappointments", getAllAppointments);
router.put("/appointments/:id/reassign", reassignAppointment);
router.put("/appointments/:id/status", updateAppointmentStatus);
router.delete("/appointments/:id", deleteAppointment);
// Admin slots for reassignment
router.get("/admins/:adminId/slots", getAvailableSlotsForAdmin);

export default router;
