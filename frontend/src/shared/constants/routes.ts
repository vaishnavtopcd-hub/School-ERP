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

  timetable: {
    list: '/timetable',
  },

  exams: {
    list: '/exams',
    detailPattern: '/exams/:id',
    detail: (id: string) => `/exams/${id}`,
  },

  attendance: {
    /** The classes, and how far each register has got today. */
    list: '/attendance',
    sectionPattern: '/attendance/:sectionId',
    section: (sectionId: string) => `/attendance/${sectionId}`,
    /** A guardian's own children. Needs no id — the API derives them. */
    myChildren: '/my-children/attendance',
  },

  teachers: {
    list: '/teachers',
  },

  /**
   * Create, view, and edit are pages rather than dialogs: a record this size
   * deserves a URL you can link to, reload, and open in a tab.
   *
   * `:id` forms are for the route table; the functions build a path to visit.
   */
  students: {
    list: '/students',
    new: '/students/new',
    detailPattern: '/students/:id',
    detail: (id: string) => `/students/${id}`,
    editPattern: '/students/:id/edit',
    edit: (id: string) => `/students/${id}/edit`,
  },

  parents: {
    list: '/parents',
  },

  // Feature routes go here as modules land, e.g.:
  // students: { list: '/students', detail: (id: string) => `/students/${id}` },

  notFound: '*',
  forbidden: '/403',
} as const;
