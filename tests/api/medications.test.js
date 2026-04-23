import { beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../../backend/app.js';
import {
  medicationRepository,
  resetMedicationRepository,
} from '../../backend/services/medications/medicationRepository.js';
import { createMedicationRecord } from '../../backend/services/medications/medicationSchedule.js';

let app;

async function loginAndGetToken() {
  const response = await request(app).post('/api/auth/login').send({
    email: 'clinician@symptomsense.local',
    password: 'StrongPassword123!',
  });

  return response.body.token;
}

describe('medication reminder API', () => {
  beforeAll(() => {
    app = createApp();
  });

  beforeEach(async () => {
    await resetMedicationRepository();
  });

  it('blocks unauthenticated access to medication routes and reminder triggers', async () => {
    const [createResponse, listResponse, deleteResponse, triggerResponse] = await Promise.all([
      request(app).post('/api/medications').send({
        name: 'Paracetamol',
        dosage: '500mg',
        frequency: 'twice daily',
        times: ['09:00', '21:00'],
        durationDays: 5,
        timezone: 'UTC',
      }),
      request(app).get('/api/medications'),
      request(app).delete('/api/medications/73b58b6f-f2f8-4fe2-a363-f3a91075dbf5'),
      request(app).post('/api/reminders/trigger').send({}),
    ]);

    expect(createResponse.status).toBe(401);
    expect(listResponse.status).toBe(401);
    expect(deleteResponse.status).toBe(401);
    expect(triggerResponse.status).toBe(401);
  });

  it('creates medication schedules, normalizes the response, and lists only the authenticated user records', async () => {
    const token = await loginAndGetToken();

    await medicationRepository.update((store) => {
      store.medications.push(
        createMedicationRecord(
          {
            name: 'Ibuprofen',
            dosage: '200mg',
            frequency: 'once daily',
            times: ['08:00'],
            durationDays: 3,
            timezone: 'UTC',
          },
          'another-user@symptomsense.local',
          new Date()
        )
      );

      return null;
    });

    const createResponse = await request(app)
      .post('/api/medications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Paracetamol',
        dosage: '500mg',
        frequency: 'twice daily',
        times: ['21:00', '09:00'],
        durationDays: 5,
        timezone: 'UTC',
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.medication.frequency).toBe('twice daily');
    expect(createResponse.body.medication.times).toEqual(['09:00', '21:00']);
    expect(createResponse.body.medication.nextDueAt).toBeTruthy();

    const listResponse = await request(app)
      .get('/api/medications')
      .set('Authorization', `Bearer ${token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.medications).toHaveLength(1);
    expect(listResponse.body.medications[0].name).toBe('Paracetamol');
  });

  it('rejects invalid medication payloads with structured validation errors', async () => {
    const token = await loginAndGetToken();

    const response = await request(app)
      .post('/api/medications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '',
        dosage: '',
        frequency: 'twice daily',
        times: ['09:00', '09:00'],
        durationDays: 0,
        timezone: 'UTC',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns due reminders with provider metadata and does not re-deliver the same occurrence twice', async () => {
    const token = await loginAndGetToken();
    const currentIso = new Date().toISOString();
    const currentTime = currentIso.slice(11, 16);

    const createResponse = await request(app)
      .post('/api/medications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Paracetamol',
        dosage: '500mg',
        frequency: 'once daily',
        times: [currentTime],
        durationDays: 1,
        timezone: 'UTC',
      });

    expect(createResponse.status).toBe(201);

    const firstTrigger = await request(app)
      .post('/api/reminders/trigger')
      .set('Authorization', `Bearer ${token}`)
      .send({
        now: currentIso,
      });

    expect(firstTrigger.status).toBe(200);
    expect(firstTrigger.body.reminders).toHaveLength(1);
    expect(firstTrigger.body.reminders[0].provider).toBe('fallback');
    expect(firstTrigger.body.reminders[0].model).toBe('deterministic-medication-reminder-v1');
    expect(firstTrigger.body.reminders[0].medication.name).toBe('Paracetamol');

    const secondTrigger = await request(app)
      .post('/api/reminders/trigger')
      .set('Authorization', `Bearer ${token}`)
      .send({
        now: currentIso,
      });

    expect(secondTrigger.status).toBe(200);
    expect(secondTrigger.body.reminders).toHaveLength(0);
  });

  it('deletes only the authenticated user medication schedule', async () => {
    const token = await loginAndGetToken();
    const createResponse = await request(app)
      .post('/api/medications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Paracetamol',
        dosage: '500mg',
        frequency: 'twice daily',
        times: ['09:00', '21:00'],
        durationDays: 5,
        timezone: 'UTC',
      });

    expect(createResponse.status).toBe(201);

    const medicationId = createResponse.body.medication.id;
    const deleteResponse = await request(app)
      .delete(`/api/medications/${medicationId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.medication.id).toBe(medicationId);

    const listResponse = await request(app)
      .get('/api/medications')
      .set('Authorization', `Bearer ${token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.medications).toHaveLength(0);
  });

  it('returns not found when deleting a medication that does not belong to the authenticated user', async () => {
    const token = await loginAndGetToken();

    const foreignMedication = createMedicationRecord(
      {
        name: 'Ibuprofen',
        dosage: '200mg',
        frequency: 'once daily',
        times: ['08:00'],
        durationDays: 3,
        timezone: 'UTC',
      },
      'another-user@symptomsense.local',
      new Date()
    );

    await medicationRepository.update((store) => {
      store.medications.push(foreignMedication);
      return null;
    });

    const deleteResponse = await request(app)
      .delete(`/api/medications/${foreignMedication.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteResponse.status).toBe(404);
    expect(deleteResponse.body.error.code).toBe('MEDICATION_NOT_FOUND');
  });
});
