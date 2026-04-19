/**
 * scoreEngine.js
 *
 * Weighted composite disease prediction engine.
 *
 * Scoring formula per disease D:
 *   score(D) = sum over each matched symptom S of:
 *     weight(S) * severity(S) * durationMultiplier(duration(S))
 *
 * Normalization — relative, not absolute:
 *   normalizedScore(D) = score(D) / maxRawScore
 *   where maxRawScore = max composite score across all diseases with at least one match
 *
 *   This means the top-ranked disease always produces normalizedScore = 1.0.
 *   Tiers are applied to relative values, not a theoretical ceiling.
 *   See design review for rationale.
 *
 * Duration multiplier replaces log(duration + 1):
 *   - Fixes: log(0+1) = 0 incorrectly silenced acute same-day symptoms.
 *   - Acute onset (day 0) is clinically significant and receives a non-zero multiplier.
 *
 * Time:  O(D * S) — D diseases (~40), S selected symptoms (<=15 realistic). Negligible.
 * Space: O(D) — result array before sort and slice.
 */

import { SYMPTOM_WEIGHTS, RED_FLAG_SYMPTOMS } from './weightRegistry.js';

const DEFAULT_WEIGHT = 1.0;

/**
 * Discrete duration tier multiplier.
 *
 * Replaces log(duration + 1) to correctly handle acute presentations.
 * A symptom that started today (duration = 0) is not clinically irrelevant.
 *
 * @param {number} days - Duration in days (integer >= 0)
 * @returns {number} Multiplier in range [0.5, 1.3]
 */
function durationMultiplier(days) {
  if (days === 0)  return 0.5;   // Acute onset — significant, not zero
  if (days <= 2)   return 0.8;   // Recent onset
  if (days <= 7)   return 1.0;   // Standard acute window (baseline)
  if (days <= 30)  return 1.2;   // Sub-acute to chronic
  return 1.3;                    // Chronic — persistent, increasing diagnostic weight
}

/**
 * Maps a relative normalized score to a confidence tier.
 * Thresholds are calibrated against relative scores (0–1 where 1.0 = top result).
 *
 * @param {number} score - Relative normalized score in (0, 1]
 * @returns {"High" | "Moderate" | "Low"}
 */
function mapConfidenceTier(score) {
  if (score >= 0.80) return 'High';
  if (score >= 0.50) return 'Moderate';
  return 'Low';
}

/**
 * Main scoring function.
 *
 * @param {Array<{name: string, severity: number, duration: number}>} selectedSymptoms
 *   Each entry:
 *     - name: string (display-cased, e.g. "Fever")
 *     - severity: integer 1–5
 *     - duration: integer >= 0 (days)
 *
 * @param {Array<{disease: string, symptoms: string[]}>} dataset
 *   Each record has a disease name and lowercase normalized symptom array.
 *
 * @returns {{
 *   results: Array<{
 *     disease: string,
 *     compositeScore: number,
 *     normalizedScore: number,
 *     matchedCount: number,
 *     matchedSymptomNames: string[],
 *     confidenceTier: "High" | "Moderate" | "Low"
 *   }>,
 *   redFlags: string[]
 * }}
 */
export function scoreSymptoms(selectedSymptoms, dataset) {
  if (!selectedSymptoms || selectedSymptoms.length === 0) {
    return { results: [], redFlags: [] };
  }

  // Normalize input names once — avoids repeated .toLowerCase() in the inner loop
  const normalizedInput = selectedSymptoms.map(s => ({
    ...s,
    normalizedName: s.name.toLowerCase().trim(),
  }));

  // Red-flag check runs before scoring — always
  const redFlags = normalizedInput
    .filter(s => RED_FLAG_SYMPTOMS.has(s.normalizedName))
    .map(s => s.name);

  // --- Scoring pass ---
  const rawResults = [];

  for (const record of dataset) {
    const diseaseSymptomSet = new Set(
      record.symptoms.map(sym => sym.toLowerCase().trim())
    );

    let compositeScore = 0;
    let matchedCount = 0;
    const matchedSymptomNames = [];

    for (const symptom of normalizedInput) {
      if (diseaseSymptomSet.has(symptom.normalizedName)) {
        const w = SYMPTOM_WEIGHTS[symptom.normalizedName] ?? DEFAULT_WEIGHT;
        compositeScore += w * symptom.severity * durationMultiplier(symptom.duration);
        matchedCount++;
        matchedSymptomNames.push(symptom.name);
      }
    }

    if (matchedCount === 0) continue;

    rawResults.push({
      disease: record.disease,
      compositeScore,
      matchedCount,
      matchedSymptomNames,
    });
  }

  if (rawResults.length === 0) {
    return { results: [], redFlags };
  }

  // Sort by composite score descending; break ties by match count
  rawResults.sort(
    (a, b) => b.compositeScore - a.compositeScore || b.matchedCount - a.matchedCount
  );

  // --- Relative normalization ---
  // The top result defines the ceiling. All others are scored relative to it.
  // This prevents score compression into the low tier under realistic input conditions.
  const maxRawScore = rawResults[0].compositeScore;

  const results = rawResults.slice(0, 3).map(r => {
    const normalizedScore = r.compositeScore / maxRawScore;
    return {
      disease: r.disease,
      compositeScore: parseFloat(r.compositeScore.toFixed(4)),
      normalizedScore: parseFloat(normalizedScore.toFixed(4)),
      matchedCount: r.matchedCount,
      matchedSymptomNames: r.matchedSymptomNames,
      confidenceTier: mapConfidenceTier(normalizedScore),
    };
  });

  return { results, redFlags };
}
