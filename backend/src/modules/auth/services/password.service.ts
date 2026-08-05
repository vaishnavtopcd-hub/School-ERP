import { Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Password hashing, isolated so the algorithm and its parameters can be changed
 * in one place.
 *
 * Argon2id with these parameters is the OWASP-recommended baseline: 19 MiB of
 * memory and 2 iterations. Memory cost is what makes GPU cracking expensive —
 * raise it before raising iterations if you have headroom.
 */
@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);

  private readonly options: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  };

  /**
   * A hash of a throwaway value, used to burn comparable CPU time when the
   * account doesn't exist — see verifyDummy().
   */
  private dummyHash: string | null = null;

  async hash(plain: string): Promise<string> {
    return argon2.hash(plain, this.options);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch (error) {
      // A malformed or truncated hash in the database — treat as a failed
      // login rather than a 500, but make sure it is visible in the logs.
      this.logger.error('Password verification failed to run', error as Error);
      return false;
    }
  }

  /**
   * Spends roughly the same time as a real verification. Called on the
   * "no such user" path so response timing doesn't reveal which emails are
   * registered.
   */
  async verifyDummy(plain: string): Promise<false> {
    this.dummyHash ??= await this.hash('argon2-timing-equalisation-placeholder');
    await this.verify(this.dummyHash, plain);
    return false;
  }

  /**
   * True when a stored hash was produced with weaker parameters than the
   * current policy, so it should be re-hashed on the next successful login.
   */
  needsRehash(hash: string): boolean {
    try {
      return argon2.needsRehash(hash, this.options);
    } catch {
      return true;
    }
  }
}
