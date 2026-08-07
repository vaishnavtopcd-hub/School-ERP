import AddIcon from '@mui/icons-material/Add';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';

import { RELATIONSHIPS, RELATIONSHIP_LABELS, type GuardianRelationship } from '../types';

/** One side of a link to choose from — a student, or a guardian. */
export interface LinkOption {
  id: string;
  label: string;
}

interface GuardianLinkPickerProps {
  /** Already filtered to what is not linked yet. */
  options: LinkOption[];
  /** What the options are, for the field label: "Student" or "Guardian". */
  optionLabel: string;
  selectedId: string;
  onSelect: (id: string) => void;
  relationship: GuardianRelationship;
  onRelationshipChange: (relationship: GuardianRelationship) => void;
  onAdd: () => void;
  addLabel: string;
  emptyText: string;
  disabled?: boolean;
}

/**
 * Pick the other side of a guardian link and say how the two are related.
 *
 * Used from both directions — students on a guardian, guardians on a student —
 * because it is the same link either way; only the list differs.
 */
export function GuardianLinkPicker({
  options,
  optionLabel,
  selectedId,
  onSelect,
  relationship,
  onRelationshipChange,
  onAdd,
  addLabel,
  emptyText,
  disabled = false,
}: GuardianLinkPickerProps) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems="flex-start" flexWrap="wrap">
      <TextField
        select
        size="small"
        label={optionLabel}
        value={selectedId}
        disabled={disabled}
        onChange={(event) => onSelect(event.target.value)}
        // minWidth so flex-shrink cannot squeeze the longest control down to
        // its label when the row is tight.
        sx={{ flex: 1, minWidth: 220 }}
        helperText={options.length === 0 ? emptyText : ' '}
      >
        {options.map((option) => (
          <MenuItem key={option.id} value={option.id}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        size="small"
        label="Relationship"
        value={relationship}
        disabled={disabled}
        onChange={(event) => onRelationshipChange(event.target.value as GuardianRelationship)}
        sx={{ minWidth: 150 }}
        helperText=" "
      >
        {RELATIONSHIPS.map((option) => (
          <MenuItem key={option} value={option}>
            {RELATIONSHIP_LABELS[option]}
          </MenuItem>
        ))}
      </TextField>

      {/* Explicitly not a submit button: on a form it sits inside the enclosing
          <form>, and adding a row must not save the record. */}
      <Button
        type="button"
        startIcon={<AddIcon />}
        disabled={!selectedId || disabled}
        onClick={onAdd}
        sx={{ mt: 0.5 }}
      >
        {addLabel}
      </Button>
    </Stack>
  );
}
