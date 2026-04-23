import { randomUUID } from 'node:crypto';
import { config } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { generateReminderMessage } from '../ai/reminderService.js';
import { medicationRepository } from '../medications/medicationRepository.js';
import { getDueOccurrences } from '../medications/medicationSchedule.js';

const REMINDER_RETENTION_MS = 24 * 60 * 60 * 1000;

function normalizeReferenceDate(value) {
  if (!value) {
    return new Date();
  }

  const normalizedDate = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(normalizedDate.getTime())) {
    throw new AppError(400, 'INVALID_REMINDER_TIMESTAMP', 'Reminder trigger time must be a valid ISO timestamp.');
  }

  return normalizedDate;
}

function pruneDeliveredReminders(medication, now) {
  medication.reminders = medication.reminders.filter((reminder) => {
    if (!reminder.deliveredAt) {
      return true;
    }

    return new Date(reminder.deliveredAt).getTime() + REMINDER_RETENTION_MS > now.getTime();
  });
}

function buildReminderResponse(reminder, medication) {
  return {
    id: reminder.id,
    medicationId: medication.id,
    dueAt: reminder.dueAt,
    message: reminder.message,
    provider: reminder.provider,
    model: reminder.model,
    medication: {
      name: medication.name,
      dosage: medication.dosage,
      frequency: medication.frequency,
      times: [...medication.times],
    },
  };
}

export async function runReminderCheck({ ownerId, now } = {}) {
  const referenceDate = normalizeReferenceDate(now);
  const snapshot = await medicationRepository.snapshot();
  const pendingInsertions = [];

  for (const medication of snapshot.medications) {
    if (ownerId && medication.ownerId !== ownerId) {
      continue;
    }

    const existingOccurrenceKeys = new Set(
      (medication.reminders || []).map((reminder) => reminder.occurrenceKey)
    );
    const dueOccurrences = getDueOccurrences(medication, referenceDate, config.reminderDueWindowMinutes);

    for (const occurrence of dueOccurrences) {
      if (existingOccurrenceKeys.has(occurrence.occurrenceKey)) {
        continue;
      }

      const reminderMessage = await generateReminderMessage(
        {
          ...medication,
          dueAt: occurrence.dueAt,
          scheduledTime: occurrence.time,
        },
        null
      );

      pendingInsertions.push({
        medicationId: medication.id,
        ownerId: medication.ownerId,
        reminder: {
          id: randomUUID(),
          occurrenceKey: occurrence.occurrenceKey,
          dueAt: occurrence.dueAt,
          createdAt: referenceDate.toISOString(),
          deliveredAt: null,
          ...reminderMessage,
        },
      });
    }
  }

  if (!pendingInsertions.length) {
    await medicationRepository.update((store) => {
      for (const medication of store.medications) {
        pruneDeliveredReminders(medication, referenceDate);
      }

      return {
        queuedReminderCount: 0,
      };
    });

    return {
      checkedAt: referenceDate.toISOString(),
      queuedReminderCount: 0,
    };
  }

  return medicationRepository.update((store) => {
    let queuedReminderCount = 0;

    for (const medication of store.medications) {
      pruneDeliveredReminders(medication, referenceDate);
    }

    for (const pendingInsertion of pendingInsertions) {
      const medication = store.medications.find(
        (entry) => entry.id === pendingInsertion.medicationId && entry.ownerId === pendingInsertion.ownerId
      );

      if (!medication) {
        continue;
      }

      const alreadyQueued = medication.reminders.some(
        (reminder) => reminder.occurrenceKey === pendingInsertion.reminder.occurrenceKey
      );

      if (alreadyQueued) {
        continue;
      }

      medication.reminders.push(pendingInsertion.reminder);
      queuedReminderCount += 1;
    }

    return {
      checkedAt: referenceDate.toISOString(),
      queuedReminderCount,
    };
  });
}

export async function deliverPendingReminders(ownerId, now = new Date()) {
  const referenceDate = normalizeReferenceDate(now);

  return medicationRepository.update((store) => {
    const reminders = [];

    for (const medication of store.medications) {
      pruneDeliveredReminders(medication, referenceDate);

      if (medication.ownerId !== ownerId) {
        continue;
      }

      const pendingReminders = medication.reminders
        .filter((reminder) => !reminder.deliveredAt)
        .sort((left, right) => left.dueAt.localeCompare(right.dueAt));

      for (const reminder of pendingReminders) {
        reminder.deliveredAt = referenceDate.toISOString();
        reminders.push(buildReminderResponse(reminder, medication));
      }
    }

    reminders.sort((left, right) => left.dueAt.localeCompare(right.dueAt));

    return {
      checkedAt: referenceDate.toISOString(),
      reminders,
    };
  });
}

export async function triggerMedicationReminders(ownerId, nowOverride) {
  if (nowOverride && config.isProduction) {
    throw new AppError(
      400,
      'REMINDER_OVERRIDE_DISABLED',
      'Reminder time overrides are disabled in production environments.'
    );
  }

  const referenceDate = normalizeReferenceDate(nowOverride);
  await runReminderCheck({
    ownerId,
    now: referenceDate,
  });

  return deliverPendingReminders(ownerId, referenceDate);
}
