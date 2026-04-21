import { beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../../backend/app.js';
import { resetDatasetCache, warmDatasetCache } from '../../backend/services/dataset/datasetService.js';

let app;

beforeAll(async () => {
  resetDatasetCache();
  await warmDatasetCache();
  app = createApp();
});

describe('SymptomSense API', () => {
  it('returns a healthy status payload', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('symptomsense-api');
  });

  it('authenticates a clinician and returns a JWT', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: 'clinician@symptomsense.local',
      password: 'StrongPassword123!',
    });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeTruthy();
    expect(response.body.user.email).toBe('clinician@symptomsense.local');
  });

  it('runs symptom analysis and returns structured results', async () => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'clinician@symptomsense.local',
      password: 'StrongPassword123!',
    });

    const response = await request(app)
      .post('/api/analyze-symptoms')
      .set('Authorization', `Bearer ${loginResponse.body.token}`)
      .send({
        patient: {
          age: 34,
          sex: 'male',
        },
        symptoms: [
          { name: 'dizziness', severity: 4, durationDays: 2 },
          { name: 'insomnia', severity: 3, durationDays: 7 },
          { name: 'shortness of breath', severity: 4, durationDays: 1 },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.summary.modelStrategy).toBeTruthy();
    expect(response.body.results.length).toBeGreaterThan(0);
    expect(response.body.results[0].explainability.whySuggested).toBeTruthy();
  });

  it('returns deterministic AI insight payloads through the backend endpoint', async () => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'clinician@symptomsense.local',
      password: 'StrongPassword123!',
    });

    const response = await request(app)
      .post('/api/ai-insights')
      .set('Authorization', `Bearer ${loginResponse.body.token}`)
      .send({
        patient: {
          age: 34,
          sex: 'male',
        },
        result: {
          disease: 'Panic Disorder',
          confidence: 0.82,
          confidenceLabel: 'High',
          matchedSymptoms: ['Chest Tightness', 'Shortness of Breath'],
          whySuggested: 'Matched 2 of 2 reported symptoms with strong cardiopulmonary overlap.',
        },
        redFlags: [],
      });

    expect(response.status).toBe(200);
    expect(response.body.provider).toBe('fallback');
    expect(response.body.insight).toContain('Panic Disorder');
  });
});
