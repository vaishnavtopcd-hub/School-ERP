import request from 'supertest';

import { createApp } from '../src/app';
import { LinkService } from '../src/link.service';

const URL = 'https://example.com/target';

describe('url-shortener routes', () => {
  it('GET /health reports ok', async () => {
    await request(createApp()).get('/health').expect(200, { status: 'ok' });
  });

  it('POST /links returns 201 with an absolute short URL', async () => {
    const response = await request(createApp({ baseUrl: 'https://sho.rt' }))
      .post('/links')
      .send({ url: URL })
      .expect(201);

    expect(response.body.shortUrl).toBe(`https://sho.rt/${response.body.code}`);
    expect(response.body.expiresAt).toBeNull();
  });

  it('POST /links rejects a non-http URL', async () => {
    await request(createApp()).post('/links').send({ url: 'javascript:alert(1)' }).expect(400);
  });

  it('POST /links rejects a missing url', async () => {
    await request(createApp()).post('/links').send({}).expect(400);
  });

  it('GET /:code redirects with 302', async () => {
    const app = createApp();
    const created = await request(app).post('/links').send({ url: URL }).expect(201);

    const response = await request(app).get(`/${created.body.code}`).expect(302);

    expect(response.headers.location).toBe(URL);
  });

  it('GET /:code answers 404 for an unknown code', async () => {
    await request(createApp()).get('/missing').expect(404);
  });

  it('GET /:code answers 410 for an expired link', async () => {
    let now = new Date('2026-01-15T09:00:00.000Z');
    const service = new LinkService(() => now);
    const app = createApp({ service });

    const created = await request(app).post('/links').send({ url: URL, ttlSeconds: 30 });
    now = new Date(now.getTime() + 31_000);

    await request(app).get(`/${created.body.code}`).expect(410);
  });

  it('GET /links/:code/stats counts redirects but not itself', async () => {
    const app = createApp();
    const created = await request(app).post('/links').send({ url: URL }).expect(201);
    const { code } = created.body;

    await request(app).get(`/${code}`).expect(302);
    await request(app).get(`/${code}`).expect(302);

    const stats = await request(app).get(`/links/${code}/stats`).expect(200);

    expect(stats.body).toMatchObject({ hits: 2, url: URL, expired: false });
  });

  it('does not let the catch-all route shadow /health', async () => {
    // /:code is registered last precisely so this stays true.
    await request(createApp()).get('/health').expect(200);
  });
});
