import express from "express";
import { login } from "../controllers/authController.js";
import { logout } from "../controllers/authController.js";
const router = express.Router();

router.post("/login", login); // for both admin & superadmin
router.post("/logout", logout);
export default router;
