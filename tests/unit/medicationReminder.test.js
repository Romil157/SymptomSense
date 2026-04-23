import { beforeEach, describe, expect, it } from '@jest/globals';
import { medicationScheduleSchema } from '../../backend/schemas/medicationSchemas.js';
import {
  computeNextDueAt,
  createMedicationRecord,
  getDueOccurrences,
  zonedDateTimeToUtc,
} from '../../backend/services/medications/medicationSchedule.js';
import {
  medicationRepository,
  resetMedicationRepository,
} from '../../backend/services/medications/medicationRepository.js';
import {
  runReminderCheck,
  triggerMedicationReminders,
} from '../../backend/services/reminders/reminderEngine.js';
import { generateReminderMessage } from '../../backend/services/ai/reminderService.js';

const clinicianId = 'clinician@symptomsense.local';

describe('medication reminders', () => {
  beforeEach(async () => {
    await resetMedicationRepository();
  });

  it('validates medication schedules and rejects duplicate reminder times', () => {
    const validPayload = medicationScheduleSchema.parse({
      name: 'Paracetamol',
      dosage: '500mg',
      frequency: 'twice daily',
      times: ['09:00', '21:00'],
      durationDays: 5,
      timezone: 'Asia/Calcutta',
    });

    expect(validPayload.name).toBe('Paracetamol');
    expect(validPayload.times).toEqual(['09:00', '21:00']);

    const invalidPayload = medicationScheduleSchema.safeParse({
      name: 'Paracetamol',
      dosage: '500mg',
      frequency: 'twice daily',
      times: ['09:00', '09:00'],
      durationDays: 5,
      timezone: 'Asia/Calcutta',
    });

    expect(invalidPayload.success).toBe(false);
  });

  it('normalizes medication times and computes the next due timestamp in the medication timezone', () => {
    const createdAt = new Date('2026-04-21T06:30:00Z');
    const record = createMedicationRecord(
      {
        name: 'Paracetamol',
        dosage: '500mg',
        frequency: 'twice daily',
        times: ['21:00', '09:00'],
        durationDays: 5,
        timezone: 'Asia/Calcutta',
      },
      clinicianId,
      createdAt
    );

    expect(record.times).toEqual(['09:00', '21:00']);
    expect(record.frequency).toBe('twice daily');
    expect(computeNextDueAt(record, createdAt)).toBe(
      zonedDateTimeToUtc(record.startsOn, '21:00', 'Asia/Calcutta').toISOString()
    );
  });

  it('finds due occurrences inside the 30-minute window across local midnight boundaries', () => {
    const record = createMedicationRecord(
      {
        name: 'Paracetamol',
        dosage: '500mg',
        frequency: 'once daily',
        times: ['23:50'],
        durationDays: 1,
        timezone: 'Asia/Calcutta',
      },
      clinicianId,
      new Date('2026-04-20T18:40:00Z')
    );

    const reminderCheckTime = zonedDateTimeToUtc('2026-04-22', '00:05', 'Asia/Calcutta');
    const dueOccurrences = getDueOccurrences(record, reminderCheckTime, 30);

    expect(dueOccurrences).toHaveLength(1);
    expect(dueOccurrences[0].occurrenceKey).toBe('2026-04-21@23:50');
  });

  it('deduplicates reminder occurrences and prunes delivered reminders after 24 hours', async () => {
    const record = createMedicationRecord(
      {
        name: 'Paracetamol',
        dosage: '500mg',
        frequency: 'once daily',
        times: ['09:00'],
        durationDays: 2,
        timezone: 'UTC',
      },
      clinicianId,
      new Date('2026-04-21T08:55:00Z')
    );

    await medicationRepository.update((store) => {
      store.medications.push(record);
      return null;
    });

    const firstTriggerAt = new Date('2026-04-21T09:05:00Z');
    const firstTrigger = await triggerMedicationReminders(clinicianId, firstTriggerAt);
    expect(firstTrigger.reminders).toHaveLength(1);

    const secondTrigger = await triggerMedicationReminders(clinicianId, firstTriggerAt);
    expect(secondTrigger.reminders).toHaveLength(0);

    await medicationRepository.update((store) => {
      store.medications[0].reminders[0].deliveredAt = '2026-04-20T07:00:00Z';
      return null;
    });

    await runReminderCheck({
      ownerId: clinicianId,
      now: new Date('2026-04-21T10:10:00Z'),
    });

    const snapshot = await medicationRepository.snapshot();
    expect(snapshot.medications[0].reminders).toHaveLength(0);
  });

  it('generates deterministic fallback reminder copy when no external provider is configured', async () => {
    const reminder = await generateReminderMessage(
      {
        name: 'Paracetamol',
        dosage: '500mg',
        frequency: 'twice daily',
      },
      null
    );

    expect(reminder.provider).toBe('fallback');
    expect(reminder.model).toBe('deterministic-medication-reminder-v1');
    expect(reminder.message).toContain('500mg');
    expect(reminder.message).toContain('Paracetamol');
  });
});
