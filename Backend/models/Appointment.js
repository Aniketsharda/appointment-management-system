// models/Appointment.js
import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/config.js";
import { User } from "./User.js";
import { Slot } from "./Slot.js";

export class Appointment extends Model {}

Appointment.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    adminId: { type: DataTypes.INTEGER, allowNull: false },
    slotId: { type: DataTypes.INTEGER, allowNull: false },
    // Optional notes from the user while booking
    notes: { type: DataTypes.TEXT, allowNull: true },
    adminNotes: { type: DataTypes.TEXT, allowNull: true },

    status: {
      type: DataTypes.ENUM("pending", "approved", "rejected"),
      defaultValue: "pending",
    },
  },
  { sequelize, modelName: "Appointment", tableName: "appointments" }
);

// Relations
Appointment.belongsTo(User, { foreignKey: "userId", as: "user" });
Appointment.belongsTo(User, { foreignKey: "adminId", as: "admin" });
Appointment.belongsTo(Slot, { foreignKey: "slotId", as: "slot" });

User.hasMany(Appointment, { foreignKey: "userId", as: "userAppointments" });
User.hasMany(Appointment, { foreignKey: "adminId", as: "adminAppointments" });
Slot.hasOne(Appointment, { foreignKey: "slotId", as: "appointment" });
