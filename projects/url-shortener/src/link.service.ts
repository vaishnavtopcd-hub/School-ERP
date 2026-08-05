import { encodeBase62 } from './base62';

export interface Link {
  code: string;
  url: string;
  createdAt: Date;
  /** Null means the link never expires. */
  expiresAt: Date | null;
  hits: number;
}

export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Injected so expiry can be tested by moving the clock, not by waiting. */
export type Clock = () => Date;

/**
 * Codes start well above zero so the first link is not `1`.
 *
 * This is obfuscation, not security — see the README. It only stops the most
 * casual "what's link number two?" poking.
 */
const CODE_OFFSET = 100_000;

const MAX_URL_LENGTH = 2048;

export class LinkService {
  private readonly byCode = new Map<string, Link>();
  private counter = 0;

  constructor(private readonly now: Clock = () => new Date()) {}

  create(rawUrl: string, ttlSeconds?: number): Link {
    const url = this.validateUrl(rawUrl);

    if (ttlSeconds !== undefined && (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0)) {
      throw new AppError('ttlSeconds must be a positive number', 400);
    }

    const createdAt = this.now();
    const code = encodeBase62(CODE_OFFSET + this.counter);
    this.counter += 1;

    const link: Link = {
      code,
      url,
      createdAt,
      expiresAt: ttlSeconds ? new Date(createdAt.getTime() + ttlSeconds * 1000) : null,
      hits: 0,
    };

    this.byCode.set(code, link);
    return link;
  }

  /**
   * Resolves a code for redirection and counts the visit.
   *
   * An expired link answers 410 rather than 404 on purpose: the distinction
   * between "never existed" and "existed and lapsed" is useful to a caller,
   * and the record is kept so the stats endpoint can still explain it.
   */
  resolve(code: string): Link {
    const link = this.byCode.get(code);
    if (!link) throw new AppError(`No link with code "${code}"`, 404);

    if (this.isExpired(link)) {
      throw new AppError('This link has expired', 410);
    }

    link.hits += 1;
    return link;
  }

  /** Stats deliberately do **not** count as a hit, or measuring would change
   *  the measurement. */
  stats(code: string): Link & { expired: boolean } {
    const link = this.byCode.get(code);
    if (!link) throw new AppError(`No link with code "${code}"`, 404);

    return { ...link, expired: this.isExpired(link) };
  }

  private isExpired(link: Link): boolean {
    return link.expiresAt !== null && link.expiresAt.getTime() <= this.now().getTime();
  }

  /**
   * Only absolute http(s) URLs are accepted.
   *
   * Without the protocol check a shortener will happily store `javascript:` or
   * `data:` URLs and hand them back under a trusted-looking domain, which turns
   * it into a redirect gadget for phishing.
   */
  private validateUrl(rawUrl: string): string {
    if (typeof rawUrl !== 'string' || rawUrl.trim() === '') {
      throw new AppError('url is required', 400);
    }

    if (rawUrl.length > MAX_URL_LENGTH) {
      throw new AppError(`url must be ${MAX_URL_LENGTH} characters or fewer`, 400);
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new AppError('url must be an absolute URL', 400);
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new AppError('Only http and https URLs can be shortened', 400);
    }

    return parsed.toString();
  }
}
