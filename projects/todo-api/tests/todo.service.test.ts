import { NotFoundError } from '../src/errors';
import { InMemoryTodoRepository } from '../src/todo.repository';
import { TodoService } from '../src/todo.service';

/** Frozen clock: assertions on timestamps stay exact and the tests never sleep. */
const FIXED_NOW = new Date('2026-01-15T09:00:00.000Z');

function makeService() {
  return new TodoService(new InMemoryTodoRepository(), () => FIXED_NOW);
}

const baseInput = { title: 'Write tests', status: 'todo' as const };

describe('TodoService', () => {
  describe('create', () => {
    it('stores the todo and stamps both timestamps', async () => {
      const todo = await makeService().create(baseInput);

      expect(todo).toMatchObject({
        title: 'Write tests',
        status: 'todo',
        notes: null,
        dueDate: null,
        createdAt: FIXED_NOW.toISOString(),
        updatedAt: FIXED_NOW.toISOString(),
      });
      expect(todo.id).toEqual(expect.any(String));
    });

    it('normalises an omitted optional field to null', async () => {
      const todo = await makeService().create(baseInput);
      expect(todo.notes).toBeNull();
    });
  });

  describe('getById', () => {
    it('returns the stored todo', async () => {
      const service = makeService();
      const created = await service.create(baseInput);

      await expect(service.getById(created.id)).resolves.toEqual(created);
    });

    it('throws NotFoundError for an unknown id', async () => {
      await expect(makeService().getById('missing')).rejects.toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    it('applies only the fields that were sent', async () => {
      const service = makeService();
      const created = await service.create({ ...baseInput, notes: 'keep me' });

      const updated = await service.update(created.id, { status: 'done' });

      expect(updated.status).toBe('done');
      // The important assertion: an omitted field is untouched, not nulled.
      expect(updated.notes).toBe('keep me');
    });

    it('clears a field when null is sent explicitly', async () => {
      const service = makeService();
      const created = await service.create({ ...baseInput, notes: 'remove me' });

      const updated = await service.update(created.id, { notes: null });

      expect(updated.notes).toBeNull();
    });

    it('never changes the id', async () => {
      const service = makeService();
      const created = await service.create(baseInput);

      const updated = await service.update(created.id, { title: 'Renamed' });

      expect(updated.id).toBe(created.id);
    });

    it('throws NotFoundError for an unknown id', async () => {
      await expect(makeService().update('missing', { title: 'x' })).rejects.toThrow(NotFoundError);
    });
  });

  describe('delete', () => {
    it('removes the todo', async () => {
      const service = makeService();
      const created = await service.create(baseInput);

      await service.delete(created.id);

      await expect(service.getById(created.id)).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError when deleting twice', async () => {
      const service = makeService();
      const created = await service.create(baseInput);
      await service.delete(created.id);

      await expect(service.delete(created.id)).rejects.toThrow(NotFoundError);
    });
  });

  describe('list', () => {
    const query = { page: 1, limit: 20 };

    it('filters by status', async () => {
      const service = makeService();
      await service.create({ title: 'a', status: 'todo' });
      await service.create({ title: 'b', status: 'done' });

      const result = await service.list({ ...query, status: 'done' });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.title).toBe('b');
    });

    it('searches title and notes case-insensitively', async () => {
      const service = makeService();
      await service.create({ title: 'Buy MILK', status: 'todo' });
      await service.create({ title: 'Unrelated', notes: 'about milk too', status: 'todo' });
      await service.create({ title: 'Nothing', status: 'todo' });

      const result = await service.list({ ...query, q: 'milk' });

      expect(result.total).toBe(2);
    });

    it('paginates and reports the totals', async () => {
      const service = makeService();
      for (let i = 0; i < 5; i += 1) {
        await service.create({ title: `task ${i}`, status: 'todo' });
      }

      const result = await service.list({ page: 2, limit: 2 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(5);
      expect(result.totalPages).toBe(3);
    });

    it('reports one page when there is nothing to show', async () => {
      // Guards the pagination maths: 0 items must not produce 0 pages, which
      // would render as "page 1 of 0".
      const result = await makeService().list(query);

      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(1);
    });
  });
});
