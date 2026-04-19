/**
 * Symptom Weight Registry
 *
 * Weights reflect relative clinical significance in a general symptom-matching context.
 * Keys must be lowercase with spaces (matching normalized symptom names from the dataset).
 * Default weight for any symptom not listed here is 1.0.
 *
 * Scale: 0.5 (non-specific, low discriminatory value) to 2.0 (highly specific / serious)
 */

export const SYMPTOM_WEIGHTS = {
  // High-significance / high-specificity symptoms
  "chest pain": 1.8,
  "shortness of breath": 1.7,
  "difficulty breathing": 1.7,
  "coughing blood": 1.9,
  "blood in urine": 1.8,
  "blood in stool": 1.8,
  "loss of consciousness": 2.0,
  "seizures": 1.9,
  "paralysis": 2.0,
  "sudden severe headache": 1.9,
  "high fever": 1.5,
  "fever": 1.4,
  "jaundice": 1.6,
  "severe abdominal pain": 1.7,
  "swollen lymph nodes": 1.5,
  "rapid heart rate": 1.5,
  "weight loss": 1.4,
  "night sweats": 1.3,

  // Moderate-significance symptoms
  "chills": 1.2,
  "sweating": 1.1,
  "nausea": 1.1,
  "vomiting": 1.2,
  "diarrhea": 1.1,
  "rash": 1.2,
  "joint pain": 1.1,
  "muscle pain": 1.0,
  "back pain": 1.0,
  "dizziness": 1.1,
  "fatigue": 0.9,
  "weakness": 0.9,
  "loss of appetite": 0.9,
  "abdominal pain": 1.1,
  "chest tightness": 1.4,
  "throat pain": 1.0,
  "sore throat": 1.0,
  "cough": 1.0,
  "dry cough": 1.0,
  "productive cough": 1.1,

  // Lower-significance / non-specific symptoms
  "headache": 0.8,
  "runny nose": 0.6,
  "stuffy nose": 0.6,
  "sneezing": 0.5,
  "itching": 0.7,
  "skin rash": 1.1,
  "loss of taste": 0.9,
  "loss of smell": 0.9,
  "mild fever": 0.9,
  "body ache": 0.8,
  "constipation": 0.8,
  "bloating": 0.7,
  "indigestion": 0.7,
  "anxiety": 0.7,
  "depression": 0.7,
  "insomnia": 0.7,
};

/**
 * Symptoms that should trigger an emergency advisory regardless of prediction score.
 * Keys must be lowercase with spaces.
 */
export const RED_FLAG_SYMPTOMS = new Set([
  "chest pain",
  "difficulty breathing",
  "shortness of breath",
  "loss of consciousness",
  "sudden severe headache",
  "paralysis",
  "coughing blood",
  "blood in urine",
  "blood in stool",
  "severe abdominal pain",
  "seizures",
]);
