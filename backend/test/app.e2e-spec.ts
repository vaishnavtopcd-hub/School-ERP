import { type INestApplication, VersioningType } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { type App } from 'supertest/types';

import { AppModule } from '../src/app.module';

interface Envelope<T> {
  success: boolean;
  data: T;
  statusCode?: number;
  timestamp: string;
  path: string;
}

/**
 * Requires a reachable database (`docker compose up -d postgres`), since
 * AppModule connects Prisma on init.
 */
describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<INestApplication<App>>();
    // Mirrors the bootstrap in src/main.ts.
    app.setGlobalPrefix('api', { exclude: ['health/live', 'health/ready'] });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the liveness probe unauthenticated, outside the prefix and version', async () => {
    const response = await request(app.getHttpServer()).get('/health/live').expect(200);
    const body = response.body as Envelope<{ status: string }>;
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ok');
  });

  it('reports readiness once the database answers', async () => {
    const response = await request(app.getHttpServer()).get('/health/ready').expect(200);
    const body = response.body as Envelope<{ status: string }>;
    expect(body.data.status).toBe('ok');
  });

  it('returns the standard error envelope for unknown routes', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/nope').expect(404);
    const body = response.body as Envelope<never>;
    expect(body.success).toBe(false);
    expect(body.statusCode).toBe(404);
    expect(body.timestamp).toEqual(expect.any(String));
  });

  it('stamps a correlation id on every response', async () => {
    const response = await request(app.getHttpServer()).get('/health/live');
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });
});
