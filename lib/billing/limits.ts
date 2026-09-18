export type Plan = "free" | "pro";

/** What Free caps. Everything else is gated by `plan === "pro"` where it applies. */
export const LIMITS: Record<Plan, { games: number; revisions: number; aiScreenshots: number }> = {
  free: { games: 3, revisions: 10, aiScreenshots: 0 },
  pro: { games: Infinity, revisions: Infinity, aiScreenshots: 30 },
};

export const limitsFor = (plan: Plan) => LIMITS[plan];

export const GAME_LIMIT_MESSAGE = `Free keeps up to ${LIMITS.free.games} active games. Archive one or upgrade to Pro.`;
/** Contains "upgrade to Pro" so `toastError` adds its "See plans" action. */
export const AI_LIMIT_MESSAGE = "Screenshot import is a Pro feature — upgrade to Pro to use it.";
export const AI_DAILY_MESSAGE = `You've analysed ${LIMITS.pro.aiScreenshots} screenshots in the last 24 hours. Try again later.`;
