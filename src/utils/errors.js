/**
 * errors.js
 *
 * Structured error taxonomy for SymptomSense.
 *
 * All async operations should throw or resolve errors using these types.
 * This allows the UI to render per-type messages and enables future
 * monitoring to aggregate by error category.
 */

export const ErrorType = Object.freeze({
  // Dataset
  DATASET_LOAD_FAILED:    'DATASET_LOAD_FAILED',
  DATASET_TIMEOUT:        'DATASET_TIMEOUT',
  DATASET_INVALID:        'DATASET_INVALID',

  // Scoring
  NO_SYMPTOMS_PROVIDED:   'NO_SYMPTOMS_PROVIDED',

  // Input validation
  INVALID_AGE:            'INVALID_AGE',
  INVALID_GENDER:         'INVALID_GENDER',

  // NVIDIA NIM API
  API_KEY_MISSING:        'API_KEY_MISSING',
  API_KEY_INVALID:        'API_KEY_INVALID',
  API_RATE_LIMITED:       'API_RATE_LIMITED',
  API_CALL_FAILED:        'API_CALL_FAILED',
  API_RESPONSE_EMPTY:     'API_RESPONSE_EMPTY',
  API_NO_DISEASE:         'API_NO_DISEASE',
});

/**
 * Creates a structured error with a type code and message.
 * Usage: throw createError(ErrorType.API_RATE_LIMITED, 'Too many requests.')
 *
 * @param {string} type - One of ErrorType constants
 * @param {string} message - Human-readable message for logging
 * @returns {Error}
 */
export function createError(type, message) {
  const err = new Error(message);
  err.errorType = type;
  return err;
}

/**
 * Maps NVIDIA NIM API HTTP status codes to structured ErrorType values.
 * @param {number} status
 * @returns {string} ErrorType constant
 */
export function mapApiErrorType(status) {
  if (status === 401) return ErrorType.API_KEY_INVALID;
  if (status === 429) return ErrorType.API_RATE_LIMITED;
  return ErrorType.API_CALL_FAILED;
}

/**
 * Returns a user-facing message for a given ErrorType.
 * @param {string} type
 * @returns {string}
 */
export function errorMessage(type) {
  const messages = {
    [ErrorType.DATASET_LOAD_FAILED]:  'Failed to load the symptom dataset. Please refresh the page.',
    [ErrorType.DATASET_TIMEOUT]:      'Dataset load timed out. Check your connection and refresh.',
    [ErrorType.DATASET_INVALID]:      'The dataset appears to be corrupted or incomplete. Please refresh.',
    [ErrorType.API_KEY_MISSING]:      'Enter your NVIDIA API key in Settings to enable AI explanations. Get one free at build.nvidia.com.',
    [ErrorType.API_KEY_INVALID]:      'Your API key was rejected. Please check it in Settings.',
    [ErrorType.API_RATE_LIMITED]:     'The AI service is temporarily rate-limited. Please wait a moment and try again.',
    [ErrorType.API_CALL_FAILED]:      'The AI service is currently unavailable. Prediction results are still shown above.',
    [ErrorType.API_RESPONSE_EMPTY]:   'The AI service returned an empty response. Please try again.',
    [ErrorType.API_NO_DISEASE]:       'No disease was provided to the AI explanation service.',
  };
  return messages[type] ?? 'An unexpected error occurred. Please refresh the page.';
}
