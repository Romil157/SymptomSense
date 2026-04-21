import { detectRedFlags } from './redFlags.js';
import { getSymptomWeight } from './symptomWeights.js';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round(value) {
  return Number(value.toFixed(4));
}

function listLabels(contributors) {
  return contributors.map((entry) => entry.label);
}

export function getDurationMultiplier(durationDays) {
  if (durationDays <= 0) return 0.7;
  if (durationDays <= 2) return 0.9;
  if (durationDays <= 7) return 1;
  if (durationDays <= 30) return 1.15;
  return 1.3;
}

export function mapConfidenceLabel(confidence) {
  if (confidence >= 0.75) return 'High';
  if (confidence >= 0.45) return 'Moderate';
  return 'Low';
}

export function scoreDiseaseMatch(diseaseEntry, selectedSymptoms) {
  const contributions = [];

  for (const selectedSymptom of selectedSymptoms) {
    if (!diseaseEntry.symptomSet.has(selectedSymptom.name)) {
      continue;
    }

    const weight = getSymptomWeight(selectedSymptom.name);
    const durationMultiplier = getDurationMultiplier(selectedSymptom.durationDays);
    const contribution = weight * selectedSymptom.severity * durationMultiplier;

    contributions.push({
      symptom: selectedSymptom.name,
      label: selectedSymptom.displayName,
      severity: selectedSymptom.severity,
      durationDays: selectedSymptom.durationDays,
      durationMultiplier,
      weight,
      contribution: round(contribution),
    });
  }

  if (!contributions.length) {
    return null;
  }

  contributions.sort((left, right) => right.contribution - left.contribution);

  const rawScore = contributions.reduce((total, item) => total + item.contribution, 0);
  const matchedCount = contributions.length;
  const inputCoverage = matchedCount / selectedSymptoms.length;
  const diseaseCoverage = matchedCount / Math.max(diseaseEntry.symptomCount, 1);

  return {
    disease: diseaseEntry.disease,
    diseaseKey: diseaseEntry.diseaseKey,
    rawScore: round(rawScore),
    matchedCount,
    inputCoverage: round(inputCoverage),
    diseaseCoverage: round(diseaseCoverage),
    contributions: contributions.map((item) => ({
      ...item,
      shareOfEvidence: round(item.contribution / rawScore),
    })),
  };
}

export function buildDiseaseResult(match, maxRawScore, selectedSymptoms, options = {}) {
  const relativeScore = maxRawScore > 0 ? match.rawScore / maxRawScore : 0;
  const confidence =
    options.confidenceOverride ??
    clamp(relativeScore * 0.6 + match.inputCoverage * 0.25 + match.diseaseCoverage * 0.15, 0, 1);
  const confidenceLabel = mapConfidenceLabel(confidence);
  const topContributors = match.contributions.slice(0, 3);
  const missingReportedSymptoms = selectedSymptoms
    .filter((selectedSymptom) => !match.contributions.some((item) => item.symptom === selectedSymptom.name))
    .map((symptom) => symptom.displayName);
  const leadingSymptoms = listLabels(topContributors);

  let whySuggested = `Matched ${match.matchedCount} of ${selectedSymptoms.length} reported symptom${
    selectedSymptoms.length === 1 ? '' : 's'
  }`;

  if (leadingSymptoms.length > 0) {
    whySuggested += ` with strongest evidence from ${leadingSymptoms.join(', ')}.`;
  } else {
    whySuggested += '.';
  }

  if (options.source === 'ml-hybrid') {
    whySuggested += ' A TensorFlow.js classifier also ranked this condition highly.';
  }

  return {
    disease: match.disease,
    confidence: round(confidence),
    confidencePercent: Math.round(confidence * 100),
    confidenceLabel,
    normalizedScore: round(options.confidenceOverride ?? relativeScore),
    rawScore: match.rawScore,
    matchedCount: match.matchedCount,
    coverage: {
      inputCoverage: match.inputCoverage,
      diseaseCoverage: match.diseaseCoverage,
    },
    matchedSymptoms: listLabels(match.contributions),
    source: options.source || 'rule-engine',
    explainability: {
      whySuggested,
      topContributors,
      matchedSymptoms: match.contributions,
      missingReportedSymptoms,
      evidenceSummary: topContributors.map(
        (item) =>
          `${item.label} contributed ${Math.round(item.shareOfEvidence * 100)}% of the weighted evidence.`
      ),
    },
  };
}

export function runRuleEngine({ selectedSymptoms, diseaseEntries, limit = 3 }) {
  if (!selectedSymptoms.length) {
    return {
      strategy: 'rule-engine',
      redFlags: [],
      results: [],
    };
  }

  const scoredMatches = diseaseEntries
    .map((diseaseEntry) => scoreDiseaseMatch(diseaseEntry, selectedSymptoms))
    .filter(Boolean)
    .sort((left, right) => right.rawScore - left.rawScore || right.matchedCount - left.matchedCount);

  const maxRawScore = scoredMatches[0]?.rawScore || 1;
  const redFlags = detectRedFlags(selectedSymptoms);
  const results = scoredMatches
    .slice(0, limit)
    .map((match) => buildDiseaseResult(match, maxRawScore, selectedSymptoms));

  return {
    strategy: 'rule-engine',
    redFlags,
    results,
  };
}
