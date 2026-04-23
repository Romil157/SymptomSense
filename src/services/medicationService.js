import { request } from './httpClient';

export function getMedications(token) {
  return request('/medications', {
    token,
  });
}

export function createMedication(payload, token) {
  return request('/medications', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function deleteMedication(medicationId, token) {
  return request(`/medications/${medicationId}`, {
    method: 'DELETE',
    token,
  });
}

export function triggerReminderCheck(token, body = {}) {
  return request('/reminders/trigger', {
    method: 'POST',
    token,
    body,
  });
}
