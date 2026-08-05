import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';

import { SIDEBAR_WIDTH, SIDEBAR_WIDTH_COLLAPSED, sidebarPalette as c } from '@/app/theme';
import { env } from '@/config/env';
import { useAuth } from '@/features/auth';
import { ROUTES } from '@/shared/constants';

import { fullName, initials } from '@/shared/utils';

import { NAV_SECTIONS } from './navigation';

interface SidebarProps {
  /** Mobile drawer visibility; ignored on desktop where the drawer is permanent. */
  mobileOpen: boolean;
  onMobileClose: () => void;
  collapsed: boolean;
}

/**
 * Navigation drawer. Permanent from `md` up, temporary below it, so the same
 * markup serves both without a separate mobile menu to keep in step.
 */
export function Sidebar({ mobileOpen, onMobileClose, collapsed }: SidebarProps) {
  const { user, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Sections start open; only explicit closes are tracked.
  const [closedSections, setClosedSections] = useState<Record<string, boolean>>({});

  const width = collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH;

  const toggleSection = (key: string) =>
    setClosedSections((current) => ({ ...current, [key]: !current[key] }));

  const content = (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        color: c.text,
        background: c.gradient,
        position: 'relative',
        // The bloom is a layer rather than part of the gradient so it can be
        // tuned independently and does not smear the base ramp.
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: c.bloom,
          pointerEvents: 'none',
        },
        '& > *': { position: 'relative', zIndex: 1 },
      }}
    >
      {/* --- Workspace ------------------------------------------------------ */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: collapsed ? 0 : 1.5,
          py: 1.375,
          flexShrink: 0,
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}
      >
        <Box
          sx={{
            width: 29,
            height: 29,
            borderRadius: 2,
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            // White glass on the gradient reads brighter than any solid fill.
            bgcolor: 'rgba(255, 255, 255, 0.14)',
            border: '1px solid rgba(255, 255, 255, 0.20)',
            backdropFilter: 'blur(6px)',
            boxShadow: '0 3px 10px -3px rgba(0, 0, 0, 0.5)',
          }}
        >
          <SchoolRoundedIcon sx={{ fontSize: 16, color: '#fff' }} />
        </Box>

        {!collapsed && (
          <Box sx={{ minWidth: 0 }}>
            <Typography
              noWrap
              sx={{ color: '#fff', fontWeight: 600, fontSize: '0.8125rem', lineHeight: 1.3 }}
            >
              {env.appName}
            </Typography>
            <Typography
              noWrap
              sx={{ color: c.textMuted, fontSize: '0.625rem', letterSpacing: '0.02em' }}
            >
              {user?.roles[0] ?? 'Administration'}
            </Typography>
          </Box>
        )}
      </Box>

      {/* --- Navigation ----------------------------------------------------- */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', pb: 2 }}>
        {NAV_SECTIONS.map((section) => {
          const items = section.items.filter(
            (item) => item.permission === null || hasPermission(item.permission),
          );

          // A section whose every link is denied should not leave a stray heading.
          if (items.length === 0) return null;

          const open = !closedSections[section.key];
          const showCreate =
            !collapsed &&
            Boolean(section.createTo) &&
            (!section.createPermission || hasPermission(section.createPermission));

          return (
            <Box key={section.key} sx={{ mt: section.heading ? 1.5 : 0.25 }}>
              {section.heading && !collapsed && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.25,
                    pl: 1.25,
                    pr: 1,
                    mb: 0.25,
                  }}
                >
                  <Box
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleSection(section.key)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') toggleSection(section.key);
                    }}
                    aria-expanded={open}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      flex: 1,
                      minWidth: 0,
                      cursor: 'pointer',
                      borderRadius: 1,
                      py: 0.5,
                      color: c.textMuted,
                      '&:hover': { color: c.text },
                    }}
                  >
                    <ExpandMoreIcon
                      sx={{
                        fontSize: 14,
                        transition: 'transform 150ms ease',
                        transform: open ? 'none' : 'rotate(-90deg)',
                      }}
                    />
                    <Typography
                      noWrap
                      sx={{
                        fontSize: '0.625rem',
                        fontWeight: 700,
                        letterSpacing: '0.09em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {section.heading}
                    </Typography>
                  </Box>

                  {showCreate && (
                    <Tooltip title={section.createLabel ?? 'Create'} placement="right">
                      <IconButton
                        size="small"
                        aria-label={section.createLabel ?? 'Create'}
                        onClick={() => {
                          onMobileClose();
                          navigate(section.createTo as string);
                        }}
                        sx={{
                          color: c.textMuted,
                          p: 0.375,
                          '&:hover': { color: '#fff', bgcolor: c.hover },
                        }}
                      >
                        <AddIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              )}

              <Collapse in={open || collapsed} timeout={150} unmountOnExit>
                <List disablePadding sx={{ px: 1 }}>
                  {items.map((item) => {
                    const active = location.pathname.startsWith(item.to);
                    const Icon = item.icon;

                    return (
                      <Tooltip
                        key={item.to}
                        title={collapsed ? item.label : ''}
                        placement="right"
                        disableHoverListener={!collapsed}
                      >
                        <ListItemButton
                          component={RouterLink}
                          to={item.to}
                          onClick={onMobileClose}
                          // Warm the chunk before the click lands; a failed
                          // prefetch is harmless, the click loads it anyway.
                          onMouseEnter={() => void item.preload().catch(() => undefined)}
                          onFocus={() => void item.preload().catch(() => undefined)}
                          aria-current={active ? 'page' : undefined}
                          sx={{
                            borderRadius: 1.75,
                            mb: 0.25,
                            minHeight: 34,
                            py: 0,
                            px: collapsed ? 0 : 1,
                            justifyContent: collapsed ? 'center' : 'flex-start',
                            color: active ? c.textActive : c.text,
                            bgcolor: active ? c.activeBg : 'transparent',
                            border: '1px solid',
                            borderColor: active ? c.activeBorder : 'transparent',
                            backdropFilter: active ? 'blur(8px)' : 'none',
                            boxShadow: active ? c.activeShadow : 'none',
                            transition:
                              'background-color 140ms ease, color 140ms ease, border-color 140ms ease',
                            '&:hover': {
                              bgcolor: active ? c.activeBg : c.hover,
                              color: '#fff',
                            },
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: collapsed ? 0 : 26, color: 'inherit' }}>
                            <Icon sx={{ fontSize: 17 }} />
                          </ListItemIcon>

                          {!collapsed && (
                            <ListItemText
                              primary={item.label}
                              primaryTypographyProps={{
                                fontSize: '0.78125rem',
                                fontWeight: active ? 600 : 500,
                                letterSpacing: '0.005em',
                                noWrap: true,
                              }}
                            />
                          )}
                        </ListItemButton>
                      </Tooltip>
                    );
                  })}
                </List>
              </Collapse>
            </Box>
          );
        })}
      </Box>

      {/* --- Signed-in user -------------------------------------------------- */}
      {user && (
        <Box sx={{ flexShrink: 0, p: 1, borderTop: `1px solid ${c.border}` }}>
          {/* Doubles as the way into your own profile — the signed-in identity
              is where people look for it. */}
          <Box
            component={RouterLink}
            to={ROUTES.account.profile}
            onClick={onMobileClose}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              p: collapsed ? 0 : 0.875,
              borderRadius: 2,
              textDecoration: 'none',
              color: 'inherit',
              justifyContent: collapsed ? 'center' : 'flex-start',
              bgcolor: collapsed ? 'transparent' : c.footerBg,
              border: collapsed ? 'none' : '1px solid',
              borderColor: c.border,
              transition: 'background-color 140ms ease',
              '&:hover': { bgcolor: collapsed ? c.hover : 'rgba(15, 10, 40, 0.62)' },
            }}
          >
            <Tooltip title={collapsed ? fullName(user) : ''} placement="right">
              <Avatar
                src={user.avatarUrl ?? undefined}
                sx={{
                  width: 26,
                  height: 26,
                  fontSize: '0.625rem',
                  color: '#fff',
                  bgcolor: 'rgba(255, 255, 255, 0.18)',
                  border: '1px solid rgba(255, 255, 255, 0.22)',
                }}
              >
                {initials(user)}
              </Avatar>
            </Tooltip>

            {!collapsed && (
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  noWrap
                  sx={{ color: '#fff', fontSize: '0.75rem', fontWeight: 600, lineHeight: 1.35 }}
                >
                  {fullName(user)}
                </Typography>
                <Typography noWrap sx={{ color: c.textMuted, fontSize: '0.625rem' }}>
                  {user.email}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );

  return (
    <Box component="nav" sx={{ flexShrink: { md: 0 }, width: { md: width } }}>
      {/* Temporary drawer for small screens. */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: SIDEBAR_WIDTH, border: 0 },
        }}
      >
        {content}
      </Drawer>

      {/* Permanent drawer from md up. */}
      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            width,
            border: 0,
            overflowX: 'hidden',
            transition: 'width 180ms cubic-bezier(0.4, 0, 0.2, 1)',
          },
        }}
      >
        {content}
      </Drawer>
    </Box>
  );
}
