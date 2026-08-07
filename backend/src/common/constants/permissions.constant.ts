/**
 * Permission registry.
 *
 * A permission is a `resource:action` string. Feature modules add their own
 * block here, seed it into the `permissions` table, and guard endpoints with
 * `@RequirePermissions(PERMISSIONS.student.create)`. Nothing else changes.
 */
/**
 * Mediums a new school starts with. Editable through the mediums module
 * afterwards — this is a starting point, not a fixed list.
 */
export const DEFAULT_MEDIUMS = ['English', 'Malayalam'] as const;

export const ACTIONS = ['create', 'read', 'update', 'delete', 'manage'] as const;
export type Action = (typeof ACTIONS)[number];

function resource<R extends string>(name: R) {
  return {
    create: `${name}:create`,
    read: `${name}:read`,
    update: `${name}:update`,
    delete: `${name}:delete`,
    /** Wildcard — implies every action on the resource. */
    manage: `${name}:manage`,
  } as const;
}

export const PERMISSIONS = {
  /**
   * Beyond plain CRUD, user administration has two actions worth granting
   * separately: changing someone else's password and changing what they can do.
   * Both are privilege-adjacent, so a role can hold `user:update` without them.
   */
  user: {
    ...resource('user'),
    assignRole: 'user:assign-role',
    resetPassword: 'user:reset-password',
  },
  role: resource('role'),
  permission: resource('permission'),
  school: resource('school'),
  auditLog: resource('audit-log'),

  /**
   * Activating rolls the whole school over to a new session and archiving
   * closes one for good, so both are separable from ordinary edits.
   */
  academicYear: {
    ...resource('academic-year'),
    activate: 'academic-year:activate',
    archive: 'academic-year:archive',
  },

  /** Covers sections too — they are managed as part of their class. */
  schoolClass: resource('class'),

  /**
   * Subjects taught to a class. Reading one implies reading its class, so a
   * role granted these should hold `class:read` too — the assignment pickers
   * are served by the classes module rather than duplicated here.
   */
  subject: resource('subject'),

  /**
   * Staff employment records. Administrative rather than academic — holding
   * this means maintaining people's qualifications, contact details, and
   * allocations, so it is granted far more narrowly than `subject:*`.
   *
   * Managing allocations reaches into subjects and sections, so a role granted
   * these should hold `class:read` and `subject:read` too.
   */
  teacher: resource('teacher'),

  /** Pupils. Reading one implies reading their class, so pair with `class:read`. */
  student: resource('student'),

  /**
   * Guardian records, and which students they belong to. Administrative like
   * `teacher:*`, and reaches into students — pair with `student:read`.
   */
  parent: resource('parent'),

  /** Languages of instruction, owned per school. */
  medium: resource('medium'),

  /**
   * The shape of the school day — the period ladder every class shares.
   * Separate from `timetable:*` because setting the day's structure is a
   * once-a-year act, while filling the grid is ordinary work.
   */
  period: resource('period'),

  /**
   * Lessons on the grid. Reaches into sections, subjects, and teachers, so a
   * role granted these should hold `class:read`, `subject:read`, and
   * `teacher:read` too — the assignment pickers are served by those modules.
   */
  timetable: resource('timetable'),

  /**
   * The daily register.
   *
   * `read-own` is the guardian's view and is deliberately *not* an action on
   * the resource: it grants no access to the school's register at all, only to
   * the rows about children the holder is recorded as a guardian of. The
   * service enforces that scope regardless of what else the caller holds, so
   * the permission cannot be widened by granting more.
   */
  attendance: {
    ...resource('attendance'),
    readOwn: 'attendance:read-own',
  },

  /**
   * Examinations and their schedules.
   *
   * Publishing and archiving are separable from ordinary edits for the same
   * reason they are on an academic year: announcing a schedule to the whole
   * school, and closing one for good, are decisions rather than data entry.
   */
  exam: {
    ...resource('exam'),
    publish: 'exam:publish',
    archive: 'exam:archive',
  },
  // Feature modules extend this object as they land, e.g.:
  // attendance: resource('attendance'),
  // fee: resource('fee'),
} as const;

/** Flat list of every declared permission key — used by the seeder. */
export const ALL_PERMISSIONS: string[] = Object.values(PERMISSIONS).flatMap((group) =>
  Object.values(group),
);

/** Splits `student:create` into its parts. */
export function parsePermission(key: string): { resource: string; action: string } {
  const [res, action] = key.split(':');
  return { resource: res ?? key, action: action ?? 'manage' };
}
