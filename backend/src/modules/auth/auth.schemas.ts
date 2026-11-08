import { z } from 'zod';

export const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ message: 'Invalid email address' }).max(254)),
  username: z
    .string()
    .trim()
    .regex(USERNAME_PATTERN, 'Username must be 3-20 characters: letters, digits or underscore'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  /** E-mail address or username. */
  login: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1).max(512),
});
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
