import { describe, expect, it } from 'vitest';

import { centreOffset, clampOffset, coverScale, cropRect, offsetForZoom } from './avatar';

/**
 * The crop dialog's geometry. Encoding itself is untestable here — jsdom has no
 * canvas — so this covers the part where a mistake would silently produce a
 * wrongly framed avatar rather than an error.
 *
 * Throughout: a 300px square viewport, and a 1200x600 landscape image.
 */
const VIEW = 300;
const WIDE = { width: 1200, height: 600 };
const TALL = { width: 600, height: 1200 };

describe('coverScale', () => {
  it('fills the viewport from the shorter edge', () => {
    // 600 is the short edge, so it must scale up to 300.
    expect(coverScale(VIEW, WIDE.width, WIDE.height)).toBe(0.5);
    expect(coverScale(VIEW, TALL.width, TALL.height)).toBe(0.5);
  });

  it('scales up when the image is smaller than the viewport', () => {
    expect(coverScale(VIEW, 150, 150)).toBe(2);
  });
});

describe('centreOffset', () => {
  it('centres the overflowing axis and leaves the fitted one at zero', () => {
    const scale = coverScale(VIEW, WIDE.width, WIDE.height);
    // Scaled to 600x300: 300px of overflow horizontally, none vertically.
    expect(centreOffset(VIEW, WIDE.width, WIDE.height, scale)).toEqual({ x: -150, y: 0 });
  });
});

describe('clampOffset', () => {
  const scale = coverScale(VIEW, WIDE.width, WIDE.height);

  it('allows panning within the overflow', () => {
    expect(clampOffset({ x: -100, y: 0 }, VIEW, WIDE.width, WIDE.height, scale)).toEqual({
      x: -100,
      y: 0,
    });
  });

  it('stops at the leading edge rather than revealing a gap', () => {
    expect(clampOffset({ x: 80, y: 40 }, VIEW, WIDE.width, WIDE.height, scale)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('stops at the trailing edge', () => {
    // Scaled width is 600, so the furthest left the image may sit is -300.
    expect(clampOffset({ x: -900, y: 0 }, VIEW, WIDE.width, WIDE.height, scale)).toEqual({
      x: -300,
      y: 0,
    });
  });
});

describe('offsetForZoom', () => {
  it('keeps the point under the viewport centre fixed', () => {
    const from = 0.5;
    const to = 1;
    // Centred: the image pixel under the centre is x = (150 - -150) / 0.5 = 600.
    const next = offsetForZoom({ x: -150, y: 0 }, VIEW, from, to);
    // That same pixel must still land on the centre at the new scale.
    expect(150 - next.x).toBeCloseTo(600 * to);
    expect(next.x).toBeCloseTo(-450);
  });

  it('is a no-op when the scale does not change', () => {
    const offset = { x: -120, y: -30 };
    expect(offsetForZoom(offset, VIEW, 0.5, 0.5)).toEqual(offset);
  });
});

describe('cropRect', () => {
  it('maps a centred, unzoomed view to the full shorter edge', () => {
    const scale = coverScale(VIEW, WIDE.width, WIDE.height);
    const offset = centreOffset(VIEW, WIDE.width, WIDE.height, scale);

    // The square taken is the full 600px height, centred across the width.
    expect(cropRect(VIEW, offset, scale)).toEqual({ x: 300, y: 0, size: 600 });
  });

  it('shrinks the source square as zoom increases', () => {
    const scale = coverScale(VIEW, WIDE.width, WIDE.height) * 2;
    const offset = centreOffset(VIEW, WIDE.width, WIDE.height, scale);

    const rect = cropRect(VIEW, offset, scale);
    expect(rect.size).toBe(300);
    // Still centred on the same point as the unzoomed crop.
    expect(rect.x + rect.size / 2).toBe(600);
    expect(rect.y + rect.size / 2).toBe(300);
  });

  it('tracks panning to the trailing edge', () => {
    const scale = coverScale(VIEW, WIDE.width, WIDE.height);
    const offset = clampOffset({ x: -9999, y: 0 }, VIEW, WIDE.width, WIDE.height, scale);

    // Hard right: the crop must end exactly on the image's right edge.
    const rect = cropRect(VIEW, offset, scale);
    expect(rect.x + rect.size).toBe(WIDE.width);
  });
});
