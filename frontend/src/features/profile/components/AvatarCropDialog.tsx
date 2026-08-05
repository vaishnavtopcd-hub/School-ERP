import CropRotateOutlinedIcon from '@mui/icons-material/CropRotateOutlined';
import ZoomInOutlinedIcon from '@mui/icons-material/ZoomInOutlined';
import ZoomOutOutlinedIcon from '@mui/icons-material/ZoomOutOutlined';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { AppDialog } from '@/shared/components';

import {
  AvatarError,
  centreOffset,
  clampOffset,
  coverScale,
  cropRect,
  cropToAvatarDataUrl,
  offsetForZoom,
  type AvatarSource,
  type Offset,
} from '../utils/avatar';

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.1;

interface AvatarCropDialogProps {
  open: boolean;
  source: AvatarSource | null;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
}

/**
 * Square pan-and-zoom cropper with a circular mask.
 *
 * Hand-rolled rather than pulled from a package: the geometry is a dozen lines
 * and the app deliberately keeps a small dependency list. The whole transform is
 * two numbers — `zoom`, and the offset of the scaled image's top-left corner
 * relative to the viewport — which is also exactly what the crop rectangle is
 * derived from, so preview and result cannot disagree.
 */
export function AvatarCropDialog({ open, source, onCancel, onConfirm }: AvatarCropDialogProps) {
  /**
   * Callback ref rather than `useRef` + an effect keyed on `open`.
   *
   * MUI's Portal renders `null` on the commit where the dialog opens and only
   * mounts its children after its own layout effect sets state — so a ref read
   * at that point is still null, and an effect keyed on `open` would never run
   * again to correct it. `view` would stay 0, and `scale(0)` renders nothing.
   * A callback ref fires when the node actually attaches.
   */
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  /** Viewport edge in CSS px. Measured, because it is responsive. */
  const [view, setView] = useState(0);

  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);

  const drag = useRef<{ pointerId: number; startX: number; startY: number } | null>(null);

  const baseScale = source && view ? coverScale(view, source.width, source.height) : 0;
  const scale = baseScale * zoom;

  const clamp = useCallback(
    (next: Offset, atScale: number) =>
      source ? clampOffset(next, view, source.width, source.height, atScale) : next,
    [source, view],
  );

  useLayoutEffect(() => {
    if (!viewport) {
      setView(0);
      return;
    }

    // Measured before observing, and only when non-zero: a 0 here means "not
    // laid out yet", and writing it would clobber a width the observer has
    // already delivered. `offsetWidth` rather than `getBoundingClientRect`
    // because the dialog is mid-Grow and a bounding rect would report the
    // transform-scaled width.
    if (viewport.offsetWidth) setView(viewport.offsetWidth);

    const observer = new ResizeObserver(([entry]) => setView(entry.contentRect.width));
    observer.observe(viewport);

    return () => observer.disconnect();
  }, [viewport]);

  useLayoutEffect(() => {
    if (!source || !view) return;
    setZoom(MIN_ZOOM);
    setOffset(
      centreOffset(
        view,
        source.width,
        source.height,
        coverScale(view, source.width, source.height),
      ),
    );
    // A failure against the previous picture says nothing about this one.
    setError(null);
  }, [source, view]);

  /** Zooms about the centre of the viewport, so the framing stays put. */
  const applyZoom = useCallback(
    (nextZoom: number) => {
      const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
      setZoom(clampedZoom);
      setOffset((current) => {
        if (!baseScale) return current;
        const nextScale = baseScale * clampedZoom;
        return clamp(offsetForZoom(current, view, scale, nextScale), nextScale);
      });
    },
    [baseScale, clamp, scale, view],
  );

  const handleConfirm = () => {
    if (!source || !scale) return;
    try {
      // The visible square *is* the crop, mapped back into image pixels.
      const { x, y, size } = cropRect(view, offset, scale);
      onConfirm(cropToAvatarDataUrl(source, x, y, size));
    } catch (caught) {
      setError(caught instanceof AvatarError ? caught.message : 'That image could not be cropped.');
    }
  };

  return (
    <AppDialog
      open={open}
      onClose={onCancel}
      title="Crop photo"
      subtitle="Drag to reposition, and zoom to fill the circle."
      icon={CropRotateOutlinedIcon}
      maxWidth="xs"
      confirmLabel="Use photo"
      confirmDisabled={!source || !view}
      onConfirm={handleConfirm}
    >
      <Stack gap={2} alignItems="center">
        <Box
          ref={setViewport}
          onPointerDown={(event) => {
            if (!source) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = {
              pointerId: event.pointerId,
              startX: event.clientX - offset.x,
              startY: event.clientY - offset.y,
            };
          }}
          onPointerMove={(event) => {
            const active = drag.current;
            if (!active || active.pointerId !== event.pointerId) return;
            setOffset(
              clamp({ x: event.clientX - active.startX, y: event.clientY - active.startY }, scale),
            );
          }}
          onPointerUp={(event) => {
            if (drag.current?.pointerId === event.pointerId) drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onWheel={(event) => applyZoom(zoom - Math.sign(event.deltaY) * ZOOM_STEP)}
          sx={{
            position: 'relative',
            width: 'min(300px, 68vw)',
            aspectRatio: '1 / 1',
            overflow: 'hidden',
            borderRadius: 2,
            bgcolor: 'action.hover',
            // `:active` rather than the drag ref — a ref change does not
            // re-render, so a ref-driven cursor would never actually update.
            cursor: 'grab',
            '&:active': { cursor: 'grabbing' },
            // Without this the browser claims the gesture for scrolling and the
            // pointer events stop arriving mid-drag on touch devices.
            touchAction: 'none',
            userSelect: 'none',
          }}
        >
          {source && (
            <Box
              component="img"
              src={source.url}
              alt=""
              draggable={false}
              // Inline, not `sx`: this changes on every pointer move, and
              // emotion would serialise and inject a new CSS class per frame.
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                width: source.width,
                height: source.height,
              }}
              sx={{
                position: 'absolute',
                left: 0,
                top: 0,
                transformOrigin: 'top left',
                maxWidth: 'none',
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Circular cut-out: one huge spread shadow darkens everything the
              circle does not cover, with no second element to keep aligned. */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.48)',
              border: '2px solid rgba(255, 255, 255, 0.85)',
              pointerEvents: 'none',
            }}
          />
        </Box>

        <Stack direction="row" gap={1.5} alignItems="center" sx={{ width: '100%', maxWidth: 300 }}>
          <ZoomOutOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
          <Slider
            value={zoom}
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            onChange={(_event, next) => applyZoom(next as number)}
            aria-label="Zoom"
            size="small"
          />
          <ZoomInOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        </Stack>

        {error && (
          <Typography variant="caption" color="error.main">
            {error}
          </Typography>
        )}
      </Stack>
    </AppDialog>
  );
}
