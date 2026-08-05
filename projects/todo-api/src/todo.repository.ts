import { randomUUID } from 'node:crypto';

import type { ListTodosQuery, Paginated, Todo } from './todo.types';

/**
 * The storage contract.
 *
 * The service depends on this interface rather than on the in-memory class, so
 * swapping in Postgres later is a new implementation and no service changes.
 */
export interface TodoRepository {
  findAll(query: ListTodosQuery): Promise<Paginated<Todo>>;
  findById(id: string): Promise<Todo | null>;
  create(todo: Omit<Todo, 'id'>): Promise<Todo>;
  update(id: string, patch: Partial<Omit<Todo, 'id'>>): Promise<Todo | null>;
  delete(id: string): Promise<boolean>;
}

/**
 * In-memory implementation — enough to run and test the API without a
 * database. A Map keeps lookup by id O(1); listing sorts a copy so the stored
 * order is never mutated by a read.
 */
export class InMemoryTodoRepository implements TodoRepository {
  private readonly todos = new Map<string, Todo>();

  async findAll(query: ListTodosQuery): Promise<Paginated<Todo>> {
    let rows = [...this.todos.values()];

    if (query.status) {
      rows = rows.filter((todo) => todo.status === query.status);
    }

    if (query.q) {
      const needle = query.q.toLowerCase();
      rows = rows.filter(
        (todo) =>
          todo.title.toLowerCase().includes(needle) ||
          (todo.notes?.toLowerCase().includes(needle) ?? false),
      );
    }

    // Newest first: the useful default for a task list.
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const total = rows.length;
    const start = (query.page - 1) * query.limit;

    return {
      items: rows.slice(start, start + query.limit),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  async findById(id: string): Promise<Todo | null> {
    return this.todos.get(id) ?? null;
  }

  async create(todo: Omit<Todo, 'id'>): Promise<Todo> {
    const created: Todo = { ...todo, id: randomUUID() };
    this.todos.set(created.id, created);
    return created;
  }

  async update(id: string, patch: Partial<Omit<Todo, 'id'>>): Promise<Todo | null> {
    const existing = this.todos.get(id);
    if (!existing) return null;

    const updated: Todo = { ...existing, ...patch, id };
    this.todos.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.todos.delete(id);
  }
}
