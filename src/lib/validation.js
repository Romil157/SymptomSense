import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must contain at least 8 characters.'),
});

export const patientSchema = z.object({
  age: z.coerce
    .number()
    .int('Age must be a whole number.')
    .min(0, 'Age cannot be negative.')
    .max(120, 'Age must be 120 or less.'),
  sex: z.enum(['male', 'female', 'other', 'prefer_not_to_say'], {
    message: 'Select a biological sex value.',
  }),
});

export const symptomSelectionSchema = z
  .array(
    z.object({
      name: z.string().min(1),
      severity: z.number().int().min(1).max(5),
      durationDays: z.number().int().min(0).max(365),
    })
  )
  .min(1, 'Select at least one symptom before running analysis.')
  .max(20, 'A maximum of 20 symptoms can be analyzed at once.');

export function validateForm(schema, payload) {
  const result = schema.safeParse(payload);

  if (result.success) {
    return {
      success: true,
      data: result.data,
      errors: {},
    };
  }

  const flattened = result.error.flatten().fieldErrors;
  const errors = Object.fromEntries(
    Object.entries(flattened).map(([field, messages]) => [field, messages?.[0] || 'Invalid value.'])
  );

  return {
    success: false,
    data: null,
    errors,
  };
}
