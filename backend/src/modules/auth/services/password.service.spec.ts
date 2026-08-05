import * as argon2 from 'argon2';

import { PasswordService } from './password.service';

/** Exercises real Argon2 — no mocking, so the parameters are genuinely verified. */
describe('PasswordService', () => {
  const service = new PasswordService();
  const plain = 'Str0ng!Passw0rd';

  it('produces an argon2id hash, not the weaker variants', async () => {
    const hash = await service.hash(plain);
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('never stores the password in the hash', async () => {
    const hash = await service.hash(plain);
    expect(hash).not.toContain(plain);
  });

  it('salts, so the same password hashes differently every time', async () => {
    const [a, b] = await Promise.all([service.hash(plain), service.hash(plain)]);
    expect(a).not.toBe(b);
  });

  it('verifies a correct password', async () => {
    const hash = await service.hash(plain);
    await expect(service.verify(hash, plain)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await service.hash(plain);
    await expect(service.verify(hash, 'Wr0ng!Passw0rd')).resolves.toBe(false);
  });

  it('returns false rather than throwing on a corrupted hash', async () => {
    await expect(service.verify('not-a-hash', plain)).resolves.toBe(false);
  });

  it('flags hashes made with weaker parameters for upgrade', async () => {
    // 8 MiB instead of the policy's 19 MiB. (timeCost cannot go below 2 —
    // argon2 rejects it — so memory cost is the dimension to weaken here.)
    const weak = await argon2.hash(plain, {
      type: argon2.argon2id,
      memoryCost: 8192,
      timeCost: 2,
      parallelism: 1,
    });
    expect(service.needsRehash(weak)).toBe(true);
  });

  it('leaves hashes at current parameters alone', async () => {
    const current = await service.hash(plain);
    expect(service.needsRehash(current)).toBe(false);
  });

  it('verifyDummy always fails but still does the work', async () => {
    await expect(service.verifyDummy(plain)).resolves.toBe(false);
  });
});
