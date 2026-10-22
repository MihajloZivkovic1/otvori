import type { MembershipRole } from '@qr-menu/shared';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  isSuperadmin: boolean;
}

export interface MembershipContext {
  restaurantId: string;
  role: MembershipRole;
  /** True when a superadmin is acting on a restaurant they are not a member of. */
  viaSuperadmin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      membership?: MembershipContext;
      /** Restaurant slug resolved from the Host header subdomain (public routes). */
      restaurantSlug?: string;
      /** Guest session id from the X-Session-Id header (public ordering routes, see requireSession). */
      sessionId?: string;
    }
  }
}

export {};
