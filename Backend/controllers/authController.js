import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { User } from "../models/User.js";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

// ---------------- Login (Admin & Superadmin) ----------------
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ✅ Check if superadmin login
    if (email === process.env.SUPERADMIN_EMAIL) {
      if (password !== process.env.SUPERADMIN_PASSWORD) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      // 🔑 Superadmin token (only email + role needed, no id because superadmin isn’t in User table)
      const token = jwt.sign({ email, role: "superadmin" }, JWT_SECRET, {
        expiresIn: "1d",
      });

      return res.json({ token, role: "superadmin" });
    }

    // ✅ Otherwise, check admin login from DB
    const admin = await User.findOne({ where: { email } });
    if (!admin) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // 🔑 Admin token (id, email, role all included)
    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({ token, role: admin.role });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export let tokenBlacklist = [];

// ---------------- Logout with Blacklist ----------------
export const logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(400).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    tokenBlacklist.push(token); // add token to blacklist

    res.json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
