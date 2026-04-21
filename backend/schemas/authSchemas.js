import { z } from 'zod';
import { sanitizeFreeText } from '../utils/sanitizers.js';

export const loginSchema = z.object({
  email: z
    .string()
    .email()
    .transform((value) => sanitizeFreeText(value, { maxLength: 120 }).toLowerCase()),
  password: z.string().min(8).max(128),
});
