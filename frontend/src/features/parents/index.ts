export { parentsApi } from './api/parents.api';
export type {
  CreateParentPayload,
  ParentContactPayload,
  UpdateParentPayload,
} from './api/parents.api';
export { ParentEditDialog } from './components/ParentEditDialog';
export { ParentFormDialog } from './components/ParentFormDialog';
export { ParentStudentsDialog } from './components/ParentStudentsDialog';
export { ParentsTable } from './components/ParentsTable';
export {
  parentKeys,
  useCreateParent,
  useDeleteParent,
  useLinkStudent,
  useParent,
  useParentsList,
  useUnlinkStudent,
  useUpdateLink,
  useUpdateParent,
} from './hooks/useParents';
export * from './schemas/parent.schemas';
export * from './types';
