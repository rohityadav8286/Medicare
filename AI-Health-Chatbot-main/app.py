from flask import Flask, render_template, request, jsonify
import random
import Health_Chat_bot as health

app = Flask(__name__)

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

        # Basic validation
        if not name:
            return jsonify({
                "error": "Please enter your name."
            }), 400

        if not symptoms_text:
            return jsonify({
                "error": "Please enter your symptoms."
            }), 400

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
            "quote": quote
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
    app.run(
        debug=True,
        host="127.0.0.1",
        port=5000
    )