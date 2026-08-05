/**
 * Route path registry. Every navigation target lives here so a path change is
 * a one-line edit rather than a codebase-wide grep.
 */
export const ROUTES = {
  root: '/',

  auth: {
    login: '/login',
    forgotPassword: '/forgot-password',
    /** The backend builds reset links against this path — keep them in step. */
    resetPassword: '/reset-password',
    changePassword: '/account/change-password',
  },

  account: {
    /** Own profile and preferences. Needs no permission — it is always self. */
    profile: '/account/profile',
  },

  dashboard: '/dashboard',

  users: {
    list: '/users',
  },

  academicYears: {
    list: '/academic-years',
  },

  mediums: {
    list: '/mediums',
  },

  classes: {
    list: '/classes',
  },

  subjects: {
    list: '/subjects',
  },

  teachers: {
    list: '/teachers',
  },

  students: {
    list: '/students',
  },

  parents: {
    list: '/parents',
  },

  // Feature routes go here as modules land, e.g.:
  // students: { list: '/students', detail: (id: string) => `/students/${id}` },

  notFound: '*',
  forbidden: '/403',
} as const;
