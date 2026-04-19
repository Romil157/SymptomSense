/**
 * claude.js
 *
 * Anthropic Claude integration for disease explanation.
 *
 * The LLM is used exclusively to translate the top deterministic prediction
 * into plain language. It does not produce predictions, rankings, or diagnoses.
 *
 * Improvements over v1:
 *   - Session-scoped cache: identical (disease + age + gender) tuples are not re-called.
 *   - Structured ErrorType on all failure paths — no raw string errors.
 *   - sanitizePatientInfo + sanitizeDiseaseName called before any prompt interpolation.
 *   - Anthropic HTTP status codes are mapped to specific ErrorType values.
 *   - The hardcoded disclaimer is appended at the component layer, not here.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createError, mapApiErrorType, ErrorType } from '../utils/errors.js';
import { sanitizePatientInfo, sanitizeDiseaseName } from '../utils/sanitize.js';

const SYSTEM_PROMPT = `You are a clinical information assistant. Your sole role is to explain, \
in plain language, a single disease that has been identified by a deterministic symptom-matching \
algorithm. You must not generate predictions, suggest additional diagnoses, or produce treatment \
plans under any circumstances. You must not reference any disease other than the one explicitly \
provided. Respond in plain text only. Do not use markdown, bullet points, numbered lists, or \
section headers. Write in prose paragraphs.`;

/**
 * Session-scoped in-memory cache.
 * Key: "${disease}::${age}::${gender}"
 * Value: resolved explanation string
 *
 * Cleared on page reload. Not persisted to localStorage (contains patient context).
 */
const explanationCache = new Map();

/**
 * Builds the LLM user prompt from sanitized, validated values.
 * All interpolated values have been sanitized before reaching this function.
 *
 * @param {string} diseaseName  - sanitized
 * @param {number} age          - valid integer 1-120
 * @param {string} gender       - lowercase, allowlisted value
 * @param {string[]} matchedSymptoms
 * @param {"High"|"Moderate"|"Low"} confidenceTier
 * @returns {string}
 */
function buildPrompt(diseaseName, age, gender, matchedSymptoms, confidenceTier) {
  const ageStr = `${age} years old`;
  const symptomsStr = matchedSymptoms?.length > 0
    ? matchedSymptoms.join(', ')
    : 'not specified';

  return `A symptom-matching algorithm has identified "${diseaseName}" as the most likely \
condition for a patient with the following profile:

Patient age: ${ageStr}
Patient gender: ${gender}
Matched symptoms: ${symptomsStr}
Algorithm confidence tier: ${confidenceTier}

Provide the following in order, written as separate plain-text paragraphs with no headings:

First, provide a brief factual description of ${diseaseName} that a non-medical reader can \
understand.

Second, describe the most common and well-established causes or triggers for ${diseaseName} \
as supported by general medical literature.

Third, describe any clinically relevant considerations specific to a ${ageStr} ${gender} \
patient. If no specific factors apply, state that the general description applies.

Fourth, specify when this patient should consult a doctor, and under what symptoms or \
circumstances they should seek emergency care immediately.`;
}

/**
 * Calls Claude to generate a structured explanation for the top predicted disease.
 *
 * Flow:
 *   1. Validate inputs — throws structured error if invalid.
 *   2. Check session cache — returns immediately on hit.
 *   3. Build sanitized prompt and call Anthropic API.
 *   4. Map API errors to structured ErrorType.
 *   5. Cache and return response text.
 *
 * @param {string} apiKey
 * @param {{ disease: string, matchedSymptomNames: string[], confidenceTier: string }} topResult
 * @param {{ age: string | number, gender: string }} patientInfo
 * @returns {Promise<string>} plain-text explanation
 */
export async function generateDiseaseExplanation(apiKey, topResult, patientInfo) {
  // --- Input validation ---
  if (!apiKey) {
    throw createError(ErrorType.API_KEY_MISSING, 'No API key provided.');
  }
  if (!topResult?.disease) {
    throw createError(ErrorType.API_NO_DISEASE, 'No disease provided to the explanation service.');
  }

  // Sanitize patient info — throws INVALID_AGE or INVALID_GENDER on bad input
  const sanitized = sanitizePatientInfo(patientInfo);

  // Sanitize disease name — strips injection characters
  const safeName = sanitizeDiseaseName(topResult.disease);

  // --- Cache lookup ---
  const cacheKey = `${safeName}::${sanitized.age}::${sanitized.gender}`;
  if (explanationCache.has(cacheKey)) {
    return explanationCache.get(cacheKey);
  }

  // --- API call ---
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  let response;
  try {
    response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: buildPrompt(
            safeName,
            sanitized.age,
            sanitized.gender,
            topResult.matchedSymptomNames ?? [],
            topResult.confidenceTier
          ),
        },
      ],
    });
  } catch (err) {
    // Map HTTP status codes to structured error types
    const status = err?.status ?? err?.response?.status;
    const errorType = status ? mapApiErrorType(status) : ErrorType.API_CALL_FAILED;
    throw createError(errorType, err.message ?? 'Anthropic API call failed.');
  }

  // --- Response validation ---
  const text = response?.content?.[0]?.text?.trim();
  if (!text) {
    throw createError(ErrorType.API_RESPONSE_EMPTY, 'Anthropic returned an empty response.');
  }

  // Cache and return
  explanationCache.set(cacheKey, text);
  return text;
}
