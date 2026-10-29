import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { HomeRedirect } from './components/shell/HomeRedirect';
import { FullPageLoading, RequireAuth } from './components/shell/RequireAuth';
import { RestaurantIndex, RestaurantLayout } from './components/shell/RestaurantLayout';
import { RouteError } from './components/shell/RouteError';
import { AdminLayout } from './components/admin/AdminShell';
import { NotFoundPage } from './pages/ErrorPages';
import { HomePage } from './pages/HomePage';

/** Route tree (data router, lazy page chunks). Tests mount it with createMemoryRouter. */
export const routes: RouteObject[] = [
  {
    path: '/',
    HydrateFallback: FullPageLoading,
    ErrorBoundary: RouteError,
    children: [
      { path: 'login', lazy: () => import('./pages/auth/LoginPage').then((m) => ({ Component: m.LoginPage })) },
      { path: 'register', lazy: () => import('./pages/auth/RegisterPage').then((m) => ({ Component: m.RegisterPage })) },
      { path: 'forgot', lazy: () => import('./pages/auth/ForgotPasswordPage').then((m) => ({ Component: m.ForgotPasswordPage })) },
      { path: 'auth/magic', lazy: () => import('./pages/auth/MagicLinkPage').then((m) => ({ Component: m.MagicLinkPage })) },
      { path: 'auth/reset', lazy: () => import('./pages/auth/ResetPasswordPage').then((m) => ({ Component: m.ResetPasswordPage })) },
      // Team (Phase 11): the e-mail invite link and the waiter join code.
      { path: 'auth/invite', lazy: () => import('./pages/auth/InvitePage').then((m) => ({ Component: m.InvitePage })) },
      { path: 'join', lazy: () => import('./pages/auth/JoinPage').then((m) => ({ Component: m.JoinPage })) },
      {
        element: <RequireAuth />,
        children: [
          { index: true, element: <HomeRedirect /> },
          { path: 'no-venue', lazy: () => import('./pages/NoVenuePage').then((m) => ({ Component: m.NoVenuePage })) },
          // Superadmin area (Phase 13): its own shell, nothing of the last venue in it.
          { path: 'superadmin/*', element: <Navigate to="/admin/restaurants" replace /> },
          {
            path: 'admin',
            element: <AdminLayout />,
            children: [
              { index: true, element: <Navigate to="/admin/restaurants" replace /> },
              { path: 'restaurants', lazy: () => import('./pages/admin/RestaurantsPage').then((m) => ({ Component: m.RestaurantsPage })) },
              { path: 'restaurants/new', lazy: () => import('./pages/admin/OnboardingPage').then((m) => ({ Component: m.OnboardingPage })) },
              { path: 'restaurants/:id/setup/:step', lazy: () => import('./pages/admin/OnboardingPage').then((m) => ({ Component: m.OnboardingPage })) },
              { path: 'restaurants/:id/:tab?', lazy: () => import('./pages/admin/RestaurantPage').then((m) => ({ Component: m.RestaurantPage })) },
              { path: 'users', lazy: () => import('./pages/admin/UsersPage').then((m) => ({ Component: m.UsersPage })) },
              { path: 'activity', lazy: () => import('./pages/admin/ActivityPage').then((m) => ({ Component: m.ActivityPage })) },
              { path: 'system', lazy: () => import('./pages/admin/SystemPage').then((m) => ({ Component: m.SystemPage })) },
            ],
          },
          {
            path: 'r/:restaurantId',
            element: <RestaurantLayout />,
            children: [
              { index: true, element: <RestaurantIndex /> },
              { path: 'home', element: <HomePage /> },
              { path: 'menu', lazy: () => import('./pages/MenuPage').then((m) => ({ Component: m.MenuPage })) },
              { path: 'menu/unavailable', lazy: () => import('./pages/UnavailablePage').then((m) => ({ Component: m.UnavailablePage })) },
              { path: 'tables', lazy: () => import('./pages/TablesPage').then((m) => ({ Component: m.TablesPage })) },
              { path: 'orders', lazy: () => import('./pages/OrdersPage').then((m) => ({ Component: m.OrdersPage })) },
              { path: 'branding', lazy: () => import('./pages/BrandingPage').then((m) => ({ Component: m.BrandingPage })) },
              { path: 'analytics', lazy: () => import('./pages/AnalyticsPage').then((m) => ({ Component: m.AnalyticsPage })) },
              { path: 'settings', lazy: () => import('./pages/SettingsPage').then((m) => ({ Component: m.SettingsPage })) },
              { path: 'settings/modules', lazy: () => import('./pages/ModulesPage').then((m) => ({ Component: m.ModulesPage })) },
              { path: 'settings/history', lazy: () => import('./pages/AuditLogPage').then((m) => ({ Component: m.AuditLogPage })) },
              { path: 'more', lazy: () => import('./pages/MorePage').then((m) => ({ Component: m.MorePage })) },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
