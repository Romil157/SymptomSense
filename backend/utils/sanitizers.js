import { createHash } from 'node:crypto';

export const ALLOWED_SEX_VALUES = ['male', 'female', 'other', 'prefer_not_to_say'];

const multiWhitespacePattern = /\s+/g;
const nonWordPattern = /[^a-zA-Z0-9\s\-']/g;

const sexAliases = new Map([
  ['male', 'male'],
  ['m', 'male'],
  ['female', 'female'],
  ['f', 'female'],
  ['other', 'other'],
  ['prefer_not_to_say', 'prefer_not_to_say'],
  ['prefernottosay', 'prefer_not_to_say'],
  ['prefer-not-to-say', 'prefer_not_to_say'],
]);

function stripControlCharacters(value) {
  return Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127 ? ' ' : character;
  }).join('');
}

export function sanitizeFreeText(value, { maxLength = 160 } = {}) {
  return stripControlCharacters(String(value ?? ''))
    .normalize('NFKC')
    .replace(multiWhitespacePattern, ' ')
    .trim()
    .slice(0, maxLength);
}

export function normalizeSymptomName(value) {
  return sanitizeFreeText(value, { maxLength: 120 })
    .replace(/_/g, ' ')
    .replace(nonWordPattern, '')
    .toLowerCase();
}

export function normalizeSex(value) {
  const normalized = sanitizeFreeText(value, { maxLength: 40 })
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  return sexAliases.get(normalized) || normalized;
}

export function toDisplayLabel(value) {
  return normalizeSymptomName(value)
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function createCacheKey(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
