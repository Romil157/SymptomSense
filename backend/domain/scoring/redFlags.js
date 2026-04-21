import { toDisplayLabel } from '../../utils/sanitizers.js';

export const RED_FLAG_RULES = Object.freeze({
  'chest pain': {
    severity: 'critical',
    reason: 'Chest pain can indicate a cardiac, vascular, or pulmonary emergency.',
    recommendedAction: 'Seek urgent in-person assessment or emergency evaluation immediately.',
  },
  'shortness of breath': {
    severity: 'critical',
    reason: 'Shortness of breath can indicate serious cardiopulmonary compromise.',
    recommendedAction: 'Seek urgent in-person assessment or emergency evaluation immediately.',
  },
  'difficulty breathing': {
    severity: 'critical',
    reason: 'Difficulty breathing may indicate airway obstruction or respiratory failure.',
    recommendedAction: 'Seek urgent in-person assessment or emergency evaluation immediately.',
  },
  'loss of consciousness': {
    severity: 'critical',
    reason: 'Loss of consciousness may indicate a neurological, cardiac, or metabolic emergency.',
    recommendedAction: 'Seek urgent in-person assessment or emergency evaluation immediately.',
  },
  'sudden severe headache': {
    severity: 'critical',
    reason: 'A sudden severe headache can be associated with stroke or intracranial bleeding.',
    recommendedAction: 'Seek urgent in-person assessment or emergency evaluation immediately.',
  },
  paralysis: {
    severity: 'critical',
    reason: 'Paralysis may represent a stroke or spinal emergency.',
    recommendedAction: 'Seek urgent in-person assessment or emergency evaluation immediately.',
  },
  seizures: {
    severity: 'critical',
    reason: 'Seizures require prompt clinical evaluation, particularly if new or prolonged.',
    recommendedAction: 'Seek urgent in-person assessment or emergency evaluation immediately.',
  },
  'coughing blood': {
    severity: 'critical',
    reason: 'Coughing blood may indicate major respiratory or vascular pathology.',
    recommendedAction: 'Seek urgent in-person assessment or emergency evaluation immediately.',
  },
  'blood in urine': {
    severity: 'urgent',
    reason: 'Blood in urine can indicate infection, kidney injury, or bleeding.',
    recommendedAction: 'Arrange urgent medical review the same day.',
  },
  'blood in stool': {
    severity: 'urgent',
    reason: 'Blood in stool can indicate gastrointestinal bleeding or inflammatory disease.',
    recommendedAction: 'Arrange urgent medical review the same day.',
  },
  'severe abdominal pain': {
    severity: 'critical',
    reason: 'Severe abdominal pain may indicate surgical or systemic emergencies.',
    recommendedAction: 'Seek urgent in-person assessment or emergency evaluation immediately.',
  },
});

export function detectRedFlags(selectedSymptoms) {
  const seen = new Set();

  return selectedSymptoms
    .flatMap((symptom) => {
      const rule = RED_FLAG_RULES[symptom.name];
      if (!rule || seen.has(symptom.name)) {
        return [];
      }

      seen.add(symptom.name);

      return [
        {
          code: symptom.name,
          symptom: symptom.displayName || toDisplayLabel(symptom.name),
          severity: rule.severity,
          reason: rule.reason,
          recommendedAction: rule.recommendedAction,
        },
      ];
    })
    .sort((a, b) => a.symptom.localeCompare(b.symptom));
}
