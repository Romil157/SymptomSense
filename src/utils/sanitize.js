/**
 * sanitize.js
 *
 * Input sanitization for patient profile data.
 *
 * All user-supplied values must pass through this module before being
 * interpolated into LLM prompts. This prevents prompt injection via
 * age, gender, or any other free-form field.
 *
 * Rules:
 *   - age: must be a finite integer in [1, 120]
 *   - gender: must be one of the allowed enum values (case-insensitive)
 *
 * Throws a structured error on invalid input so the UI can surface
 * a specific validation message rather than a generic failure.
 */

import { createError, ErrorType } from './errors.js';

const ALLOWED_GENDERS = new Set(['male', 'female', 'other', 'prefer not to say']);

// Maximum length for any string field passed into a prompt.
// Any longer value is almost certainly an injection attempt.
const MAX_STRING_LENGTH = 64;

/**
 * Sanitizes and validates the patient profile before use in LLM prompts.
 *
 * @param {{ age: string | number, gender: string }} info
 * @returns {{ age: number, gender: string }} - validated, cast values
 * @throws {Error} with errorType set to INVALID_AGE or INVALID_GENDER
 */
export function sanitizePatientInfo(info) {
  // --- Age validation ---
  const age = Number(info?.age);

  if (
    !Number.isFinite(age) ||
    !Number.isInteger(age) ||
    age < 1 ||
    age > 120
  ) {
    throw createError(
      ErrorType.INVALID_AGE,
      `Invalid age value: "${info?.age}". Must be an integer between 1 and 120.`
    );
  }

  // --- Gender validation ---
  const rawGender = String(info?.gender ?? '').trim();

  if (rawGender.length > MAX_STRING_LENGTH) {
    throw createError(
      ErrorType.INVALID_GENDER,
      `Gender field exceeds maximum allowed length.`
    );
  }

  const normalizedGender = rawGender.toLowerCase();

  if (!ALLOWED_GENDERS.has(normalizedGender)) {
    throw createError(
      ErrorType.INVALID_GENDER,
      `Invalid gender value: "${rawGender}". Must be one of: ${[...ALLOWED_GENDERS].join(', ')}.`
    );
  }

  return { age, gender: normalizedGender };
}

/**
 * Sanitizes a disease name before interpolation into an LLM prompt.
 * Strips any characters outside alphanumerics, spaces, hyphens, and apostrophes.
 * Truncates to 128 characters.
 *
 * @param {string} name
 * @returns {string}
 */
export function sanitizeDiseaseName(name) {
  if (typeof name !== 'string') return 'Unknown Condition';
  return name
    .replace(/[^a-zA-Z0-9\s\-']/g, '')
    .trim()
    .slice(0, 128);
}
