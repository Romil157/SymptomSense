function formatSex(sex) {
  return String(sex || 'unspecified').replace(/_/g, ' ');
}

function formatList(items) {
  if (items.length <= 1) {
    return items[0] || '';
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}

export async function generateFallbackInsight({ patient, result, redFlags }) {
  const matchedSymptoms = result.matchedSymptoms || [];
  const primaryEvidence = matchedSymptoms.length
    ? `The strongest symptom overlap involved ${formatList(matchedSymptoms.slice(0, 4))}.`
    : 'The ranking was based on the submitted symptom profile.';
  const escalation = redFlags.length
    ? `Red-flag findings were also identified, including ${formatList(
        redFlags.map((entry) => entry.symptom)
      )}, so urgent in-person assessment is warranted.`
    : 'No automatic emergency red-flag was triggered, but clinical judgment should always override software output.';

  const insight = `${result.disease} ranked highest for this presentation with an estimated confidence of ${Math.round(
    result.confidence * 100
  )}% (${result.confidenceLabel.toLowerCase()} confidence).

This summary applies to a ${patient.age}-year-old ${formatSex(patient.sex)} patient. ${primaryEvidence} ${result.whySuggested}

${escalation} This output is informational only and must not replace a clinician assessment, diagnostic testing, or emergency escalation protocol.`;

  return {
    provider: 'fallback',
    model: 'deterministic-clinical-summary-v1',
    insight,
  };
}
