// server.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { sequelize } from "./config/config.js";
import bcrypt from "bcryptjs";

import "./models/index.js"; // Sync all models
import routes from "./routes/index.js";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
// Serve frontend statically
app.use(express.static("frontend"));
app.use("/api", routes);
// Health Check Route
app.get("/", (req, res) => {
  res.send("🚀 Appointment Management API is running.");
});

// --- Periodic cleanup of expired data ---
import { Appointment } from "./models/Appointment.js";
import { Slot } from "./models/Slot.js";
import { Op } from "sequelize";

async function cleanupExpired() {
  try {
    const now = new Date();
    // 1) Delete appointments whose slot has ended
    //    Find all appointment IDs with past slots
    const expiredAppointments = await Appointment.findAll({
      include: [{ model: Slot, as: "slot", where: { endTime: { [Op.lt]: now } } }],
      attributes: ["id"],
    });
    const ids = expiredAppointments.map((a) => a.id);
    if (ids.length) {
      await Appointment.destroy({ where: { id: ids } });
      console.log(`🧹 Removed ${ids.length} expired appointments`);
    }

    // 2) Delete past slots (no longer relevant to show on dashboard)
    const deletedSlots = await Slot.destroy({ where: { endTime: { [Op.lt]: now } } });
    if (deletedSlots) {
      console.log(`🧹 Removed ${deletedSlots} past slots`);
    }
  } catch (err) {
    console.error("Cleanup job failed:", err);
  }
}

// Run every 30 minutes
const CLEANUP_INTERVAL_MIN = Number(process.env.CLEANUP_INTERVAL_MIN || 30);
setInterval(cleanupExpired, CLEANUP_INTERVAL_MIN * 60 * 1000);
// Also run once at startup
cleanupExpired();

// Start the server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
