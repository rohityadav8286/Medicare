// routes/doctorRouter.js
import express from "express";
import multer from "multer";

import {
  createDoctor,
  getDoctors,
  getDoctorById,
  updateDoctor,
  updateDoctorByAdmin,
  deleteDoctor,
  toggleAvailability,
  doctorLogin,
} from "../controllers/doctorController.js";

import doctorAuth from "../middlewares/doctorAuth.js";
import { requireAdminPassword } from "../middlewares/adminPasswordAuth.js";

const upload = multer({ dest: "/tmp" });

const doctorRouter = express.Router();




doctorRouter.get("/", getDoctors);
doctorRouter.post("/login", doctorLogin);
doctorRouter.get("/:id", getDoctorById);
doctorRouter.post("/", requireAdminPassword, upload.single("image"), createDoctor);
doctorRouter.put(
  "/:id/admin",
  requireAdminPassword,
  upload.single("image"),
  updateDoctorByAdmin,
);
doctorRouter.put(
  "/:id",
  doctorAuth,
  upload.single("image"),
  updateDoctor
);
doctorRouter.post(
  "/:id/toggle-availability",
  doctorAuth,
  toggleAvailability
);
doctorRouter.delete("/:id", requireAdminPassword, deleteDoctor);

export default doctorRouter;
