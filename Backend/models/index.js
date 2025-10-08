// models/index.js
import { sequelize } from "../config/config.js";
import { User } from "./User.js";
import { Slot } from "./Slot.js";
import { Appointment } from "./Appointment.js";
import { Notification } from "./Notification.js";

// Sync DB
(async () => {
  try {
    // Use ALTER sync when explicitly enabled to evolve schema without data loss.
    // Set env SEQUELIZE_ALTER=true to allow adding new columns like Appointment.notes
    const alter = String(process.env.SEQUELIZE_ALTER || "false").toLowerCase() === "true";
    await sequelize.sync({ alter });
    console.log("✅ All models were synchronized successfully.");
  } catch (error) {
    // Provide detailed diagnostics to pinpoint root cause (e.g., duplicate keys, enum mismatch)
    console.error("❌ Error syncing models:");
    console.error("message:", error?.message);
    if (error?.parent) {
      console.error("parent.code:", error.parent.code);
      console.error("parent.errno:", error.parent.errno);
      console.error("parent.sqlMessage:", error.parent.sqlMessage);
      console.error("parent.sqlState:", error.parent.sqlState);
    }
    if (error?.sql) console.error("sql:", error.sql);
    if (error?.stack) console.error(error.stack);
  }
})();

export { User, Slot, Appointment, Notification };
