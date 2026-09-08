// routes/appointmentRouter.js
import express from "express";
import { getAuth } from "@clerk/express";

import {
  getAppointments,
  getAppointmentById,
  createAppointment,
  confirmPayment,
  updateAppointment,
  cancelAppointment,
  getStats,
  getAppointmentsByPatient,
  getAppointmentsByDoctor,
  
  getRegisteredUserCount,
} from "../controllers/appointmentController.js";

const appointmentRouter = express.Router();

// `requireAuth()` redirects unauthenticated browser requests to the sign-in
// page. That behavior is suitable for page routes, but API clients need JSON.
const requireApiAuth = (req, res, next) => {
  try {
    if (getAuth(req).userId) return next();
  } catch (error) {
    console.error("Appointment API authentication error:", error?.message);
  }

  return res.status(401).json({
    success: false,
    message: "Authentication required. Please sign in again.",
  });
};

/* =========================
   PUBLIC / FIXED ROUTES
   ========================= */

// list appointments
appointmentRouter.get("/", getAppointments);

// stripe confirm
appointmentRouter.get("/confirm", confirmPayment);

// stats
appointmentRouter.get("/stats/summary", getStats);

/* =========================
   AUTHENTICATED ROUTES
   ========================= */

// create appointment
appointmentRouter.post(
  "/",
  requireApiAuth,
  createAppointment
);

// 🔥 IMPORTANT: /me MUST COME BEFORE /:id
appointmentRouter.get(
  "/me",
  requireApiAuth,
  getAppointmentsByPatient
);
// appointmentRouter.get("/:id", getAppointmentById);
appointmentRouter.get(
  "/doctor/:doctorId",
  getAppointmentsByDoctor
);

appointmentRouter.post("/:id/cancel", cancelAppointment);
appointmentRouter.get("/paitents/count",getRegisteredUserCount); 
appointmentRouter.put("/:id", updateAppointment);


export default appointmentRouter;
