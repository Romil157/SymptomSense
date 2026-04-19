/**
 * nvidia.js
 *
 * Primary AI provider integration using the NVIDIA NIM API.
 * Model: google/gemma-4-31b-it (Gemma 4, 31B parameter instruction-tuned model)
 * Endpoint: https://integrate.api.nvidia.com/v1/chat/completions (OpenAI-compatible)
 *
 * Design:
 *   - Implements the same interface as claude.js: generateDiseaseExplanation(apiKey, topResult, patientInfo)
 *   - ResultsPanel and any future callers are provider-agnostic.
 *   - Uses streaming (text/event-stream) and concatenates the response for a clean return value.
 *   - `enable_thinking: true` activates Gemma 4's internal reasoning trace before the final answer.
 *     Only the final assistant text is returned; the thinking trace is discarded.
 *   - Session-scoped cache shared with the same key format as claude.js for consistency.
 *
 * Reference Python SDK snippet:
 *   model: "google/gemma-4-31b-it"
 *   invoke_url: "https://integrate.api.nvidia.com/v1/chat/completions"
 *   chat_template_kwargs: { "enable_thinking": true }
 */

import { createError, mapApiErrorType, ErrorType } from '../utils/errors.js';
import { sanitizePatientInfo, sanitizeDiseaseName } from '../utils/sanitize.js';

const NVIDIA_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';
const MODEL = 'google/gemma-4-31b-it';

const SYSTEM_PROMPT =
  'You are a clinical information assistant. Your sole role is to explain, in plain language, ' +
  'a single disease that has been identified by a deterministic symptom-matching algorithm. ' +
  'You must not generate predictions, suggest additional diagnoses, or produce treatment plans ' +
  'under any circumstances. You must not reference any disease other than the one explicitly ' +
  'provided. Respond in plain text only. Do not use markdown, bullet points, numbered lists, or ' +
  'section headers. Write in prose paragraphs.';

/**
 * Session-scoped explanation cache.
 * Key: "${disease}::${age}::${gender}"
 */
const explanationCache = new Map();

/**
 * Builds the structured user prompt from sanitized values.
 *
 * @param {string} diseaseName   — sanitized
 * @param {number} age           — validated integer 1-120
 * @param {string} gender        — normalized, allowlisted
 * @param {string[]} matchedSymptoms
 * @param {"High"|"Moderate"|"Low"} confidenceTier
 * @returns {string}
 */
function buildPrompt(diseaseName, age, gender, matchedSymptoms, confidenceTier) {
  const ageStr = `${age} years old`;
  const symptomsStr =
    matchedSymptoms?.length > 0 ? matchedSymptoms.join(', ') : 'not specified';

  return (
    `A symptom-matching algorithm has identified "${diseaseName}" as the most likely condition ` +
    `for a patient with the following profile:\n\n` +
    `Patient age: ${ageStr}\n` +
    `Patient gender: ${gender}\n` +
    `Matched symptoms: ${symptomsStr}\n` +
    `Algorithm confidence tier: ${confidenceTier}\n\n` +
    `Provide the following in order, written as separate plain-text paragraphs with no headings:\n\n` +
    `First, provide a brief factual description of ${diseaseName} that a non-medical reader can understand.\n\n` +
    `Second, describe the most common and well-established causes or triggers for ${diseaseName} ` +
    `as supported by general medical literature.\n\n` +
    `Third, describe any clinically relevant considerations specific to a ${ageStr} ${gender} patient. ` +
    `If no specific factors apply, state that the general description applies.\n\n` +
    `Fourth, specify when this patient should consult a doctor, and under what symptoms or ` +
    `circumstances they should seek emergency care immediately.`
  );
}

/**
 * Parses a Server-Sent Events stream from a fetch Response.
 * Accumulates all `data:` delta chunks and returns the concatenated text.
 *
 * Each SSE line is: `data: {"choices":[{"delta":{"content":"..."}}]}`
 * Terminates on `data: [DONE]`.
 *
 * When `enable_thinking` is true, Gemma 4 emits content wrapped in <think>...</think>
 * before the final answer. This function strips the thinking block and returns only
 * the visible output.
 *
 * @param {Response} response - Fetch response with streaming body
 * @returns {Promise<string>} - Full concatenated completion text
 */
async function readSSEStream(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');

    // Keep the last (potentially incomplete) line in the buffer
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const raw = trimmed.slice(5).trim();
      if (raw === '[DONE]') break;

      try {
        const parsed = JSON.parse(raw);
        const delta = parsed?.choices?.[0]?.delta?.content;
        if (delta) fullText += delta;
      } catch {
        // Malformed SSE chunk — skip
      }
    }
  }

  // Strip the thinking block emitted by enable_thinking: true
  // Format: <think>...</think>\n<final answer>
  const thinkMatch = fullText.match(/<\/think>\s*/s);
  if (thinkMatch) {
    const afterIndex = fullText.indexOf(thinkMatch[0]) + thinkMatch[0].length;
    fullText = fullText.slice(afterIndex).trim();
  }

  return fullText.trim();
}

/**
 * Generates a disease explanation using Gemma 4 via the NVIDIA NIM API.
 *
 * Provides the same interface as generateDiseaseExplanation in claude.js.
 *
 * @param {string} apiKey       — NVIDIA API key (nvapi-...)
 * @param {{ disease: string, matchedSymptomNames: string[], confidenceTier: string }} topResult
 * @param {{ age: string|number, gender: string }} patientInfo
 * @returns {Promise<string>} — plain-text explanation
 */
export async function generateDiseaseExplanation(apiKey, topResult, patientInfo) {
  // --- Input validation ---
  if (!apiKey) {
    throw createError(ErrorType.API_KEY_MISSING, 'No NVIDIA API key provided.');
  }
  if (!topResult?.disease) {
    throw createError(ErrorType.API_NO_DISEASE, 'No disease provided to the explanation service.');
  }

  const sanitized = sanitizePatientInfo(patientInfo);
  const safeName = sanitizeDiseaseName(topResult.disease);

  // --- Cache lookup ---
  const cacheKey = `${safeName}::${sanitized.age}::${sanitized.gender}`;
  if (explanationCache.has(cacheKey)) {
    return explanationCache.get(cacheKey);
  }

  // --- API call ---
  let response;
  try {
    response = await fetch(NVIDIA_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
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
        max_tokens: 1024,
        temperature: 0.6,
        top_p: 0.95,
        stream: true,
        chat_template_kwargs: { enable_thinking: true },
      }),
    });
  } catch (err) {
    throw createError(ErrorType.API_CALL_FAILED, err.message ?? 'NVIDIA API fetch failed.');
  }

  if (!response.ok) {
    const errorType = mapApiErrorType(response.status);
    throw createError(errorType, `NVIDIA API responded with HTTP ${response.status}.`);
  }

  // --- Parse SSE stream ---
  let text;
  try {
    text = await readSSEStream(response);
  } catch (err) {
    throw createError(ErrorType.API_CALL_FAILED, 'Failed to read NVIDIA stream: ' + err.message);
  }

  if (!text) {
    throw createError(ErrorType.API_RESPONSE_EMPTY, 'NVIDIA API returned an empty response.');
  }

  explanationCache.set(cacheKey, text);
  return text;
}
