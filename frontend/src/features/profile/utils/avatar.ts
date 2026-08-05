/**
 * Avatar encoding, in the browser.
 *
 * The API stores the avatar inline on the user row, so the client is what keeps
 * it small — nothing server-side re-encodes it. This is a two-step flow:
 * `prepareAvatarSource` normalises a picked file into a working image, the crop
 * dialog lets the user frame it, and `cropToAvatarDataUrl` renders the chosen
 * square down to the size that is actually stored.
 */

/** Rendered at 26-96px; 256 keeps it crisp on high-DPI screens without waste. */
const AVATAR_SIZE = 256;

/**
 * Longest side of the working image the cropper pans around.
 *
 * Capped because the source is held in memory and drawn on every frame, and
 * because cropping down to 256px cannot benefit from more detail than this.
 */
const MAX_WORKING_SIDE = 1200;

/** Mirrors `MAX_AVATAR_DATA_URL_LENGTH` in the backend's profile DTO. */
export const MAX_AVATAR_DATA_URL_LENGTH = 256_000;

/** Guards against decoding something enormous before we ever downscale it. */
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;

/** Quality ladder walked downwards until the encoded result fits. */
const QUALITY_STEPS = [0.85, 0.7, 0.55, 0.4];

export class AvatarError extends Error {}

/**
 * A picked image, normalised for cropping: EXIF rotation already applied and
 * the longest side capped, so what the dialog previews and what gets cropped
 * are the same pixels.
 */
export interface AvatarSource {
  /** Draw source for the crop. */
  canvas: HTMLCanvasElement;
  /** Object URL of the same image, for use as an `<img src>`. */
  url: string;
  width: number;
  height: number;
}

/**
 * `toDataURL` silently falls back to PNG when the requested type is not
 * supported, so the result has to be checked rather than assumed.
 */
function encode(canvas: HTMLCanvasElement, type: string, quality: number): string | null {
  const url = canvas.toDataURL(type, quality);
  return url.startsWith(`data:${type}`) ? url : null;
}

export async function prepareAvatarSource(file: File): Promise<AvatarSource> {
  if (!file.type.startsWith('image/')) {
    throw new AvatarError('That file is not an image.');
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new AvatarError('That image is very large. Pick one under 12MB.');
  }

  let bitmap: ImageBitmap;
  try {
    // `from-image` honours EXIF orientation — without it, photos taken on a
    // phone arrive rotated, and the crop the user framed would not match.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new AvatarError('That image could not be read. Try a different file.');
  }

  try {
    const scale = Math.min(1, MAX_WORKING_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) throw new AvatarError('This browser could not process the image.');
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92),
    );
    if (!blob) throw new AvatarError('That image could not be prepared.');

    return { canvas, url: URL.createObjectURL(blob), width, height };
  } finally {
    bitmap.close();
  }
}

/** Frees the object URL. Call once the source is no longer displayed. */
export function releaseAvatarSource(source: AvatarSource | null): void {
  if (source) URL.revokeObjectURL(source.url);
}

// ---------------------------------------------------------------------------
// Crop geometry
//
// Pure, and kept out of the dialog so it can be tested — jsdom has no canvas,
// so the encoding above cannot be, and this is where the mistakes would hide.
// The model is: a square viewport of `view` px, and an image drawn at `scale`
// whose top-left sits at `offset` relative to that viewport.
// ---------------------------------------------------------------------------

export interface Offset {
  x: number;
  y: number;
}

/** Scale at which the image's shorter edge exactly fills the square viewport. */
export function coverScale(view: number, width: number, height: number): number {
  return view / Math.min(width, height);
}

/**
 * Holds the image over the whole viewport. Panning past an edge would otherwise
 * crop in blank space.
 */
export function clampOffset(
  offset: Offset,
  view: number,
  width: number,
  height: number,
  scale: number,
): Offset {
  return {
    x: Math.min(0, Math.max(view - width * scale, offset.x)),
    y: Math.min(0, Math.max(view - height * scale, offset.y)),
  };
}

/** Offset that centres the image in the viewport at a given scale. */
export function centreOffset(view: number, width: number, height: number, scale: number): Offset {
  return { x: (view - width * scale) / 2, y: (view - height * scale) / 2 };
}

/**
 * Offset that keeps whatever sits under the viewport's centre fixed while the
 * scale changes — which is what makes zooming feel anchored rather than jumpy.
 */
export function offsetForZoom(
  offset: Offset,
  view: number,
  fromScale: number,
  toScale: number,
): Offset {
  const centre = view / 2;
  return {
    x: centre - ((centre - offset.x) / fromScale) * toScale,
    y: centre - ((centre - offset.y) / fromScale) * toScale,
  };
}

/**
 * Negating a zero offset yields `-0`, which compares unequal to `0` under
 * `Object.is` and would make callers and tests disagree about identical values.
 */
const normalise = (value: number): number => value + 0;

/** The visible square, converted back into source-image pixels. */
export function cropRect(
  view: number,
  offset: Offset,
  scale: number,
): { x: number; y: number; size: number } {
  return {
    x: normalise(-offset.x / scale),
    y: normalise(-offset.y / scale),
    size: view / scale,
  };
}

/**
 * Renders a square region of the source down to the stored avatar.
 *
 * `x`, `y`, and `size` are in source-image pixels — the crop dialog converts
 * from its own view transform, so this stays independent of how it is framed.
 */
export function cropToAvatarDataUrl(
  source: AvatarSource,
  x: number,
  y: number,
  size: number,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;

  const context = canvas.getContext('2d');
  if (!context) throw new AvatarError('This browser could not process the image.');

  // Rounding in the caller can push the region a fraction past the edge, which
  // would draw a transparent sliver; clamping is cheaper than exact arithmetic.
  const side = Math.min(size, source.width, source.height);
  const sx = Math.max(0, Math.min(x, source.width - side));
  const sy = Math.max(0, Math.min(y, source.height - side));

  context.drawImage(source.canvas, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

  for (const quality of QUALITY_STEPS) {
    // WebP first for size; JPEG is the fallback everywhere it is missing.
    const url = encode(canvas, 'image/webp', quality) ?? encode(canvas, 'image/jpeg', quality);
    if (url && url.length <= MAX_AVATAR_DATA_URL_LENGTH) return url;
  }

  throw new AvatarError('That image could not be compressed enough. Try a simpler picture.');
}
