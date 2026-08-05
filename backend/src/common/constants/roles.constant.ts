import { SystemRoleKey } from '@prisma/client';

import { ALL_PERMISSIONS, PERMISSIONS } from './permissions.constant';

export { SystemRoleKey };

/**
 * Permissions no school-owned role may ever hold.
 *
 * Creating schools and appointing their administrators is a platform-operator
 * action. If a school admin could grant these to a role they author, they could
 * mint themselves access to every other tenant.
 */
export const PLATFORM_ONLY_PERMISSIONS: string[] = [
  PERMISSIONS.school.create,
  PERMISSIONS.school.delete,
  PERMISSIONS.school.manage,
];

/** Every permission a school-owned role is allowed to be granted. */
export const SCHOOL_GRANTABLE_PERMISSIONS: string[] = ALL_PERMISSIONS.filter(
  (key) => !PLATFORM_ONLY_PERMISSIONS.includes(key),
);

/**
 * The full set the platform operator holds. SUPER_ADMIN short-circuits the
 * guard anyway; this is stored so `/auth/me` reports something meaningful.
 */
export const SUPER_ADMIN_PERMISSIONS: string[] = ALL_PERMISSIONS;

/**
 * A role definition used to provision a new school.
 *
 * These are *starting points*, not a fixed model: once the school exists its
 * administrator renames, re-permissions, adds, and deletes them freely. Only
 * the SCHOOL_ADMIN entry is locked, because the school would otherwise be able
 * to strip its own last administrator.
 */
export interface RoleTemplate {
  name: string;
  description: string;
  permissions: string[];
  systemKey?: SystemRoleKey;
  isSystem?: boolean;
}

export const SCHOOL_ADMIN_TEMPLATE: RoleTemplate = {
  name: 'Administrator',
  description: 'Full access within this school, including managing its roles.',
  permissions: SCHOOL_GRANTABLE_PERMISSIONS,
  systemKey: SystemRoleKey.SCHOOL_ADMIN,
  isSystem: true,
};

/**
 * Roles every new school starts with, beyond its locked Administrator role.
 * Editable and deletable by that school's administrator.
 */
export const DEFAULT_SCHOOL_ROLES: RoleTemplate[] = [
  {
    name: 'Manager',
    description: 'Day-to-day operations. Cannot alter the role model.',
    permissions: [
      PERMISSIONS.user.create,
      PERMISSIONS.user.read,
      PERMISSIONS.user.update,
      PERMISSIONS.role.read,
      PERMISSIONS.permission.read,
      PERMISSIONS.school.read,
      PERMISSIONS.auditLog.read,
      // Can plan and edit years, but rolling the school over is an admin call.
      PERMISSIONS.academicYear.create,
      PERMISSIONS.academicYear.read,
      PERMISSIONS.academicYear.update,
      PERMISSIONS.schoolClass.manage,
      PERMISSIONS.medium.manage,
      PERMISSIONS.subject.manage,
      // Staff and guardian records are an office function.
      PERMISSIONS.teacher.manage,
      PERMISSIONS.student.manage,
      PERMISSIONS.parent.manage,
    ],
  },
  {
    name: 'Headmaster',
    description: 'Academic oversight. Broad visibility, narrow write access.',
    permissions: [
      PERMISSIONS.user.read,
      PERMISSIONS.user.update,
      PERMISSIONS.role.read,
      PERMISSIONS.school.read,
      PERMISSIONS.auditLog.read,
      PERMISSIONS.academicYear.read,
      PERMISSIONS.schoolClass.read,
      PERMISSIONS.schoolClass.update,
      PERMISSIONS.medium.read,
      // Academic oversight: sets the curriculum, but cannot remove a subject.
      PERMISSIONS.subject.read,
      PERMISSIONS.subject.create,
      PERMISSIONS.subject.update,
      // No `teacher:*` — staff employment records are administrative, and this
      // role already sees the people through the class and subject modules.
      // Pupils and their guardians are read-only: academic oversight needs to
      // see who is enrolled and who to contact, not to maintain the records.
      PERMISSIONS.student.read,
      PERMISSIONS.parent.read,
    ],
  },
  {
    name: 'Teacher',
    description: 'Teaching staff. Eligible to be a class teacher.',
    // No `user:read`: teaching staff have no reason to browse the school's user
    // directory. The class-teacher picker reads `class:read`, not this.
    permissions: [
      PERMISSIONS.school.read,
      PERMISSIONS.academicYear.read,
      PERMISSIONS.schoolClass.read,
      PERMISSIONS.medium.read,
      // Sees the curriculum, including the subjects they are assigned to.
      PERMISSIONS.subject.read,
      // Needs the pupils they teach, and a guardian to contact.
      PERMISSIONS.student.read,
      PERMISSIONS.parent.read,
    ],
  },
  {
    name: 'Parent',
    description: 'Guardian of one or more students.',
    permissions: [],
  },
];

/**
 * Roles eligible to be a section's class teacher, matched by name.
 *
 * Names are admin-authored now, so this is a convention rather than a rule the
 * database enforces — see ClassesService, which falls back to any role holding
 * `class:read` when no name matches.
 */
export const TEACHING_ROLE_NAMES = ['Teacher', 'Headmaster'];
