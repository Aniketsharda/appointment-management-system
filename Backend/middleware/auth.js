import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { tokenBlacklist } from "../controllers/authController.js";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

// ✅ Verify token middleware with blacklist
export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token, authorization denied" });
  }

  const token = authHeader.split(" ")[1];

  // 🚫 Check blacklist
  if (tokenBlacklist.includes(token)) {
    return res
      .status(401)
      .json({ message: "Token has been invalidated. Please login again." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, email, role }
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// ✅ Check admin role
export const isAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied: Admins only" });
  }
  next();
};

// ✅ Check superadmin role
export const isSuperadmin = (req, res, next) => {
  if (req.user.role !== "superadmin") {
    return res.status(403).json({ message: "Access denied: Superadmins only" });
  }
  next();
};
