import { z } from 'zod';

// Auth validation schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one lowercase letter, one uppercase letter, and one number',
    ),
  name: z.string().min(2).max(100).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  avatarUrl: z.string().url().optional(),
});

// Book search params
export const bookSearchSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  format: z.enum(['paper', 'ebook', 'audiobook']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// User book actions
export const userBookSchema = z.object({
  bookId: z.string().uuid(),
  status: z.enum(['want_to_read', 'reading', 'read']),
});

export const updateUserBookSchema = z.object({
  status: z.enum(['want_to_read', 'reading', 'read']).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  review: z.string().max(5000).optional(),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
});

// Type exports
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type BookSearchParams = z.infer<typeof bookSearchSchema>;
export type UserBookInput = z.infer<typeof userBookSchema>;
export type UpdateUserBookInput = z.infer<typeof updateUserBookSchema>;
