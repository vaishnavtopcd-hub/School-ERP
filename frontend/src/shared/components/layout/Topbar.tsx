import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import LockResetOutlinedIcon from '@mui/icons-material/LockResetOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';

import { useColorMode } from '@/app/theme/color-mode';
import { TOPBAR_HEIGHT } from '@/app/theme';
import { useAuth, useLogout } from '@/features/auth';
import { ROUTES } from '@/shared/constants';

import { fullName, initials } from '@/shared/utils';

import { NAV_SECTIONS } from './navigation';

interface TopbarProps {
  onOpenMobileNav: () => void;
  onToggleCollapse: () => void;
  collapsed: boolean;
}

/** Resolves the current route to its nav label so the bar always names the page. */
function useCurrentPageTitle(): string {
  const { pathname } = useLocation();

  const match = NAV_SECTIONS.flatMap((section) => section.items).find((item) =>
    pathname.startsWith(item.to),
  );

  if (match) return match.label;
  if (pathname.startsWith(ROUTES.auth.changePassword)) return 'Change password';
  if (pathname.startsWith(ROUTES.account.profile)) return 'Profile & settings';
  return '';
}

export function Topbar({ onOpenMobileNav, onToggleCollapse, collapsed }: TopbarProps) {
  const { user } = useAuth();
  const logout = useLogout();
  const { mode, toggle } = useColorMode();
  const title = useCurrentPageTitle();

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const closeMenu = () => setAnchorEl(null);

  return (
    <AppBar
      position="sticky"
      elevation={0}
      color="inherit"
      sx={{
        // Translucent so content scrolling underneath stays faintly visible.
        bgcolor: (theme) => alpha(theme.palette.background.paper, 0.85),
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Toolbar sx={{ gap: 1, minHeight: `${TOPBAR_HEIGHT}px !important` }}>
        {/* Mobile: open the temporary drawer. */}
        <IconButton
          onClick={onOpenMobileNav}
          edge="start"
          aria-label="Open navigation"
          sx={{ display: { md: 'none' } }}
        >
          <MenuIcon />
        </IconButton>

        {/* Desktop: collapse the permanent drawer to icons. */}
        <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <IconButton
            onClick={onToggleCollapse}
            edge="start"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            sx={{ display: { xs: 'none', md: 'inline-flex' } }}
          >
            {collapsed ? <MenuIcon /> : <MenuOpenIcon />}
          </IconButton>
        </Tooltip>

        <Typography
          component="h1"
          noWrap
          sx={{ flex: 1, ml: 0.5, fontSize: '0.875rem', fontWeight: 600 }}
        >
          {title}
        </Typography>

        <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          <IconButton onClick={toggle} aria-label="Toggle colour mode">
            {mode === 'dark' ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
          </IconButton>
        </Tooltip>

        {user?.roles[0] && (
          <Chip
            label={user.roles[0]}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
          />
        )}

        <Tooltip title="Account">
          <IconButton
            onClick={(event) => setAnchorEl(event.currentTarget)}
            aria-label="Account menu"
            aria-haspopup="menu"
            sx={{ p: 0.5 }}
          >
            <Avatar
              src={user?.avatarUrl ?? undefined}
              sx={{ width: 29, height: 29, fontSize: '0.6875rem', bgcolor: 'primary.main' }}
            >
              {user ? initials(user) : '?'}
            </Avatar>
          </IconButton>
        </Tooltip>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={closeMenu}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{ paper: { sx: { mt: 1, minWidth: 240 } } }}
        >
          {user && (
            <Box sx={{ px: 2, py: 1.25 }}>
              <Typography variant="subtitle2" noWrap>
                {fullName(user)}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap component="div">
                {user.email}
              </Typography>
            </Box>
          )}

          <Divider sx={{ my: 0.5 }} />

          <MenuItem component={RouterLink} to={ROUTES.account.profile} onClick={closeMenu}>
            <ListItemIcon>
              <PersonOutlineOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Profile &amp; settings</ListItemText>
          </MenuItem>

          <MenuItem component={RouterLink} to={ROUTES.auth.changePassword} onClick={closeMenu}>
            <ListItemIcon>
              <LockResetOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Change password</ListItemText>
          </MenuItem>

          <MenuItem
            onClick={() => {
              closeMenu();
              logout.mutate(undefined);
            }}
            disabled={logout.isPending}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon>
              <LogoutOutlinedIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>{logout.isPending ? 'Signing out…' : 'Sign out'}</ListItemText>
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
