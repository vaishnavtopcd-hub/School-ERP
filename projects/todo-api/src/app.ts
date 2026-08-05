import express, { type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';

import { AppError } from './errors';
import { InMemoryTodoRepository, type TodoRepository } from './todo.repository';
import { TodoService } from './todo.service';
import { createTodoSchema, listTodosSchema, updateTodoSchema } from './todo.types';

/**
 * Wraps an async handler so a rejected promise reaches the error middleware.
 * Express 4 does not do this itself, and an unhandled rejection would
 * otherwise hang the request instead of returning 500.
 *
 * Generic over the route params so `:id` types as `string` rather than
 * `string | undefined` — `noUncheckedIndexedAccess` is on, and naming the
 * params is more honest than asserting the value is there.
 */
const wrap =
  <P extends Record<string, string>>(
    handler: (req: Request<P>, res: Response) => Promise<unknown>,
  ) =>
  (req: Request<P>, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next);
  };

export interface AppOptions {
  repository?: TodoRepository;
}

export function createApp({ repository = new InMemoryTodoRepository() }: AppOptions = {}) {
  const service = new TodoService(repository);
  const app = express();

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get(
    '/todos',
    wrap(async (req, res) => {
      const query = listTodosSchema.parse(req.query);
      res.json(await service.list(query));
    }),
  );

  app.get(
    '/todos/:id',
    wrap<{ id: string }>(async (req, res) => {
      res.json(await service.getById(req.params.id));
    }),
  );

  app.post(
    '/todos',
    wrap(async (req, res) => {
      const body = createTodoSchema.parse(req.body);
      res.status(201).json(await service.create(body));
    }),
  );

  app.patch(
    '/todos/:id',
    wrap<{ id: string }>(async (req, res) => {
      const body = updateTodoSchema.parse(req.body);
      res.json(await service.update(req.params.id, body));
    }),
  );

  app.delete(
    '/todos/:id',
    wrap<{ id: string }>(async (req, res) => {
      await service.delete(req.params.id);
      res.status(204).end();
    }),
  );

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not Found', message: 'No such route' });
  });

  /**
   * One place that turns errors into responses. Zod failures become 400s with
   * the offending fields; anything unrecognised is logged and reported as 500
   * without leaking a stack trace to the caller.
   */
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'The request is invalid',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }

    if (error instanceof AppError) {
      res.status(error.status).json({
        error: error.name,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      });
      return;
    }

    console.error('Unhandled error', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Something went wrong' });
  });

  return app;
}
