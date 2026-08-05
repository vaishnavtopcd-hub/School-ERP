import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AvatarCropDialog } from './AvatarCropDialog';
import type { AvatarSource } from '../utils/avatar';

/**
 * Regression cover for a blank crop viewport.
 *
 * MUI's Portal renders `null` on the commit where a dialog opens and mounts its
 * children only on a second render. An effect that read the viewport ref on the
 * first commit saw `null`, never re-ran, and left the measured width at 0 —
 * which makes the image's scale 0, so it renders at zero size and the crop area
 * looks empty. jsdom has no layout, so the measurement necessarily comes from
 * the ResizeObserver here, which is the same path the browser takes.
 */

const VIEWPORT = 300;

class StubResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(): void {
    // Real observers fire once on observe; that initial delivery is exactly
    // what has to reach the component for it to size itself.
    this.callback(
      [{ contentRect: { width: VIEWPORT } } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }

  unobserve(): void {}
  disconnect(): void {}
}

function makeSource(width: number, height: number): AvatarSource {
  return {
    canvas: document.createElement('canvas'),
    url: 'blob:stub-avatar',
    width,
    height,
  };
}

/** Pulls the numeric scale out of `translate(...) scale(n)`. */
function scaleOf(element: HTMLElement): number {
  const match = /scale\(([-\d.]+)\)/.exec(element.style.transform);
  return match ? Number(match[1]) : Number.NaN;
}

describe('AvatarCropDialog', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', StubResizeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the image at a visible scale once the viewport is measured', () => {
    render(
      <AvatarCropDialog
        open
        source={makeSource(1200, 600)}
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    );

    const image = document.querySelector('img');
    expect(image).not.toBeNull();

    // The bug produced scale(0). Cover scale here is 300/600 = 0.5.
    expect(scaleOf(image as HTMLElement)).toBeCloseTo(0.5);
  });

  it('scales a portrait image from its shorter edge too', () => {
    render(
      <AvatarCropDialog
        open
        source={makeSource(600, 2400)}
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    );

    // Short edge is the width: 300/600 = 0.5.
    expect(scaleOf(document.querySelector('img') as HTMLElement)).toBeCloseTo(0.5);
  });

  it('enables the confirm button once measured', () => {
    render(
      <AvatarCropDialog
        open
        source={makeSource(800, 800)}
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    );

    // Gated on `view`, so an unmeasured viewport left this stuck disabled.
    expect(screen.getByRole('button', { name: 'Use photo' })).toBeEnabled();
  });
});
