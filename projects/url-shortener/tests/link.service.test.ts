import { AppError, LinkService } from '../src/link.service';

/** A clock the test moves by hand, so expiry is exercised without waiting. */
function makeClock(start = new Date('2026-01-15T09:00:00.000Z')) {
  let current = start;
  return {
    now: () => current,
    advanceSeconds: (seconds: number) => {
      current = new Date(current.getTime() + seconds * 1000);
    },
  };
}

const URL = 'https://example.com/a/very/long/path?with=query';

describe('LinkService', () => {
  describe('create', () => {
    it('returns a short code and echoes the URL', () => {
      const link = new LinkService().create(URL);

      expect(link.url).toBe(URL);
      expect(link.code.length).toBeGreaterThan(0);
      expect(link.hits).toBe(0);
      expect(link.expiresAt).toBeNull();
    });

    it('issues a different code for each link', () => {
      const service = new LinkService();
      const codes = new Set([1, 2, 3, 4, 5].map(() => service.create(URL).code));

      expect(codes.size).toBe(5);
    });

    it('sets expiresAt from the ttl', () => {
      const clock = makeClock();
      const link = new LinkService(clock.now).create(URL, 60);

      expect(link.expiresAt?.toISOString()).toBe('2026-01-15T09:01:00.000Z');
    });

    it.each([
      ['javascript:alert(1)', 'a script URL'],
      ['data:text/html,<script>', 'a data URL'],
      ['ftp://example.com', 'a non-http protocol'],
      ['/relative/path', 'a relative path'],
      ['not a url', 'plain text'],
      ['', 'an empty string'],
    ])('rejects %s (%s)', (input) => {
      expect(() => new LinkService().create(input)).toThrow(AppError);
    });

    it('rejects a non-positive ttl', () => {
      expect(() => new LinkService().create(URL, 0)).toThrow(AppError);
      expect(() => new LinkService().create(URL, -5)).toThrow(AppError);
    });
  });

  describe('resolve', () => {
    it('returns the original URL', () => {
      const service = new LinkService();
      const { code } = service.create(URL);

      expect(service.resolve(code).url).toBe(URL);
    });

    it('counts each visit', () => {
      const service = new LinkService();
      const { code } = service.create(URL);

      service.resolve(code);
      service.resolve(code);

      expect(service.stats(code).hits).toBe(2);
    });

    it('throws 404 for an unknown code', () => {
      expect(() => new LinkService().resolve('nope')).toThrow(
        expect.objectContaining({ status: 404 }),
      );
    });

    it('throws 410 once the ttl has passed', () => {
      const clock = makeClock();
      const service = new LinkService(clock.now);
      const { code } = service.create(URL, 60);

      clock.advanceSeconds(61);

      // 410, not 404: "existed and lapsed" is different from "never existed".
      expect(() => service.resolve(code)).toThrow(expect.objectContaining({ status: 410 }));
    });

    it('still resolves one second before expiry', () => {
      const clock = makeClock();
      const service = new LinkService(clock.now);
      const { code } = service.create(URL, 60);

      clock.advanceSeconds(59);

      expect(service.resolve(code).url).toBe(URL);
    });

    it('expires exactly at the boundary', () => {
      const clock = makeClock();
      const service = new LinkService(clock.now);
      const { code } = service.create(URL, 60);

      clock.advanceSeconds(60);

      expect(() => service.resolve(code)).toThrow(expect.objectContaining({ status: 410 }));
    });
  });

  describe('stats', () => {
    it('does not count as a hit', () => {
      const service = new LinkService();
      const { code } = service.create(URL);

      service.stats(code);
      service.stats(code);

      // Measuring must not change the measurement.
      expect(service.stats(code).hits).toBe(0);
    });

    it('reports an expired link rather than throwing', () => {
      const clock = makeClock();
      const service = new LinkService(clock.now);
      const { code } = service.create(URL, 30);

      clock.advanceSeconds(31);

      expect(service.stats(code).expired).toBe(true);
    });

    it('throws 404 for an unknown code', () => {
      expect(() => new LinkService().stats('nope')).toThrow(
        expect.objectContaining({ status: 404 }),
      );
    });
  });
});
