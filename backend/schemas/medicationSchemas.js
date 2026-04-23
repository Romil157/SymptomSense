import { z } from 'zod';
import { sanitizeFreeText } from '../utils/sanitizers.js';

const medicationTimePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function validateTimeZone(value) {
  if (!value) {
    return true;
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export const medicationScheduleSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(120)
    .transform((value) => sanitizeFreeText(value, { maxLength: 120 })),
  dosage: z
    .string()
    .min(1)
    .max(80)
    .transform((value) => sanitizeFreeText(value, { maxLength: 80 })),
  frequency: z
    .string()
    .min(1)
    .max(40)
    .transform((value) => sanitizeFreeText(value, { maxLength: 40 })),
  times: z
    .array(z.string().regex(medicationTimePattern, 'Times must use 24-hour HH:MM format.'))
    .min(1)
    .max(4)
    .refine((times) => new Set(times).size === times.length, {
      message: 'Medication times must be unique.',
    }),
  durationDays: z.coerce.number().int().min(1).max(365),
  timezone: z
    .string()
    .min(1)
    .max(120)
    .optional()
    .refine((value) => validateTimeZone(value), {
      message: 'Timezone must be a valid IANA timezone identifier.',
    }),
});

export const medicationIdParamSchema = z.object({
  medicationId: z.string().uuid('Medication id must be a valid UUID.'),
});

export const reminderTriggerSchema = z
  .object({
    now: z.string().min(1).optional(),
  })
  .default({});
