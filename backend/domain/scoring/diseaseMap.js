import { createHash } from 'node:crypto';
import { getSymptomWeight } from './symptomWeights.js';
import { normalizeSymptomName, sanitizeFreeText, toDisplayLabel } from '../../utils/sanitizers.js';

export function buildDiseaseMap(rawRecords = []) {
  return rawRecords
    .map((record, index) => {
      const disease = sanitizeFreeText(record.disease, { maxLength: 160 }) || `Condition ${index + 1}`;
      const symptoms = Array.from(
        new Set((record.symptoms || []).map(normalizeSymptomName).filter(Boolean))
      );

      const weightedSymptoms = symptoms
        .map((symptomName) => ({
          name: symptomName,
          label: toDisplayLabel(symptomName),
          weight: getSymptomWeight(symptomName),
        }))
        .sort((left, right) => right.weight - left.weight || left.label.localeCompare(right.label));

      return {
        id: createHash('sha1').update(`${disease}:${index}`).digest('hex').slice(0, 12),
        disease,
        diseaseKey: disease.toLowerCase(),
        symptoms,
        symptomSet: new Set(symptoms),
        symptomCount: symptoms.length,
        signature: weightedSymptoms.slice(0, 5),
        weightedSymptoms,
      };
    })
    .filter((entry) => entry.symptomCount > 0);
}

export function buildDiseaseLookup(diseaseEntries) {
  return new Map(diseaseEntries.map((entry) => [entry.diseaseKey, entry]));
}

export function buildSymptomCatalog(diseaseEntries) {
  const uniqueSymptoms = new Map();

  for (const diseaseEntry of diseaseEntries) {
    for (const symptom of diseaseEntry.weightedSymptoms) {
      const existing = uniqueSymptoms.get(symptom.name);
      if (!existing || symptom.weight > existing.weight) {
        uniqueSymptoms.set(symptom.name, {
          name: symptom.name,
          label: symptom.label,
          weight: symptom.weight,
        });
      }
    }
  }

  return Array.from(uniqueSymptoms.values()).sort((left, right) =>
    left.label.localeCompare(right.label)
  );
}
