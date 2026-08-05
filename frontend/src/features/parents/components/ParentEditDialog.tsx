import { zodResolver } from '@hookform/resolvers/zod';
import ContactPhoneOutlinedIcon from '@mui/icons-material/ContactPhoneOutlined';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { AppDialog } from '@/shared/components';

import { useUpdateParent } from '../hooks/useParents';
import { updateParentSchema, type UpdateParentInput } from '../schemas/parent.schemas';
import type { Parent } from '../types';

interface ParentEditDialogProps {
  open: boolean;
  parent: Parent | null;
  onClose: () => void;
}

/**
 * Editing a guardian: the record, their contact details, and their address.
 *
 * Email, status, and roles are absent by design — each is a privileged action
 * with its own endpoint under /users.
 */
export function ParentEditDialog({ open, parent, onClose }: ParentEditDialogProps) {
  const updateParent = useUpdateParent();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateParentInput, unknown, UpdateParentInput>({
    resolver: zodResolver(updateParentSchema),
  });

  useEffect(() => {
    if (!open || !parent) return;
    reset({
      occupation: parent.occupation ?? '',
      emergencyContactName: parent.emergencyContactName ?? '',
      emergencyContactPhone: parent.emergencyContactPhone ?? '',
      emergencyContactRelation: parent.emergencyContactRelation ?? '',
      notes: parent.notes ?? '',
      firstName: parent.firstName,
      lastName: parent.lastName,
      phone: parent.phone ?? '',
      addressLine1: parent.addressLine1 ?? '',
      addressLine2: parent.addressLine2 ?? '',
      city: parent.city ?? '',
      state: parent.state ?? '',
      postalCode: parent.postalCode ?? '',
      country: parent.country ?? '',
    } as unknown as UpdateParentInput);
    updateParent.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, parent]);

  const onSubmit = handleSubmit((values) => {
    if (!parent) return;

    updateParent.mutate(
      {
        id: parent.id,
        input: {
          occupation: values.occupation,
          emergencyContactName: values.emergencyContactName,
          emergencyContactPhone: values.emergencyContactPhone,
          emergencyContactRelation: values.emergencyContactRelation,
          notes: values.notes,
          contact: {
            firstName: values.firstName,
            lastName: values.lastName,
            phone: values.phone,
            addressLine1: values.addressLine1,
            addressLine2: values.addressLine2,
            city: values.city,
            state: values.state,
            postalCode: values.postalCode,
            country: values.country,
          },
        },
      },
      { onSuccess: onClose },
    );
  });

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Edit guardian"
      subtitle={parent ? `${parent.firstName} ${parent.lastName} · ${parent.email}` : undefined}
      icon={ContactPhoneOutlinedIcon}
      maxWidth="md"
      error={updateParent.error}
      isPending={updateParent.isPending}
      pendingLabel="Saving…"
      confirmLabel="Save changes"
      onSubmit={onSubmit}
    >
      <Typography variant="overline" color="text.secondary">
        Contact details
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2.5}>
        <TextField
          {...register('firstName')}
          label="First name"
          required
          error={Boolean(errors.firstName)}
          helperText={errors.firstName?.message}
        />
        <TextField
          {...register('lastName')}
          label="Last name"
          required
          error={Boolean(errors.lastName)}
          helperText={errors.lastName?.message}
        />
        <TextField
          {...register('phone')}
          label="Contact number"
          error={Boolean(errors.phone)}
          helperText={errors.phone?.message}
        />
      </Stack>

      <TextField
        {...register('occupation')}
        label="Occupation"
        error={Boolean(errors.occupation)}
        helperText={errors.occupation?.message}
      />

      <Divider />
      <Typography variant="overline" color="text.secondary">
        Address
      </Typography>

      <TextField {...register('addressLine1')} label="Address line 1" />
      <TextField {...register('addressLine2')} label="Address line 2" />

      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2.5}>
        <TextField {...register('city')} label="City" />
        <TextField {...register('state')} label="State" />
        <TextField {...register('postalCode')} label="Postal code" />
        <TextField {...register('country')} label="Country" />
      </Stack>

      <Divider />
      <Typography variant="overline" color="text.secondary">
        Emergency contact
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mt: -1.5 }}>
        Who to call when this guardian cannot be reached.
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2.5}>
        <TextField
          {...register('emergencyContactName')}
          label="Name"
          error={Boolean(errors.emergencyContactName)}
          helperText={errors.emergencyContactName?.message}
        />
        <TextField
          {...register('emergencyContactPhone')}
          label="Phone"
          error={Boolean(errors.emergencyContactPhone)}
          helperText={errors.emergencyContactPhone?.message}
        />
        <TextField
          {...register('emergencyContactRelation')}
          label="Relationship"
          placeholder="Uncle"
          error={Boolean(errors.emergencyContactRelation)}
          helperText={errors.emergencyContactRelation?.message}
        />
      </Stack>

      <TextField {...register('notes')} label="Notes" multiline minRows={2} />
    </AppDialog>
  );
}
