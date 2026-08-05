import Box from '@mui/material/Box';
import { Suspense, useState } from 'react';
import { Outlet } from 'react-router-dom';

import { RouteFallback } from '../feedback/RouteFallback';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const COLLAPSE_KEY = 'school-erp:sidebar-collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Application shell for authenticated routes: a permanent navigation drawer, a
 * sticky top bar, and the routed page. The drawer's collapsed state persists so
 * the layout does not reset on every navigation or reload.
 */
export function MainLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggleCollapse = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        // Preference simply won't persist.
      }
      return next;
    });
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        collapsed={collapsed}
      />

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar
          onOpenMobileNav={() => setMobileOpen(true)}
          onToggleCollapse={toggleCollapse}
          collapsed={collapsed}
        />

        <Box
          component="main"
          sx={{
            flex: 1,
            // Wide enough for dense tables, capped so text lines stay readable.
            width: '100%',
            maxWidth: 1600,
            mx: 'auto',
            p: { xs: 2, sm: 3 },
          }}
        >
          {/*
            The Suspense boundary lives here, not around <Routes>. A boundary
            above the shell would unmount the sidebar and top bar every time a
            route chunk loads, which looks like a full page reload.
          */}
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </Box>
      </Box>
    </Box>
  );
}
