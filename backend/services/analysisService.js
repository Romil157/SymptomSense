import { logger } from '../config/logger.js';
import {
  buildDiseaseResult,
  mapConfidenceLabel,
  runRuleEngine,
  scoreDiseaseMatch,
} from '../domain/scoring/scoringEngine.js';
import { AppError } from '../utils/AppError.js';
import { createCacheKey, normalizeSymptomName } from '../utils/sanitizers.js';
import { analysisCache } from './cache/memoryCache.js';
import { getDatasetSnapshot } from './dataset/datasetService.js';
import { predictSymptoms } from './ml/predictionService.js';

function normalizeSymptomSelections(symptoms, symptomLookup) {
  const deduplicated = new Map();

  for (const symptom of symptoms) {
    const normalizedName = normalizeSymptomName(symptom.name);
    const catalogEntry = symptomLookup.get(normalizedName);

    if (!catalogEntry) {
      throw new AppError(400, 'UNKNOWN_SYMPTOM', `Unknown symptom "${symptom.name}".`, {
        symptom: symptom.name,
      });
    }

    const normalizedEntry = {
      name: normalizedName,
      displayName: catalogEntry.label,
      severity: Number(symptom.severity),
      durationDays: Number(symptom.durationDays),
    };

    const existing = deduplicated.get(normalizedName);
    deduplicated.set(
      normalizedName,
      existing
        ? {
            ...normalizedEntry,
            severity: Math.max(existing.severity, normalizedEntry.severity),
            durationDays: Math.max(existing.durationDays, normalizedEntry.durationDays),
          }
        : normalizedEntry
    );
  }

  const selectedSymptoms = Array.from(deduplicated.values());

  if (!selectedSymptoms.length) {
    throw new AppError(400, 'NO_SYMPTOMS', 'At least one symptom must be supplied for analysis.');
  }

  return selectedSymptoms;
}

function mergeMlPredictions(ruleAnalysis, mlPredictions, datasetSnapshot, selectedSymptoms) {
  const existingResults = new Map(
    ruleAnalysis.results.map((result) => [result.disease.toLowerCase(), result])
  );
  const rawMatches = datasetSnapshot.diseaseEntries
    .map((diseaseEntry) => scoreDiseaseMatch(diseaseEntry, selectedSymptoms))
    .filter(Boolean);
  const matchLookup = new Map(rawMatches.map((match) => [match.diseaseKey, match]));
  const maxRawScore = Math.max(...rawMatches.map((match) => match.rawScore), 1);

  const results = mlPredictions
    .map((prediction) => {
      const diseaseKey = prediction.disease.toLowerCase();
      const existingResult = existingResults.get(diseaseKey);

      if (existingResult) {
        return {
          ...existingResult,
          confidence: prediction.probability,
          confidencePercent: Math.round(prediction.probability * 100),
          confidenceLabel: mapConfidenceLabel(prediction.probability),
          normalizedScore: prediction.probability,
          source: 'ml-hybrid',
          explainability: {
            ...existingResult.explainability,
            whySuggested: `${existingResult.explainability.whySuggested} A TensorFlow.js classifier also ranked this condition highly.`,
          },
        };
      }

      const rawMatch = matchLookup.get(diseaseKey);
      if (!rawMatch) {
        return null;
      }

      return buildDiseaseResult(rawMatch, maxRawScore, selectedSymptoms, {
        source: 'ml-hybrid',
        confidenceOverride: prediction.probability,
      });
    })
    .filter(Boolean)
    .slice(0, 3);

  if (!results.length) {
    return ruleAnalysis;
  }

  return {
    ...ruleAnalysis,
    strategy: 'ml-hybrid',
    results,
  };
}

export async function runSymptomAnalysis(payload) {
  const datasetSnapshot = await getDatasetSnapshot();
  const selectedSymptoms = normalizeSymptomSelections(payload.symptoms, datasetSnapshot.symptomLookup);
  const cacheKey = createCacheKey({
    patient: payload.patient,
    symptoms: selectedSymptoms,
  });
  const cached = analysisCache.get(cacheKey);

  if (cached) {
    return {
      ...cached,
      cached: true,
    };
  }

  let analysis = runRuleEngine({
    selectedSymptoms,
    diseaseEntries: datasetSnapshot.diseaseEntries,
  });

  try {
    const mlPredictions = await predictSymptoms(
      selectedSymptoms.map((symptom) => symptom.name),
      datasetSnapshot
    );

    if (mlPredictions?.length) {
      analysis = mergeMlPredictions(analysis, mlPredictions, datasetSnapshot, selectedSymptoms);
    }
  } catch (error) {
    logger.warn('ML path unavailable. Returning deterministic analysis only.', {
      message: error.message,
    });
  }

  const response = {
    patient: payload.patient,
    summary: {
      analyzedAt: new Date().toISOString(),
      symptomCount: selectedSymptoms.length,
      diseaseCount: datasetSnapshot.diseaseEntries.length,
      modelStrategy: analysis.strategy,
      urgent: analysis.redFlags.length > 0,
    },
    redFlags: analysis.redFlags,
    results: analysis.results,
    cached: false,
  };

  analysisCache.set(cacheKey, response);

  return response;
}
