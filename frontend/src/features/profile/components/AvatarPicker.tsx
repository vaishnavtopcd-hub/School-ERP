import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState } from 'react';

import { AvatarError, prepareAvatarSource, releaseAvatarSource } from '../utils/avatar';
import type { AvatarSource } from '../utils/avatar';
import { AvatarCropDialog } from './AvatarCropDialog';

interface AvatarPickerProps {
  /** Current value: a data URL, or null for none. */
  value: string | null;
  /** Monogram shown when there is no picture. */
  fallback: string;
  disabled?: boolean;
  onChange: (dataUrl: string | null) => void;
}

/**
 * Picks a photo, hands it to the crop dialog, and reports back the finished data
 * URL. Decoding and encoding both happen in the browser — see `utils/avatar`.
 */
export function AvatarPicker({ value, fallback, disabled, onChange }: AvatarPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<AvatarSource | null>(null);

  // The source holds an object URL, so it has to be freed however the dialog
  // ends — confirmed, cancelled, or unmounted with it still open.
  useEffect(() => () => releaseAvatarSource(source), [source]);

  const closeCropper = () => setSource(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;

    setError(null);
    setBusy(true);
    try {
      setSource(await prepareAvatarSource(file));
    } catch (caught) {
      setError(caught instanceof AvatarError ? caught.message : 'That image could not be read.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2.5} alignItems={{ sm: 'center' }}>
        <Box sx={{ position: 'relative', flexShrink: 0 }}>
          <Avatar
            src={value ?? undefined}
            sx={{ width: 84, height: 84, fontSize: '1.5rem', bgcolor: 'primary.main' }}
          >
            {fallback}
          </Avatar>

          {busy && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                borderRadius: '50%',
                bgcolor: 'rgba(0, 0, 0, 0.45)',
              }}
            >
              <CircularProgress size={24} sx={{ color: '#fff' }} />
            </Box>
          )}
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" gap={1} flexWrap="wrap">
            <Button
              size="small"
              variant="outlined"
              startIcon={<PhotoCameraOutlinedIcon />}
              disabled={disabled || busy}
              onClick={() => inputRef.current?.click()}
            >
              {value ? 'Change photo' : 'Upload photo'}
            </Button>

            {value && (
              <Button
                size="small"
                color="error"
                startIcon={<DeleteOutlineIcon />}
                disabled={disabled || busy}
                onClick={() => {
                  setError(null);
                  onChange(null);
                }}
              >
                Remove
              </Button>
            )}
          </Stack>

          <Typography
            variant="caption"
            color={error ? 'error.main' : 'text.secondary'}
            component="div"
            sx={{ mt: 0.75 }}
          >
            {error ?? 'JPG, PNG, or WebP. You choose the crop after picking a file.'}
          </Typography>
        </Box>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            void handleFile(event.target.files?.[0]);
            // Reset so picking the same file twice still fires a change.
            event.target.value = '';
          }}
        />
      </Stack>

      <AvatarCropDialog
        open={Boolean(source)}
        source={source}
        onCancel={closeCropper}
        onConfirm={(dataUrl) => {
          onChange(dataUrl);
          closeCropper();
        }}
      />
    </>
  );
}
