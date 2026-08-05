import request from 'supertest';

import { createApp } from '../src/app';

/** A fresh app per test keeps the in-memory store isolated between cases. */
const app = () => createApp();

describe('todo-api routes', () => {
  it('GET /health reports ok', async () => {
    await request(app()).get('/health').expect(200, { status: 'ok' });
  });

  it('POST /todos creates and answers 201', async () => {
    const response = await request(app())
      .post('/todos')
      .send({ title: 'Ship the feature', dueDate: '2026-02-01' })
      .expect(201);

    expect(response.body).toMatchObject({
      title: 'Ship the feature',
      status: 'todo',
      dueDate: '2026-02-01',
    });
  });

  it('POST /todos rejects a missing title with field details', async () => {
    const response = await request(app()).post('/todos').send({ notes: 'no title' }).expect(400);

    expect(response.body.error).toBe('Bad Request');
    expect(response.body.details).toContainEqual(
      expect.objectContaining({ path: 'title' }),
    );
  });

  it('POST /todos rejects a malformed dueDate', async () => {
    await request(app()).post('/todos').send({ title: 'x', dueDate: '01-02-2026' }).expect(400);
  });

  it('GET /todos/:id returns 404 for an unknown id', async () => {
    const response = await request(app()).get('/todos/does-not-exist').expect(404);

    expect(response.body.error).toBe('NotFoundError');
  });

  it('supports the full create → read → update → delete round trip', async () => {
    const server = app();

    const created = await request(server).post('/todos').send({ title: 'Round trip' }).expect(201);
    const { id } = created.body;

    await request(server).get(`/todos/${id}`).expect(200);

    const updated = await request(server)
      .patch(`/todos/${id}`)
      .send({ status: 'done' })
      .expect(200);
    expect(updated.body.status).toBe('done');

    await request(server).delete(`/todos/${id}`).expect(204);
    await request(server).get(`/todos/${id}`).expect(404);
  });

  it('PATCH /todos/:id rejects an empty body', async () => {
    const server = app();
    const created = await request(server).post('/todos').send({ title: 'x' }).expect(201);

    await request(server).patch(`/todos/${created.body.id}`).send({}).expect(400);
  });

  it('GET /todos paginates', async () => {
    const server = app();
    for (const title of ['one', 'two', 'three']) {
      await request(server).post('/todos').send({ title }).expect(201);
    }

    const response = await request(server).get('/todos?page=1&limit=2').expect(200);

    expect(response.body.items).toHaveLength(2);
    expect(response.body.total).toBe(3);
    expect(response.body.totalPages).toBe(2);
  });

  it('GET /todos rejects a limit above the maximum', async () => {
    await request(app()).get('/todos?limit=5000').expect(400);
  });

  it('unknown routes answer 404 as JSON', async () => {
    const response = await request(app()).get('/nope').expect(404);

    expect(response.body).toEqual({ error: 'Not Found', message: 'No such route' });
  });
});
