import AddIcon from '@mui/icons-material/Add';
import TranslateOutlinedIcon from '@mui/icons-material/TranslateOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { alpha } from '@mui/material/styles';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAuth } from '@/features/auth';
import { ApiError } from '@/shared/api';
import { ConfirmActionDialog, PageHeader } from '@/shared/components';
import { CREATE_PARAM } from '@/shared/components/layout/navigation';

import { MediumFormDialog } from '../components/MediumFormDialog';
import { useDeleteMedium, useMediums } from '../hooks/useMediums';
import type { Medium } from '../types';

type DialogKind = 'create' | 'edit' | 'delete' | null;

export default function MediumsPage() {
  const { hasPermission } = useAuth();
  const { data: mediums = [], isLoading, error } = useMediums();
  const deleteMedium = useDeleteMedium();

  const [active, setActive] = useState<Medium | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);

  const canCreate = hasPermission('medium:create');
  const canUpdate = hasPermission('medium:update');
  const canDelete = hasPermission('medium:delete');

  // The sidebar's `+` navigates here with a flag rather than reaching into this
  // page's state. The flag is consumed so a reload does not reopen the dialog.
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get(CREATE_PARAM) !== '1') return;

    if (canCreate) {
      setActive(null);
      setDialog('create');
    }

    const next = new URLSearchParams(searchParams);
    next.delete(CREATE_PARAM);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, canCreate]);

  const closeDialog = () => {
    setDialog(null);
    deleteMedium.reset();
  };

  const listError = error instanceof ApiError ? error : null;

  return (
    <Box>
      <PageHeader
        breadcrumb="Academics"
        title="Mediums"
        subtitle="Languages of instruction. Each section is taught in one of these."
        meta={
          mediums.length > 0 && <Chip label={`${mediums.length}`} size="small" variant="outlined" />
        }
        actions={
          canCreate && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setActive(null);
                setDialog('create');
              }}
            >
              Add medium
            </Button>
          )
        }
      />

      {listError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {listError.message}
        </Alert>
      )}

      {isLoading ? (
        <Stack gap={1.5}>
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} height={72} variant="rounded" />
          ))}
        </Stack>
      ) : mediums.length === 0 ? (
        <Card sx={{ p: 6, textAlign: 'center' }}>
          <TranslateOutlinedIcon sx={{ fontSize: 44, color: 'text.disabled', mb: 1 }} />
          <Typography variant="subtitle1" fontWeight={600}>
            No mediums yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Add one so sections can record the language they are taught in.
          </Typography>
        </Card>
      ) : (
        <Stack gap={1.5}>
          {mediums.map((medium) => (
            <Card
              key={medium.id}
              sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                opacity: medium.isActive ? 1 : 0.6,
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2.5,
                  flexShrink: 0,
                  display: 'grid',
                  placeItems: 'center',
                  color: 'primary.main',
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                }}
              >
                <TranslateOutlinedIcon sx={{ fontSize: 20 }} />
              </Box>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" alignItems="center" gap={1}>
                  <Typography variant="subtitle2">{medium.name}</Typography>
                  {!medium.isActive && <Chip label="Not offered" size="small" />}
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {medium.sectionCount === 0
                    ? 'Not used by any section'
                    : `${medium.sectionCount} section${medium.sectionCount === 1 ? '' : 's'}`}
                </Typography>
              </Box>

              {canUpdate && (
                <Tooltip title="Edit">
                  <IconButton
                    size="small"
                    aria-label={`Edit ${medium.name}`}
                    onClick={() => {
                      setActive(medium);
                      setDialog('edit');
                    }}
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}

              {canDelete && (
                // Deleting is refused server-side while sections use it, so the
                // button is disabled rather than offering a guaranteed failure.
                <Tooltip
                  title={
                    medium.sectionCount > 0 ? 'In use by sections — deactivate instead' : 'Delete'
                  }
                >
                  <span>
                    <IconButton
                      size="small"
                      color="error"
                      aria-label={`Delete ${medium.name}`}
                      disabled={medium.sectionCount > 0}
                      onClick={() => {
                        setActive(medium);
                        setDialog('delete');
                      }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </Card>
          ))}
        </Stack>
      )}

      <MediumFormDialog
        open={dialog === 'create' || dialog === 'edit'}
        medium={dialog === 'edit' ? active : null}
        onClose={closeDialog}
      />

      <ConfirmActionDialog
        open={dialog === 'delete'}
        title="Delete medium"
        confirmLabel="Delete"
        destructive
        isPending={deleteMedium.isPending}
        error={deleteMedium.error}
        body={
          <>
            Delete <strong>{active?.name}</strong>? This cannot be undone. To retire a medium while
            keeping its history, deactivate it instead.
          </>
        }
        onConfirm={() => {
          if (!active) return;
          deleteMedium.mutate(active.id, { onSuccess: closeDialog });
        }}
        onClose={closeDialog}
      />
    </Box>
  );
}
