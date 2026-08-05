import AddIcon from '@mui/icons-material/Add';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import type { GridPaginationModel, GridSortModel } from '@mui/x-data-grid';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAuth } from '@/features/auth';
import { ApiError } from '@/shared/api';
import { ConfirmActionDialog, PageHeader } from '@/shared/components';
import { CREATE_PARAM } from '@/shared/components/layout/navigation';
import { useDebounce } from '@/shared/hooks';

import { AssignRolesDialog } from '../components/AssignRolesDialog';
import { ResetPasswordDialog } from '../components/ResetPasswordDialog';
import { UserFormDialog } from '../components/UserFormDialog';
import { UsersTable } from '../components/UsersTable';
import { useDeleteUser, useRoleOptions, useSetUserStatus, useUsersList } from '../hooks/useUsers';
import {
  USER_STATUSES,
  STATUS_LABELS,
  type ManagedUser,
  type SortableField,
  type UserStatus,
} from '../types';

type DialogKind = 'create' | 'edit' | 'roles' | 'password' | 'delete' | 'status' | null;

export default function UsersPage() {
  const { user: currentUser, hasPermission } = useAuth();

  // --- Query state ---------------------------------------------------------
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 350);
  const [status, setStatus] = useState<UserStatus | ''>('');
  const [roleId, setRoleId] = useState('');
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  });
  const [sortModel, setSortModel] = useState<GridSortModel>([{ field: 'createdAt', sort: 'desc' }]);

  const params = useMemo(
    () => ({
      // DataGrid pages are 0-based; the API is 1-based.
      page: paginationModel.page + 1,
      limit: paginationModel.pageSize,
      search: search || undefined,
      status: status || undefined,
      roleId: roleId || undefined,
      // Every action on this screen is refused against your own account, so
      // listing yourself here only offers dead ends.
      excludeSelf: true,
      sortBy: (sortModel[0]?.field ?? 'createdAt') as SortableField,
      sortOrder: sortModel[0]?.sort ?? 'desc',
    }),
    [paginationModel, search, status, roleId, sortModel],
  );

  const { data, isFetching, error } = useUsersList(params);
  const { data: roleOptions = [] } = useRoleOptions();

  // --- Row actions ---------------------------------------------------------
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [activeUser, setActiveUser] = useState<ManagedUser | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);

  const deleteUser = useDeleteUser();
  const setUserStatus = useSetUserStatus();

  const canCreate = hasPermission('user:create');
  const canUpdate = hasPermission('user:update');
  const canDelete = hasPermission('user:delete');
  const canAssignRole = hasPermission('user:assign-role');
  const canResetPassword = hasPermission('user:reset-password');

  const isSelf = activeUser?.id === currentUser?.id;
  const isDisabled = activeUser?.status !== 'ACTIVE';

  // The sidebar's `+` navigates here with a flag rather than reaching into this
  // page's state. The flag is consumed so a reload does not reopen the dialog.
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get(CREATE_PARAM) !== '1') return;

    if (canCreate) {
      setActiveUser(null);
      setDialog('create');
    }

    const next = new URLSearchParams(searchParams);
    next.delete(CREATE_PARAM);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, canCreate]);

  const closeMenu = () => setMenuAnchor(null);

  const openDialog = (kind: DialogKind) => {
    closeMenu();
    setDialog(kind);
  };

  const closeDialog = () => {
    setDialog(null);
    deleteUser.reset();
    setUserStatus.reset();
  };

  const listError = error instanceof ApiError ? error : null;

  return (
    <Box>
      <PageHeader
        breadcrumb="Administration"
        title="Users"
        subtitle="Create accounts, manage roles, and control access."
        meta={data && <Chip label={`${data.meta.total} total`} size="small" variant="outlined" />}
        actions={
          canCreate && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setActiveUser(null);
                setDialog('create');
              }}
            >
              Create user
            </Button>
          )
        }
      />

      {listError && (
        <Alert severity="error" className="mb-4">
          {listError.message}
        </Alert>
      )}

      <Paper elevation={0} variant="outlined">
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} className="p-4">
          <TextField
            label="Search"
            placeholder="Name or email"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
              // A new search invalidates the current page offset.
              setPaginationModel((model) => ({ ...model, page: 0 }));
            }}
            className="sm:max-w-xs"
          />

          <TextField
            select
            label="Status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as UserStatus | '');
              setPaginationModel((model) => ({ ...model, page: 0 }));
            }}
            className="sm:max-w-[180px]"
          >
            <MenuItem value="">All statuses</MenuItem>
            {USER_STATUSES.map((value) => (
              <MenuItem key={value} value={value}>
                {STATUS_LABELS[value]}
              </MenuItem>
            ))}
          </TextField>

          {/* Options come from the API: roles are authored per school, so there
              is no fixed list to render from. */}
          <TextField
            select
            label="Role"
            value={roleId}
            onChange={(event) => {
              setRoleId(event.target.value);
              setPaginationModel((model) => ({ ...model, page: 0 }));
            }}
            className="sm:max-w-[180px]"
          >
            <MenuItem value="">All roles</MenuItem>
            {roleOptions.map((option) => (
              <MenuItem key={option.id} value={option.id}>
                {option.name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Divider />

        <UsersTable
          rows={data?.items ?? []}
          rowCount={data?.meta.total ?? 0}
          loading={isFetching}
          paginationModel={paginationModel}
          sortModel={sortModel}
          onPaginationModelChange={setPaginationModel}
          onSortModelChange={setSortModel}
          onOpenActions={(user, anchor) => {
            setActiveUser(user);
            setMenuAnchor(anchor);
          }}
        />
      </Paper>

      {/* --- Row action menu -------------------------------------------------- */}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem disabled={!canUpdate} onClick={() => openDialog('edit')}>
          <ListItemText>Edit details</ListItemText>
        </MenuItem>

        <MenuItem disabled={!canAssignRole} onClick={() => openDialog('roles')}>
          <ListItemText>Manage roles</ListItemText>
        </MenuItem>

        <MenuItem disabled={!canResetPassword} onClick={() => openDialog('password')}>
          <ListItemText>Reset password</ListItemText>
        </MenuItem>

        <Divider />

        <MenuItem
          // Disabling yourself would end your own session mid-action.
          disabled={!canUpdate || (isSelf && !isDisabled)}
          onClick={() => openDialog('status')}
        >
          <ListItemText>{isDisabled ? 'Enable account' : 'Disable account'}</ListItemText>
        </MenuItem>

        <MenuItem disabled={!canDelete || isSelf} onClick={() => openDialog('delete')}>
          <ListItemText sx={{ color: 'error.main' }}>Delete user</ListItemText>
        </MenuItem>
      </Menu>

      {/* --- Dialogs ---------------------------------------------------------- */}
      <UserFormDialog
        open={dialog === 'create' || dialog === 'edit'}
        user={dialog === 'edit' ? activeUser : null}
        onClose={closeDialog}
      />

      <AssignRolesDialog open={dialog === 'roles'} user={activeUser} onClose={closeDialog} />

      <ResetPasswordDialog open={dialog === 'password'} user={activeUser} onClose={closeDialog} />

      <ConfirmActionDialog
        open={dialog === 'status'}
        title={isDisabled ? 'Enable account' : 'Disable account'}
        confirmLabel={isDisabled ? 'Enable' : 'Disable'}
        destructive={!isDisabled}
        isPending={setUserStatus.isPending}
        error={setUserStatus.error}
        body={
          isDisabled ? (
            <>
              <strong>{activeUser?.email}</strong> will be able to sign in again, and any sign-in
              lockout will be cleared.
            </>
          ) : (
            <>
              <strong>{activeUser?.email}</strong> will be signed out everywhere and blocked from
              signing in. This is reversible.
            </>
          )
        }
        onConfirm={() => {
          if (!activeUser) return;
          setUserStatus.mutate(
            { id: activeUser.id, status: isDisabled ? 'ACTIVE' : 'INACTIVE' },
            { onSuccess: closeDialog },
          );
        }}
        onClose={closeDialog}
      />

      <ConfirmActionDialog
        open={dialog === 'delete'}
        title="Delete user"
        confirmLabel="Delete"
        destructive
        isPending={deleteUser.isPending}
        error={deleteUser.error}
        body={
          <>
            Delete <strong>{activeUser?.email}</strong>? The account is retained for audit purposes
            but can no longer sign in, and the email address is freed for reuse.
          </>
        }
        onConfirm={() => {
          if (!activeUser) return;
          deleteUser.mutate(activeUser.id, { onSuccess: closeDialog });
        }}
        onClose={closeDialog}
      />
    </Box>
  );
}
