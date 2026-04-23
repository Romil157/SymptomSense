import { z } from 'zod';
import { ALLOWED_SEX_VALUES, normalizeSex, normalizeSymptomName, sanitizeFreeText } from '../utils/sanitizers.js';

export const patientSchema = z.object({
  age: z.coerce.number().int().min(0).max(120),
  sex: z
    .string()
    .transform((value) => normalizeSex(value))
    .refine((value) => ALLOWED_SEX_VALUES.includes(value), {
      message: 'Sex must be one of male, female, other, or prefer_not_to_say.',
    }),
});

export const symptomSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(120)
    .transform((value) => normalizeSymptomName(value)),
  severity: z.coerce.number().int().min(1).max(5),
  durationDays: z.coerce.number().int().min(0).max(365),
});

export const analyzeSymptomsSchema = z.object({
  patient: patientSchema,
  symptoms: z.array(symptomSchema).min(1).max(20),
});

export const aiInsightsSchema = z.object({
  patient: patientSchema,
  result: z.object({
    disease: z
      .string()
      .min(1)
      .max(160)
      .transform((value) => sanitizeFreeText(value, { maxLength: 160 })),
    confidence: z.coerce.number().min(0).max(1),
    confidenceLabel: z.enum(['High', 'Moderate', 'Low']),
    matchedSymptoms: z
      .array(
        z
          .string()
          .min(1)
          .max(120)
          .transform((value) => sanitizeFreeText(value, { maxLength: 120 }))
      )
      .max(20)
      .default([]),
    whySuggested: z
      .string()
      .min(1)
      .max(1200)
      .transform((value) => sanitizeFreeText(value, { maxLength: 1200 })),
  }),
  redFlags: z
    .array(
      z.object({
        symptom: z
          .string()
          .min(1)
          .max(120)
          .transform((value) => sanitizeFreeText(value, { maxLength: 120 })),
        reason: z
          .string()
          .min(1)
          .max(240)
          .transform((value) => sanitizeFreeText(value, { maxLength: 240 })),
      })
    )
    .max(10)
    .default([]),
});

const medicationEducationRedFlagSchema = z.object({
  symptom: z
    .string()
    .min(1)
    .max(120)
    .transform((value) => sanitizeFreeText(value, { maxLength: 120 })),
  reason: z
    .string()
    .min(1)
    .max(240)
    .transform((value) => sanitizeFreeText(value, { maxLength: 240 })),
});

export const medicationEducationSchema = z.object({
  disease: z
    .string()
    .min(1)
    .max(160)
    .transform((value) => sanitizeFreeText(value, { maxLength: 160 })),
  patient: patientSchema,
  redFlags: z.array(medicationEducationRedFlagSchema).max(10).default([]),
});
