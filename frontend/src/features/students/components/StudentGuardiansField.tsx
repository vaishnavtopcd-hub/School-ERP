import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';

import { GuardianLinkPicker, GuardianLinkRow, useParentsList } from '@/features/parents';
import type { GuardianRelationship } from '@/features/parents';
import { MAX_PAGE_SIZE } from '@/shared/constants';

/** A guardian on this student, staged or already saved. */
export interface StudentGuardianLink {
  parentId: string;
  label: string;
  relationship: GuardianRelationship;
  isPrimaryContact: boolean;
}

interface StudentGuardiansFieldProps {
  value: StudentGuardianLink[];
  onChange: (next: StudentGuardianLink[]) => void;
  /** Loads the guardian list only while the dialog is open. */
  enabled: boolean;
  disabled?: boolean;
}

const PARENT_PARAMS = {
  page: 1,
  limit: MAX_PAGE_SIZE,
  sortBy: 'firstName' as const,
  sortOrder: 'asc' as const,
};

/**
 * Who to contact about this student, chosen while enrolling them.
 *
 * The list is sent with the student rather than linked afterwards — the office
 * fills one form, and the API writes the student and the links in one
 * transaction.
 */
export function StudentGuardiansField({
  value,
  onChange,
  enabled,
  disabled = false,
}: StudentGuardiansFieldProps) {
  const [parentId, setParentId] = useState('');
  const [relationship, setRelationship] = useState<GuardianRelationship>('FATHER');

  const { data: parents, isError } = useParentsList(PARENT_PARAMS, enabled);

  const linked = new Set(value.map((link) => link.parentId));
  const available = (parents?.items ?? []).filter((parent) => !linked.has(parent.id));

  const add = () => {
    const parent = available.find((candidate) => candidate.id === parentId);
    if (!parent) return;

    onChange([
      ...value,
      {
        parentId: parent.id,
        label: `${parent.firstName} ${parent.lastName}`,
        relationship,
        // The first guardian added is the default first call; it can be moved.
        isPrimaryContact: value.length === 0,
      },
    ]);
    setParentId('');
  };

  // At most one primary per student, the rule the API enforces — so making one
  // primary demotes the others rather than refusing.
  const makePrimary = (id: string) =>
    onChange(value.map((link) => ({ ...link, isPrimaryContact: link.parentId === id })));

  return (
    <Stack gap={2}>
      {isError && (
        <Alert severity="warning">
          Could not load the guardian list. Close and reopen this form to try again.
        </Alert>
      )}

      {value.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No guardians added yet.
        </Typography>
      ) : (
        <Stack sx={{ maxHeight: 240, overflowY: 'auto' }}>
          {value.map((link) => (
            <GuardianLinkRow
              key={link.parentId}
              title={link.label}
              relationship={link.relationship}
              isPrimaryContact={link.isPrimaryContact}
              onMakePrimary={() => makePrimary(link.parentId)}
              onRemove={() => onChange(value.filter((row) => row.parentId !== link.parentId))}
              removeLabel="Remove"
              disabled={disabled}
            />
          ))}
        </Stack>
      )}

      <GuardianLinkPicker
        options={available.map((parent) => ({
          id: parent.id,
          label: `${parent.firstName} ${parent.lastName}${parent.phone ? ` · ${parent.phone}` : ''}`,
        }))}
        optionLabel="Guardian"
        selectedId={parentId}
        onSelect={setParentId}
        relationship={relationship}
        onRelationshipChange={setRelationship}
        onAdd={add}
        addLabel="Add"
        emptyText={
          value.length > 0
            ? 'Every guardian is already on this student.'
            : 'No guardians recorded yet — add them under Parents first.'
        }
        disabled={disabled}
      />
    </Stack>
  );
}
