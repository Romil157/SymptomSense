const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, { status, code, details, requestId } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

export async function request(path, options = {}) {
  const { method = 'GET', body, token, signal } = options;

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      signal,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new ApiError('Unable to reach the SymptomSense API. Confirm the backend is running.', {
      status: 0,
      code: 'NETWORK_ERROR',
      details: error.message,
    });
  }

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const errorPayload = payload?.error || {};
    throw new ApiError(errorPayload.message || 'The request could not be completed.', {
      status: response.status,
      code: errorPayload.code,
      details: errorPayload.details,
      requestId: payload?.requestId,
    });
  }

  return payload;
}
