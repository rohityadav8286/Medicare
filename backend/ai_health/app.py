from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from waitress import serve
import random
import os
import Health_Chat_bot as health

load_dotenv()
app = Flask(__name__)

@app.after_request
def allow_frontend_requests(response):
    # The patient React app runs on Vite while this ML service runs separately.
    response.headers["Access-Control-Allow-Origin"] = "http://localhost:5173"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    return response

# --------------------------------------------------
# Load dictionaries from the existing ML project
# --------------------------------------------------

health.getSeverityDict()
health.getDescription()
health.getprecautionDict()

severityDictionary = health.severityDictionary
description_list = health.description_list
precautionDictionary = health.precautionDictionary

# Get all symptoms
all_symptoms = list(health.symptoms_dict.keys())


# --------------------------------------------------
# Home Page
# --------------------------------------------------

@app.route("/")
def home():
    return render_template("index.html")


# --------------------------------------------------
# Prediction API
# --------------------------------------------------

@app.route("/predict", methods=["POST"])
def predict():

    try:
        data = request.get_json()

        # Get form data
        name = data.get("name", "").strip()
        symptoms_text = data.get("symptoms", "").strip()
        age = data.get("age")
        gender = data.get("gender", "").strip()
        num_days = data.get("num_days")
        severity = data.get("severity", 5)

        # Basic validation
        if not name:
            return jsonify({
                "error": "Please enter your name."
            }), 400

        if not symptoms_text:
            return jsonify({
                "error": "Please enter your symptoms."
            }), 400

        if not isinstance(age, int) and not (isinstance(age, str) and age.isdigit()):
            return jsonify({"error": "Please enter a valid age."}), 400
        if not 1 <= int(age) <= 120:
            return jsonify({"error": "Please enter a valid age."}), 400
        if gender not in ["M", "F", "Other"]:
            return jsonify({"error": "Please select your gender."}), 400
        if not isinstance(num_days, int) and not (isinstance(num_days, str) and num_days.isdigit()):
            return jsonify({"error": "Please enter how many days you have had the symptoms."}), 400
        if not 1 <= int(num_days) <= 365:
            return jsonify({"error": "Please enter a valid symptom duration."}), 400
        try:
            severity = int(severity)
            if not 1 <= severity <= 10:
                raise ValueError
        except (TypeError, ValueError):
            return jsonify({"error": "Please choose a severity between 1 and 10."}), 400

        # --------------------------------------------------
        # Extract symptoms using EXISTING ML logic
        # --------------------------------------------------

        symptoms = health.extract_symptoms(
            symptoms_text,
            all_symptoms
        )

        # No symptoms detected
        if not symptoms:
            return jsonify({
                "error": "No recognized symptoms found. Please describe your symptoms more clearly."
            }), 400

        # --------------------------------------------------
        # Predict disease using EXISTING ML model
        # --------------------------------------------------

        disease, confidence, pred_proba = health.predict_disease(
            symptoms
        )

        # --------------------------------------------------
        # Get disease description
        # --------------------------------------------------

        description = description_list.get(
            disease,
            "No description available."
        )

        # --------------------------------------------------
        # Get precautions
        # --------------------------------------------------

        precautions = precautionDictionary.get(
            disease,
            []
        )

        # Remove empty precautions
        precautions = [
            p for p in precautions
            if p and p.strip()
        ]

        # --------------------------------------------------
        # Random health quote
        # --------------------------------------------------

        quote = random.choice(health.quotes)

        # --------------------------------------------------
        # Send result to frontend
        # --------------------------------------------------

        return jsonify({
            "success": True,
            "name": name,
            "disease": disease,
            "confidence": confidence,
            "symptoms": symptoms,
            "description": description,
            "precautions": precautions,
            "quote": quote,
            "patient_context": {
                "age": int(age), "gender": gender, "symptom_days": int(num_days),
                "severity": severity, "pre_exist": data.get("pre_exist", "").strip(),
                "lifestyle": data.get("lifestyle", "").strip(), "family": data.get("family", "").strip()
            }
        })

    except Exception as e:

        print("ERROR:", str(e))

        return jsonify({
            "error": "An error occurred while processing your request.",
            "details": str(e)
        }), 500


# --------------------------------------------------
# Run Flask
# --------------------------------------------------

if __name__ == "__main__":
    host = os.getenv("AI_HEALTH_HOST", "127.0.0.1")
    port = int(os.getenv("AI_HEALTH_PORT", "5000"))
    print(f"AI Health ML server is running at http://{host}:{port}", flush=True)
    print("Press CTRL+C to stop the AI Health server.", flush=True)
    serve(
        app,
        host=host,
        port=port,
    )
