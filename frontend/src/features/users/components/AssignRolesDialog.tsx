import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { useEffect, useState } from 'react';

import { useAuth } from '@/features/auth';
import { AppDialog } from '@/shared/components';
import { SYSTEM_ROLES } from '@/shared/types';
import { fullName } from '@/shared/utils';

import { useAssignRoles, useRoleOptions } from '../hooks/useUsers';
import type { ManagedUser, RoleOption } from '../types';

interface AssignRolesDialogProps {
  open: boolean;
  user: ManagedUser | null;
  onClose: () => void;
}

export function AssignRolesDialog({ open, user, onClose }: AssignRolesDialogProps) {
  const { data: roleOptions = [] } = useRoleOptions();
  const assignRoles = useAssignRoles();
  const { user: currentUser, isSuperAdmin } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (open && user) {
      setSelected(user.roles.map((role) => role.id));
      assignRoles.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

  if (!user) return null;

  const isSelf = currentUser?.id === user.id;
  const heldAdminRole = user.roles.find((role) => role.systemKey === SYSTEM_ROLES.SCHOOL_ADMIN);

  const toggle = (roleId: string) =>
    setSelected((current) =>
      current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId],
    );

  // These mirror server-side rules. The API is still the authority — disabling
  // the checkbox just avoids offering an action that would be rejected.
  const wouldStripOwnAdmin =
    isSelf && Boolean(heldAdminRole) && !selected.includes(heldAdminRole?.id ?? '');

  const lockedRole = (role: RoleOption): string | null => {
    if (role.systemKey !== SYSTEM_ROLES.SCHOOL_ADMIN) {
      return null;
    }
    if (!isSuperAdmin) {
      return 'Only the platform operator can grant this role';
    }
    if (isSelf && heldAdminRole) {
      return 'You cannot remove your own administrator role';
    }
    return null;
  };

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Manage roles"
      subtitle={`${fullName(user)} — this replaces their current roles entirely.`}
      icon={AdminPanelSettingsOutlinedIcon}
      error={assignRoles.error}
      isPending={assignRoles.isPending}
      pendingLabel="Saving…"
      confirmLabel="Save roles"
      confirmDisabled={wouldStripOwnAdmin}
      onConfirm={() =>
        assignRoles.mutate({ id: user.id, roleIds: selected }, { onSuccess: onClose })
      }
    >
      {wouldStripOwnAdmin && (
        <Alert severity="warning">You cannot remove your own administrator role.</Alert>
      )}

      <Stack gap={1.25}>
        {roleOptions.map((role) => {
          const lockReason = lockedRole(role);
          const checked = selected.includes(role.id);

          return (
            <Box
              key={role.id}
              sx={{
                p: 1.75,
                borderRadius: 2.5,
                border: '1px solid',
                borderColor: checked ? 'primary.main' : 'divider',
                bgcolor: (theme) =>
                  checked ? alpha(theme.palette.primary.main, 0.05) : 'transparent',
                opacity: lockReason ? 0.65 : 1,
                transition: 'border-color 130ms ease, background-color 130ms ease',
              }}
            >
              <FormControlLabel
                sx={{ m: 0, alignItems: 'flex-start' }}
                control={
                  <Checkbox
                    checked={checked}
                    onChange={() => toggle(role.id)}
                    disabled={Boolean(lockReason)}
                    sx={{ mt: -0.75, mr: 0.5 }}
                  />
                }
                label={
                  <Box>
                    <Typography variant="subtitle2">{role.name}</Typography>

                    {(lockReason ?? role.description) && (
                      <Typography variant="caption" color="text.secondary" component="div">
                        {lockReason ?? role.description}
                      </Typography>
                    )}

                    {role.permissions.length > 0 && (
                      <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 1 }}>
                        {role.permissions.slice(0, 8).map((permission) => (
                          <Chip
                            key={permission}
                            label={permission}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                        {role.permissions.length > 8 && (
                          <Chip
                            label={`+${role.permissions.length - 8} more`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Stack>
                    )}
                  </Box>
                }
              />
            </Box>
          );
        })}
      </Stack>
    </AppDialog>
  );
}
