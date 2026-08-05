import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from '@/features/auth';
import { FullPageSpinner } from '@/shared/components/feedback/FullPageSpinner';
import { MainLayout } from '@/shared/components/layout/MainLayout';
import { ROUTES } from '@/shared/constants';

// Pages are lazy-loaded so each ships as its own chunk.
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'));
const ForgotPasswordPage = lazy(() => import('@/features/auth/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/features/auth/pages/ResetPasswordPage'));
const ChangePasswordPage = lazy(() => import('@/features/auth/pages/ChangePasswordPage'));
const ProfilePage = lazy(() => import('@/features/profile/pages/ProfilePage'));
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'));
const UsersPage = lazy(() => import('@/features/users/pages/UsersPage'));
const AcademicYearsPage = lazy(() => import('@/features/academic-years/pages/AcademicYearsPage'));
const ClassesPage = lazy(() => import('@/features/classes/pages/ClassesPage'));
const SubjectsPage = lazy(() => import('@/features/subjects/pages/SubjectsPage'));
const TeachersPage = lazy(() => import('@/features/teachers/pages/TeachersPage'));
const StudentsPage = lazy(() => import('@/features/students/pages/StudentsPage'));
const ParentsPage = lazy(() => import('@/features/parents/pages/ParentsPage'));
const MediumsPage = lazy(() => import('@/features/mediums/pages/MediumsPage'));
const NotFoundPage = lazy(() => import('@/shared/components/feedback/NotFoundPage'));
const ForbiddenPage = lazy(() => import('@/shared/components/feedback/ForbiddenPage'));

/**
 * Route table.
 *
 * Public routes sit at the top level; everything else nests under
 * ProtectedRoute so authentication and RBAC are enforced by default rather
 * than remembered per page.
 *
 * This Suspense boundary only ever catches the public screens. Authenticated
 * pages suspend against the boundary inside `MainLayout`, which keeps the
 * sidebar and top bar mounted while their chunk loads.
 */
export function AppRouter() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        {/* --- Public ------------------------------------------------------ */}
        <Route path={ROUTES.auth.login} element={<LoginPage />} />
        <Route path={ROUTES.auth.forgotPassword} element={<ForgotPasswordPage />} />
        <Route path={ROUTES.auth.resetPassword} element={<ResetPasswordPage />} />
        <Route path={ROUTES.forbidden} element={<ForbiddenPage />} />

        {/* --- Authenticated ----------------------------------------------- */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path={ROUTES.root} element={<Navigate to={ROUTES.dashboard} replace />} />
            <Route path={ROUTES.dashboard} element={<DashboardPage />} />
            <Route path={ROUTES.auth.changePassword} element={<ChangePasswordPage />} />
            {/* Own account — no permission gate, the subject is always the actor. */}
            <Route path={ROUTES.account.profile} element={<ProfilePage />} />

            <Route element={<ProtectedRoute permissions={['user:read']} />}>
              <Route path={ROUTES.users.list} element={<UsersPage />} />
            </Route>

            <Route element={<ProtectedRoute permissions={['teacher:read']} />}>
              <Route path={ROUTES.teachers.list} element={<TeachersPage />} />
            </Route>

            <Route element={<ProtectedRoute permissions={['student:read']} />}>
              <Route path={ROUTES.students.list} element={<StudentsPage />} />
            </Route>

            <Route element={<ProtectedRoute permissions={['parent:read']} />}>
              <Route path={ROUTES.parents.list} element={<ParentsPage />} />
            </Route>

            <Route element={<ProtectedRoute permissions={['academic-year:read']} />}>
              <Route path={ROUTES.academicYears.list} element={<AcademicYearsPage />} />
            </Route>

            <Route element={<ProtectedRoute permissions={['class:read']} />}>
              <Route path={ROUTES.classes.list} element={<ClassesPage />} />
            </Route>

            <Route element={<ProtectedRoute permissions={['subject:read']} />}>
              <Route path={ROUTES.subjects.list} element={<SubjectsPage />} />
            </Route>

            <Route element={<ProtectedRoute permissions={['medium:read']} />}>
              <Route path={ROUTES.mediums.list} element={<MediumsPage />} />
            </Route>

            {/* Further feature routes mount here, gated the same way. */}
          </Route>
        </Route>

        <Route path={ROUTES.notFound} element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
