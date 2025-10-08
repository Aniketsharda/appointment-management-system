// config/config.js
import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config({ path: "./.env" });

export const sequelize = new Sequelize(
  process.env.DB_NAME, // database
  process.env.DB_USERNAME, // username
  process.env.DB_PASSWORD, // password
  {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    dialect: "mysql", // must be 'mysql' not 'mysql2'
    logging: false,
  }
);

// Test DB connection
(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected successfully.");
  } catch (error) {
    console.error("❌ Unable to connect to the database:", error);
  }
})();
