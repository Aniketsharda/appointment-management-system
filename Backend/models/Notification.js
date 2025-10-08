// models/Notification.js
import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/config.js";
import { Appointment } from "./Appointment.js";

export class Notification extends Model {}

Notification.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    appointmentId: { type: DataTypes.INTEGER, allowNull: false },
    message: { type: DataTypes.STRING, allowNull: false },
    isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  { sequelize, modelName: "Notification", tableName: "notifications" }
);

// FK relation
Notification.belongsTo(Appointment, {
  foreignKey: "appointmentId",
  as: "appointment",
});
Appointment.hasMany(Notification, {
  foreignKey: "appointmentId",
  as: "notifications",
});
