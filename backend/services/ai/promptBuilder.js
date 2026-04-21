import { sanitizeFreeText } from '../../utils/sanitizers.js';

function formatSex(sex) {
  return String(sex || 'unspecified').replace(/_/g, ' ');
}

export function buildInsightPrompt({ patient, result, redFlags }) {
  const matchedSymptoms = (result.matchedSymptoms || []).join(', ') || 'not provided';
  const redFlagSummary = redFlags.length
    ? redFlags.map((entry) => `${entry.symptom}: ${entry.reason}`).join('; ')
    : 'No red-flag symptoms were identified by the deterministic screening rules.';

  return {
    systemPrompt:
      'You are a clinical communication assistant. You explain one condition that was ranked by a deterministic symptom triage engine. You must stay factual, plain-language, concise, and risk-aware. Do not diagnose. Do not invent new conditions. Do not provide medication dosing.',
    userPrompt: `Provide a short educational overview for the following triage result.

Patient age: ${patient.age}
Patient sex: ${formatSex(patient.sex)}
Ranked condition: ${sanitizeFreeText(result.disease, { maxLength: 160 })}
Confidence: ${Math.round(result.confidence * 100)}% (${result.confidenceLabel})
Matched symptoms: ${matchedSymptoms}
Why it was suggested: ${sanitizeFreeText(result.whySuggested, { maxLength: 600 })}
Red flags: ${redFlagSummary}

Write three short paragraphs:
1. What the ranked condition usually represents.
2. Why the current symptom pattern may have led to this ranking.
3. When urgent medical assessment is warranted.

End by stating that the result is informational and not a diagnosis.`,
  };
}
