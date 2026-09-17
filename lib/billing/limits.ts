export type Plan = "free" | "pro";

/** The two things Free caps. Everything else is gated by `plan === "pro"` where it applies. */
export const LIMITS: Record<Plan, { games: number; revisions: number }> = {
  free: { games: 3, revisions: 10 },
  pro: { games: Infinity, revisions: Infinity },
};

export const limitsFor = (plan: Plan) => LIMITS[plan];

export const GAME_LIMIT_MESSAGE = `Free keeps up to ${LIMITS.free.games} active games. Archive one or upgrade to Pro.`;
