import { request } from './httpClient';

export function getSymptomCatalog(token) {
  return request('/catalog/symptoms', {
    token,
  });
}

export function analyzeSymptoms(payload, token) {
  return request('/analyze-symptoms', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function getAiInsights(payload, token, signal) {
  return request('/ai-insights', {
    method: 'POST',
    token,
    signal,
    body: payload,
  });
}

export function getMedicationEducation(payload, token, signal) {
  return request('/medication-education', {
    method: 'POST',
    token,
    signal,
    body: payload,
  });
}
