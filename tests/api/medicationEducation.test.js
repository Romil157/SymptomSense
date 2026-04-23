import { beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../../backend/app.js';
import { aiCache } from '../../backend/services/cache/memoryCache.js';

let app;

async function loginAndGetToken() {
  const response = await request(app).post('/api/auth/login').send({
    email: 'clinician@symptomsense.local',
    password: 'StrongPassword123!',
  });

  return response.body.token;
}

describe('medication education API', () => {
  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    aiCache.clear();
  });

  it('blocks unauthenticated access', async () => {
    const response = await request(app).post('/api/medication-education').send({
      disease: 'Tension headache',
      patient: {
        age: 34,
        sex: 'male',
      },
      redFlags: [],
    });

    expect(response.status).toBe(401);
  });

  it('rejects invalid payloads with structured validation errors', async () => {
    const token = await loginAndGetToken();
    const response = await request(app)
      .post('/api/medication-education')
      .set('Authorization', `Bearer ${token}`)
      .send({
        disease: '',
        patient: {
          age: 300,
          sex: 'unknown',
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns deterministic fallback data and uses cache metadata on repeat calls', async () => {
    const token = await loginAndGetToken();
    const payload = {
      disease: 'Tension headache',
      patient: {
        age: 34,
        sex: 'male',
      },
      redFlags: [],
    };

    const firstResponse = await request(app)
      .post('/api/medication-education')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body.cached).toBe(false);
    expect(firstResponse.body.provider).toBe('fallback');
    expect(firstResponse.body.medications.length).toBeGreaterThan(0);
    expect(firstResponse.body.medications.length).toBeLessThanOrEqual(3);

    const secondResponse = await request(app)
      .post('/api/medication-education')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body.cached).toBe(true);
  });

  it('returns no medications when red flags are present', async () => {
    const token = await loginAndGetToken();
    const response = await request(app)
      .post('/api/medication-education')
      .set('Authorization', `Bearer ${token}`)
      .send({
        disease: 'Tension headache',
        patient: {
          age: 34,
          sex: 'male',
        },
        redFlags: [
          {
            symptom: 'chest pain',
            reason: 'potential cardiac emergency',
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.provider).toBe('policy');
    expect(response.body.medications).toHaveLength(0);
  });

  it('returns no medications for under-18 patients', async () => {
    const token = await loginAndGetToken();
    const response = await request(app)
      .post('/api/medication-education')
      .set('Authorization', `Bearer ${token}`)
      .send({
        disease: 'Tension headache',
        patient: {
          age: 16,
          sex: 'female',
        },
        redFlags: [],
      });

    expect(response.status).toBe(200);
    expect(response.body.provider).toBe('policy');
    expect(response.body.medications).toHaveLength(0);
  });

  it('returns non-empty educational fallback medications for unsupported adult conditions', async () => {
    const token = await loginAndGetToken();
    const response = await request(app)
      .post('/api/medication-education')
      .set('Authorization', `Bearer ${token}`)
      .send({
        disease: 'Panic Disorder',
        patient: {
          age: 34,
          sex: 'male',
        },
        redFlags: [],
      });

    expect(response.status).toBe(200);
    expect(response.body.provider).toBe('fallback');
    expect(response.body.medications.length).toBeGreaterThan(0);
    expect(response.body.medications[0].name).toBe('Acetaminophen (Paracetamol)');
    expect(response.body.generalAdvice).toContain('Consult a healthcare professional');
  });
});
