import type { MembershipRole } from '@qr-menu/shared';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  isSuperadmin: boolean;
  /** Stable id of this sign-in (auth_tokens.session_id); null for tokens minted before Phase 11. */
  sessionId: string | null;
  /**
   * Set while a superadmin acts through an "Open as owner" token (Phase 13): the token only works for this one
   * venue, `isSuperadmin` reads false for its duration, and audit rows name the superadmin as the actor.
   */
  impersonation?: { restaurantId: string };
}

export interface MembershipContext {
  restaurantId: string;
  role: MembershipRole;
  /** True when a superadmin is acting on a restaurant they are not a member of. */
  viaSuperadmin: boolean;
  /** True once requireOwner verified an elevation token (owner PIN / password) for this request, or no PIN is set. */
  elevated: boolean;
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
      /** Exact request bytes (JSON routes), kept for webhook signature checks. */
      rawBody?: Buffer;
    }
  }
}

export {};
