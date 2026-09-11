import crypto from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";
import { adminSessionSecret, COOKIE_NAME, requireAdminPassword } from "../middlewares/adminPasswordAuth.js";
import { requireAdminIdentity } from "../middlewares/adminIdentityAuth.js";

const adminRouter = express.Router();
const EIGHT_HOURS = 8 * 60 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: EIGHT_HOURS,
  path: "/",
};

const passwordsMatch = (provided, configured) => {
  const providedHash = crypto.createHash("sha256").update(provided).digest();
  const configuredHash = crypto.createHash("sha256").update(configured).digest();
  return crypto.timingSafeEqual(providedHash, configuredHash);
};

adminRouter.post("/login", requireAdminIdentity, (req, res) => {
  const configuredPassword = process.env.ADMIN_DASHBOARD_PASSWORD;
  const secret = adminSessionSecret();
  const password = req.body?.password;

  if (!configuredPassword || configuredPassword === "change-me-before-starting" || !secret) {
    return res.status(503).json({
      success: false,
      message: "Admin password protection is not configured on the server.",
    });
  }

  if (typeof password !== "string" || !passwordsMatch(password, configuredPassword)) {
    return res.status(401).json({ success: false, message: "Incorrect admin password." });
  }

  const token = jwt.sign(
    { scope: "admin-dashboard", sub: req.adminIdentity.userId },
    secret,
    { expiresIn: "8h" },
  );
  return res.cookie(COOKIE_NAME, token, cookieOptions).json({ success: true });
});

adminRouter.get("/session", requireAdminPassword, (_req, res) => {
  return res.json({ success: true });
});

adminRouter.post("/logout", (_req, res) => {
  return res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: undefined }).json({ success: true });
});

// Clerk middleware errors otherwise reach Express's default HTML error page,
// which hides the cause from the dashboard and results in a vague message.
adminRouter.use((error, _req, res, _next) => {
  console.error("Admin authentication request failed:", error?.message || error);
  return res.status(401).json({
    success: false,
    message: "Admin sign-in token could not be verified. Sign out, sign in again through the Admin Clerk app, and retry.",
  });
});

export default adminRouter;
