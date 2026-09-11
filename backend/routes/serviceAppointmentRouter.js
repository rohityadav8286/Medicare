// routes/serviceAppointmentRouter.js
import express from "express";
import { getAuth } from "@clerk/express";
import { requireAdminPassword } from "../middlewares/adminPasswordAuth.js";

import {
  getServiceAppointments,
  getServiceAppointmentById,
  createServiceAppointment,
  confirmServicePayment,
  updateServiceAppointment,
  cancelServiceAppointment,
  getServiceAppointmentStats,
  getServiceAppointmentsByPatient,
} from "../controllers/serviceAppointmentController.js";

const router = express.Router();

// API requests should receive JSON errors, not Clerk's sign-in redirect.
const requireApiAuth = (req, res, next) => {
  try {
    if (getAuth(req).userId) return next();
  } catch (error) {
    console.error("Service appointment API authentication error:", error?.message);
  }

  return res.status(401).json({
    success: false,
    message: "Authentication required. Please sign in again.",
  });
};

/* FIXED ROUTES FIRST */
router.get("/", getServiceAppointments);
router.get("/confirm", confirmServicePayment);
router.get("/stats/summary", getServiceAppointmentStats);

router.post("/", requireApiAuth, createServiceAppointment);

// 🔥 MUST BE BEFORE :id
router.get(
  "/me",
  requireApiAuth,
  getServiceAppointmentsByPatient
);

/* ID ROUTES LAST */
router.get("/:id", getServiceAppointmentById);
router.put("/:id", requireAdminPassword, updateServiceAppointment);
router.post("/:id/cancel", requireAdminPassword, cancelServiceAppointment);

export default router;
