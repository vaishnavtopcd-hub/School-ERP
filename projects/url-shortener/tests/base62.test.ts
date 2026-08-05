import { decodeBase62, encodeBase62 } from '../src/base62';

describe('base62', () => {
  it.each([
    [0, '0'],
    [1, '1'],
    [61, 'z'],
    [62, '10'],
    [3843, 'zz'],
    [3844, '100'],
  ])('encodes %i as "%s"', (value, expected) => {
    expect(encodeBase62(value)).toBe(expected);
  });

  it('round-trips every value across a base boundary', () => {
    // 60..64 straddles the single/double digit rollover, where an off-by-one
    // in the loop would show up.
    for (let value = 60; value <= 64; value += 1) {
      expect(decodeBase62(encodeBase62(value))).toBe(value);
    }
  });

  it('round-trips a large value', () => {
    expect(decodeBase62(encodeBase62(123_456_789))).toBe(123_456_789);
  });

  it('produces a distinct code for every input in a range', () => {
    const codes = new Set<string>();
    for (let value = 0; value < 5000; value += 1) {
      codes.add(encodeBase62(value));
    }
    // Uniqueness is the property the whole design rests on.
    expect(codes.size).toBe(5000);
  });

  it('rejects a negative number', () => {
    expect(() => encodeBase62(-1)).toThrow(RangeError);
  });

  it('rejects a non-integer', () => {
    expect(() => encodeBase62(1.5)).toThrow(RangeError);
  });

  it('rejects a character outside the alphabet', () => {
    expect(() => decodeBase62('abc!')).toThrow(RangeError);
  });

  it('rejects an empty string', () => {
    expect(() => decodeBase62('')).toThrow(RangeError);
  });
});
