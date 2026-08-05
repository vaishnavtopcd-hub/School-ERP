import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ContactPhoneOutlinedIcon from '@mui/icons-material/ContactPhoneOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import MeetingRoomOutlinedIcon from '@mui/icons-material/MeetingRoomOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import TranslateOutlinedIcon from '@mui/icons-material/TranslateOutlined';
import type { SvgIconComponent } from '@mui/icons-material';

import { ROUTES } from '@/shared/constants';
import type { Permission } from '@/shared/types';

/**
 * Query flag a page reads to open its create dialog on arrival. Lets the
 * sidebar's `+` do real work instead of only navigating.
 */
export const CREATE_PARAM = 'new';

export interface NavItem {
  label: string;
  to: string;
  icon: SvgIconComponent;
  /** Permission the API would require; `null` means always visible. */
  permission: Permission | null;
  /**
   * Pulls the route's chunk ahead of the click. The specifier matches the one
   * `AppRouter` lazy-loads, so both resolve to the same module — warming this
   * on hover means the page is usually already in memory by the time it mounts.
   */
  preload: () => Promise<unknown>;
}

export interface NavSection {
  /** Stable key for the collapsed-state map. */
  key: string;
  /** Group heading, omitted for the top-level group. */
  heading?: string;
  /** Destination for the section's `+` button, if it has one. */
  createTo?: string;
  createPermission?: Permission;
  createLabel?: string;
  items: NavItem[];
}

/**
 * Primary navigation. Each entry declares the permission it needs, so links
 * appear only where the API would actually allow the page — the guard on the
 * route is what enforces it, this just avoids advertising a dead end.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    key: 'overview',
    items: [
      {
        label: 'Dashboard',
        to: ROUTES.dashboard,
        icon: GridViewOutlinedIcon,
        permission: null,
        preload: () => import('@/features/dashboard/pages/DashboardPage'),
      },
    ],
  },
  {
    key: 'academics',
    heading: 'Academics',
    createTo: `${ROUTES.academicYears.list}?${CREATE_PARAM}=1`,
    createPermission: 'academic-year:create',
    createLabel: 'New academic year',
    items: [
      {
        label: 'Academic Years',
        to: ROUTES.academicYears.list,
        icon: CalendarMonthOutlinedIcon,
        permission: 'academic-year:read',
        preload: () => import('@/features/academic-years/pages/AcademicYearsPage'),
      },
      {
        label: 'Classes',
        to: ROUTES.classes.list,
        icon: MeetingRoomOutlinedIcon,
        permission: 'class:read',
        preload: () => import('@/features/classes/pages/ClassesPage'),
      },
      {
        label: 'Subjects',
        to: ROUTES.subjects.list,
        icon: MenuBookOutlinedIcon,
        permission: 'subject:read',
        preload: () => import('@/features/subjects/pages/SubjectsPage'),
      },
      {
        label: 'Mediums',
        to: ROUTES.mediums.list,
        icon: TranslateOutlinedIcon,
        permission: 'medium:read',
        preload: () => import('@/features/mediums/pages/MediumsPage'),
      },
    ],
  },
  {
    key: 'administration',
    heading: 'Administration',
    createTo: `${ROUTES.users.list}?${CREATE_PARAM}=1`,
    createPermission: 'user:create',
    createLabel: 'New user',
    items: [
      {
        label: 'Teachers',
        to: ROUTES.teachers.list,
        icon: BadgeOutlinedIcon,
        permission: 'teacher:read',
        preload: () => import('@/features/teachers/pages/TeachersPage'),
      },
      {
        label: 'Students',
        to: ROUTES.students.list,
        icon: SchoolOutlinedIcon,
        permission: 'student:read',
        preload: () => import('@/features/students/pages/StudentsPage'),
      },
      {
        label: 'Parents',
        to: ROUTES.parents.list,
        icon: ContactPhoneOutlinedIcon,
        permission: 'parent:read',
        preload: () => import('@/features/parents/pages/ParentsPage'),
      },
      {
        label: 'Users',
        to: ROUTES.users.list,
        icon: PeopleAltOutlinedIcon,
        permission: 'user:read',
        preload: () => import('@/features/users/pages/UsersPage'),
      },
    ],
  },
];
