import { request } from './httpClient';

export function login(credentials) {
  return request('/auth/login', {
    method: 'POST',
    body: credentials,
  });
}
