# MediCare — Hospital Management System

A full-stack Hospital Management System for patients, doctors, and administrators. It supports doctor discovery, service booking, appointment management, Stripe payments, Cloudinary image uploads, Clerk authentication, and an AI Health symptom-analysis module powered by Python and scikit-learn.

## Features

### Patient Portal

- Browse doctors and view doctor details.
- Browse diagnostic and healthcare services.
- Book doctor appointments.
- Book service appointments.
- Pay online through Stripe Checkout or select cash payment.
- View appointment/payment confirmation pages.
- Use the **AI Health** page to submit symptoms and receive:
  - Recognized symptoms
  - Possible disease pattern
  - ML confidence score
  - Condition description
  - Suggested precautions
  - Health guidance quote

### Doctor Portal

- Doctor login using JWT authentication.
- View doctor appointment dashboard.
- Update appointment status.
- Reschedule appointments.
- Edit doctor profile.
- Toggle doctor availability.

### Admin Dashboard

- Clerk-based administrator sign-in.
- Extra password-protected admin session.
- Add, update, list, and delete doctors.
- Add, update, list, and delete services.
- View doctor appointment data.
- View service appointment data.
- View dashboard statistics.

### AI Health Module

- Public patient-facing AI Health page available at `/ai-health`.
- Python Flask API with Waitress server.
- Random Forest Classifier using scikit-learn.
- Natural-language symptom extraction with:
  - Synonym matching
  - Exact symptom matching
  - Fuzzy matching for spelling variations
- Symptom datasets, disease descriptions, and precaution data are included in `backend/ai_health`.

> **Medical disclaimer:** AI Health is an educational symptom-pattern tool only. It does not replace a qualified doctor, diagnosis, treatment, or emergency medical care.

---

## Architecture

```text
                              ┌──────────────────┐
                              │  Patient Portal  │
                              │ React + Vite     │
                              │ localhost:5173  │
                              └────────┬─────────┘
                                       │
                   ┌───────────────────┼────────────────────┐
                   │                   │                    │
                   ▼                   ▼                    ▼
        Node.js / Express API       Clerk Auth      AI Health Python API
          localhost:4000                              localhost:5000
                   │                                        │
          ┌────────┼─────────┐                      ┌─────────┴─────────┐
          ▼        ▼         ▼                      ▼                   ▼
       MongoDB   Stripe   Cloudinary        Flask + Waitress   Random Forest ML
                                                       │
                                             pandas / NumPy / scikit-learn

                              ┌──────────────────┐
                              │ Admin Dashboard  │
                              │ React + Vite     │
                              │ localhost:5174  │
                              └────────┬─────────┘

                              ┌──────────────────┐
                              │  Doctor Portal   │
                              │ React + JWT      │
                              └──────────────────┘
