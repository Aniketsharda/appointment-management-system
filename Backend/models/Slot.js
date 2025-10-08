// models/Slot.js
import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/config.js";
import { User } from "./User.js";

export class Slot extends Model {}

Slot.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    adminId: { type: DataTypes.INTEGER, allowNull: false },
    startTime: { type: DataTypes.DATE, allowNull: false },
    endTime: { type: DataTypes.DATE, allowNull: false },
    isAvailable: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  { sequelize, modelName: "Slot", tableName: "slots", timestamps: false }
);

// FK: slot belongs to admin
Slot.belongsTo(User, { foreignKey: "adminId", as: "admin" });
User.hasMany(Slot, { foreignKey: "adminId", as: "slots" });
