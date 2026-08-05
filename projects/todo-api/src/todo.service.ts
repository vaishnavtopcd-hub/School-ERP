import { NotFoundError } from './errors';
import type { TodoRepository } from './todo.repository';
import type {
  CreateTodoInput,
  ListTodosQuery,
  Paginated,
  Todo,
  UpdateTodoInput,
} from './todo.types';

/** Injected so tests can freeze time instead of sleeping. */
export type Clock = () => Date;

/**
 * Business rules for todos.
 *
 * Knows nothing about HTTP: it takes validated input and throws domain errors.
 * That is what lets the service tests run without starting a server.
 */
export class TodoService {
  constructor(
    private readonly repository: TodoRepository,
    private readonly now: Clock = () => new Date(),
  ) {}

  async list(query: ListTodosQuery): Promise<Paginated<Todo>> {
    return this.repository.findAll(query);
  }

  async getById(id: string): Promise<Todo> {
    const todo = await this.repository.findById(id);
    if (!todo) throw new NotFoundError('Todo', id);
    return todo;
  }

  async create(input: CreateTodoInput): Promise<Todo> {
    const timestamp = this.now().toISOString();

    return this.repository.create({
      title: input.title,
      // The schema allows undefined (absent) and null (explicitly cleared);
      // storage keeps one representation for "no value".
      notes: input.notes ?? null,
      status: input.status,
      dueDate: input.dueDate ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  async update(id: string, input: UpdateTodoInput): Promise<Todo> {
    // Only the keys the caller actually sent are applied, so a PATCH that
    // omits `notes` leaves the stored notes alone rather than nulling them.
    const patch: Partial<Omit<Todo, 'id'>> = { updatedAt: this.now().toISOString() };

    if (input.title !== undefined) patch.title = input.title;
    if (input.status !== undefined) patch.status = input.status;
    if (input.notes !== undefined) patch.notes = input.notes ?? null;
    if (input.dueDate !== undefined) patch.dueDate = input.dueDate ?? null;

    const updated = await this.repository.update(id, patch);
    if (!updated) throw new NotFoundError('Todo', id);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) throw new NotFoundError('Todo', id);
  }
}
