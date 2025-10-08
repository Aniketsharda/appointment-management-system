import express from "express";
const router = express.Router(); // <-- Initialize router here

import userRoutes from "./userRoutes.js";
import adminRoutes from "./adminRoutes.js";
import authRoutes from "./authRoutes.js";
import superadminRoutes from "./superadminRoutes.js";

router.use("/users", userRoutes);
router.use("/admin", adminRoutes);
router.use("/auth", authRoutes);
router.use("/superadmin", superadminRoutes);
export default router;
