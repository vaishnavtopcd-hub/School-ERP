import { z } from 'zod';

export const TODO_STATUSES = ['todo', 'in_progress', 'done'] as const;
export type TodoStatus = (typeof TODO_STATUSES)[number];

export interface Todo {
  id: string;
  title: string;
  notes: string | null;
  status: TodoStatus;
  /** Null means "no deadline", which is different from an overdue empty string. */
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Validation lives in one place and the request types are derived from it, so
 * the checks and the types can never drift apart.
 */
export const createTodoSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(200),
  notes: z.string().trim().max(2000).nullish(),
  status: z.enum(TODO_STATUSES).default('todo'),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'dueDate must be YYYY-MM-DD')
    .nullish(),
});

/** Every field optional, but at least one must be present — an empty PATCH is
 *  a caller mistake worth reporting rather than a silent no-op. */
export const updateTodoSchema = createTodoSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Provide at least one field to update',
  });

export const listTodosSchema = z.object({
  status: z.enum(TODO_STATUSES).optional(),
  q: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;
export type ListTodosQuery = z.infer<typeof listTodosSchema>;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
