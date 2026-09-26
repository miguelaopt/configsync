import "server-only";
import { and, asc, count, desc, eq, gte, ilike, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { resolvePlan, type PlanRow } from "@/lib/billing/paddle";
import { everyDay, planCounts, revenue } from "@/lib/admin/metrics";
import type { DeviceApplied } from "@/lib/db/schema";

const {
  users,
  sessions,
  accounts,
  profiles,
  plans,
  billingEvents,
  games,
  presets,
  revisions,
  devices,
  deviceGames,
  companionTokens,
  aiRequests,
  adminAudit,
} = schema;

// Every exported reader checks the admin itself: the /admin layout's check doesn't run on a
// client navigation between its pages, so a page must never be the only guard of its data.

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

// Overview ---------------------------------------------------------------------------------------

/** Users with a session refreshed or a companion heartbeat since `since`. */
async function activeSince(since: Date) {
  const [row] = await db.execute<{ n: number }>(sql`
    select count(*)::int as n from (
      select user_id from ${sessions} where ${sessions.updatedAt} >= ${since.toISOString()}
      union
      select user_id from ${devices} where ${devices.lastSeenAt} >= ${since.toISOString()}
    ) active`);
  return row?.n ?? 0;
}

async function countSince(table: typeof users | typeof devices, since?: Date) {
  const [row] = await db
    .select({ n: count() })
    .from(table)
    .where(since ? gte(table.createdAt, since) : undefined);
  return row?.n ?? 0;
}

async function perDay(table: "users" | "ai_requests" | "devices", days: number) {
  const rows = await db.execute<{ day: string; n: number }>(sql`
    select to_char(created_at at time zone 'UTC', 'YYYY-MM-DD') as day, count(*)::int as n
    from ${sql.identifier(table)}
    where created_at >= ${daysAgo(days).toISOString()}
    group by 1`);
  return everyDay([...rows], days);
}

export type AdminActivity = {
  kind: "signup" | "billing" | "device";
  text: string;
  at: Date;
  userId: string | null;
};

export async function getAdminOverview() {
  await requireAdmin();
  const [
    totalUsers,
    new1,
    new7,
    new30,
    active1,
    active7,
    active30,
    planRows,
    events,
    signups,
    totalDevices,
    recentSignups,
    recentEvents,
    recentDevices,
  ] = await Promise.all([
    countSince(users),
    countSince(users, daysAgo(1)),
    countSince(users, daysAgo(7)),
    countSince(users, daysAgo(30)),
    activeSince(daysAgo(1)),
    activeSince(daysAgo(7)),
    activeSince(daysAgo(30)),
    db.select().from(plans),
    db.select().from(billingEvents).orderBy(asc(billingEvents.receivedAt)),
    perDay("users", 30),
    countSince(devices),
    db
      .select({ id: users.id, name: users.name, email: users.email, at: users.createdAt })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(8),
    db
      .select({
        type: billingEvents.eventType,
        at: billingEvents.receivedAt,
        userId: billingEvents.userId,
        email: users.email,
      })
      .from(billingEvents)
      .leftJoin(users, eq(users.id, billingEvents.userId))
      .orderBy(desc(billingEvents.receivedAt))
      .limit(8),
    db
      .select({
        name: devices.name,
        platform: devices.platform,
        at: devices.createdAt,
        userId: devices.userId,
        email: users.email,
      })
      .from(devices)
      .innerJoin(users, eq(users.id, devices.userId))
      .orderBy(desc(devices.createdAt))
      .limit(8),
  ]);

  const activity: AdminActivity[] = [
    ...recentSignups.map((u) => ({
      kind: "signup" as const,
      text: `${u.name} signed up (${u.email})`,
      at: u.at,
      userId: u.id,
    })),
    ...recentEvents.map((e) => ({
      kind: "billing" as const,
      text: `${e.type}${e.email ? ` · ${e.email}` : ""}`,
      at: e.at,
      userId: e.userId,
    })),
    ...recentDevices.map((d) => ({
      kind: "device" as const,
      text: `New PC "${d.name}" (${d.platform ?? "?"}) · ${d.email}`,
      at: d.at,
      userId: d.userId,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 12);

  const counts = planCounts(planRows);
  return {
    users: { total: totalUsers, new1, new7, new30 },
    active: { d1: active1, d7: active7, d30: active30 },
    plans: counts,
    conversion: totalUsers ? counts.pro / totalUsers : 0,
    revenue: { all: revenue(events), d30: revenue(events, daysAgo(30)) },
    signups,
    devices: totalDevices,
    activity,
  };
}

// Users ------------------------------------------------------------------------------------------

export type AdminUserFilter = "all" | "pro" | "free" | "banned" | "admin" | "unverified";
export const ADMIN_PAGE_SIZE = 50;

export type AdminUserRow = Awaited<ReturnType<typeof loadUserRows>>[number] & {
  plan: "free" | "pro";
};

function loadUserRows(q: string) {
  const like = `%${q}%`;
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      emailVerified: users.emailVerified,
      role: users.role,
      banned: users.banned,
      createdAt: users.createdAt,
      username: profiles.username,
      isPublic: profiles.isPublic,
      planSource: plans.source,
      subscriptionStatus: plans.subscriptionStatus,
      currentPeriodEnd: plans.currentPeriodEnd,
      paddleCustomerId: plans.paddleCustomerId,
      paddleSubscriptionId: plans.paddleSubscriptionId,
      games: sql<number>`(select count(*)::int from ${games} g where g.user_id = "users"."id")`,
      devices: sql<number>`(select count(*)::int from ${devices} d where d.user_id = "users"."id")`,
      lastActive: sql<Date | null>`greatest(
        (select max(s.updated_at) from ${sessions} s where s.user_id = "users"."id"),
        (select max(d.last_seen_at) from ${devices} d where d.user_id = "users"."id"))`,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .leftJoin(plans, eq(plans.userId, users.id))
    .where(
      q
        ? or(ilike(users.email, like), ilike(users.name, like), ilike(profiles.username, like))
        : undefined,
    )
    .orderBy(desc(users.createdAt));
}

const planRowOf = (r: {
  id: string;
  planSource: PlanRow["source"] | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: Date | null;
  paddleCustomerId: string | null;
  paddleSubscriptionId: string | null;
}): PlanRow | null =>
  r.planSource
    ? {
        userId: r.id,
        source: r.planSource,
        subscriptionStatus: r.subscriptionStatus,
        currentPeriodEnd: r.currentPeriodEnd,
        paddleCustomerId: r.paddleCustomerId,
        paddleSubscriptionId: r.paddleSubscriptionId,
      }
    : null;

/**
 * Every account, filtered and paged in memory so the plan filter uses the same resolvePlan the
 * app gates on. ponytail: one query over all users; move the filter into SQL past ~20k accounts.
 */
export async function listAdminUsers(opts: { q: string; filter: AdminUserFilter; page: number }) {
  await requireAdmin();
  const rows = (await loadUserRows(opts.q.trim())).map((r) => ({
    ...r,
    lastActive: r.lastActive ? new Date(r.lastActive) : null,
    plan: resolvePlan(planRowOf(r)),
  }));
  const keep = (r: AdminUserRow) => {
    switch (opts.filter) {
      case "pro":
        return r.plan === "pro";
      case "free":
        return r.plan === "free";
      case "banned":
        return Boolean(r.banned);
      case "admin":
        return r.role === "admin";
      case "unverified":
        return !r.emailVerified;
      default:
        return true;
    }
  };
  const filtered = rows.filter(keep);
  const start = (opts.page - 1) * ADMIN_PAGE_SIZE;
  return { total: filtered.length, rows: filtered.slice(start, start + ADMIN_PAGE_SIZE) };
}

export async function getAdminUser(userId: string) {
  await requireAdmin();
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return null;
  const [
    profile,
    planRow,
    userSessions,
    userAccounts,
    userDevices,
    userGames,
    tokens,
    ai,
    events,
    audit,
    installed,
  ] = await Promise.all([
    db.query.profiles.findFirst({ where: eq(profiles.userId, userId) }),
    db.query.plans.findFirst({ where: eq(plans.userId, userId) }),
    db.select().from(sessions).where(eq(sessions.userId, userId)).orderBy(desc(sessions.updatedAt)),
    db
      .select({ providerId: accounts.providerId, createdAt: accounts.createdAt })
      .from(accounts)
      .where(eq(accounts.userId, userId)),
    db.select().from(devices).where(eq(devices.userId, userId)).orderBy(desc(devices.lastSeenAt)),
    db
      .select({
        id: games.id,
        name: games.name,
        slug: games.slug,
        catalogId: games.catalogId,
        isArchived: games.isArchived,
        updatedAt: games.updatedAt,
        presets: sql<number>`(select count(*)::int from ${presets} p where p.game_id = "games"."id")`,
        publicPresets: sql<number>`(select count(*)::int from ${presets} p where p.game_id = "games"."id" and p.visibility = 'public')`,
        snapshots: sql<number>`(select count(*)::int from ${revisions} r join ${presets} p on p.id = r.preset_id where p.game_id = "games"."id")`,
      })
      .from(games)
      .where(eq(games.userId, userId))
      .orderBy(desc(games.updatedAt)),
    db
      .select({
        id: companionTokens.id,
        name: companionTokens.name,
        lastUsedAt: companionTokens.lastUsedAt,
        createdAt: companionTokens.createdAt,
      })
      .from(companionTokens)
      .where(eq(companionTokens.userId, userId))
      .orderBy(desc(companionTokens.createdAt)),
    db
      .select({
        requests: count(),
        inputTokens: sql<number>`coalesce(sum(${aiRequests.inputTokens}), 0)::int`,
        outputTokens: sql<number>`coalesce(sum(${aiRequests.outputTokens}), 0)::int`,
      })
      .from(aiRequests)
      .where(and(eq(aiRequests.userId, userId), gte(aiRequests.createdAt, daysAgo(30)))),
    db
      .select({
        id: billingEvents.id,
        type: billingEvents.eventType,
        at: billingEvents.receivedAt,
        payload: billingEvents.payload,
      })
      .from(billingEvents)
      .where(eq(billingEvents.userId, userId))
      .orderBy(desc(billingEvents.receivedAt)),
    listAudit({ targetUserId: userId, limit: 50 }),
    db.select({ n: count() }).from(deviceGames).where(eq(deviceGames.userId, userId)),
  ]);
  return {
    user,
    profile: profile ?? null,
    planRow: planRow ?? null,
    plan: resolvePlan(planRow ?? null),
    sessions: userSessions,
    accounts: userAccounts,
    devices: userDevices,
    games: userGames,
    tokens,
    ai: ai[0] ?? { requests: 0, inputTokens: 0, outputTokens: 0 },
    billing: events,
    revenue: revenue(
      [...events]
        .reverse()
        .map((e) => ({ eventType: e.type, payload: e.payload, receivedAt: e.at })),
    ),
    audit,
    installedGames: installed[0]?.n ?? 0,
  };
}

// Billing ----------------------------------------------------------------------------------------

export async function getAdminBilling(opts: { type: string; page: number }) {
  await requireAdmin();
  const where = opts.type ? ilike(billingEvents.eventType, `${opts.type}%`) : undefined;
  const [planRows, events, [total], types] = await Promise.all([
    db
      .select({
        userId: plans.userId,
        email: users.email,
        name: users.name,
        source: plans.source,
        subscriptionStatus: plans.subscriptionStatus,
        currentPeriodEnd: plans.currentPeriodEnd,
        paddleCustomerId: plans.paddleCustomerId,
        paddleSubscriptionId: plans.paddleSubscriptionId,
        updatedAt: plans.updatedAt,
      })
      .from(plans)
      .innerJoin(users, eq(users.id, plans.userId))
      .orderBy(desc(plans.updatedAt)),
    db
      .select({
        id: billingEvents.id,
        type: billingEvents.eventType,
        at: billingEvents.receivedAt,
        userId: billingEvents.userId,
        email: users.email,
        payload: billingEvents.payload,
      })
      .from(billingEvents)
      .leftJoin(users, eq(users.id, billingEvents.userId))
      .where(where)
      .orderBy(desc(billingEvents.receivedAt))
      .limit(ADMIN_PAGE_SIZE)
      .offset((opts.page - 1) * ADMIN_PAGE_SIZE),
    db.select({ n: count() }).from(billingEvents).where(where),
    db
      .selectDistinct({ type: billingEvents.eventType })
      .from(billingEvents)
      .orderBy(asc(billingEvents.eventType)),
  ]);
  return {
    plans: planRows.map((p) => ({ ...p, plan: resolvePlan({ ...p, userId: p.userId }) })),
    events,
    total: total?.n ?? 0,
    types: types.map((t) => t.type),
  };
}

// Usage ------------------------------------------------------------------------------------------

export async function getAdminUsage() {
  await requireAdmin();
  const [
    byCatalog,
    customGames,
    presetTotals,
    publicPresets,
    aiDays,
    aiModels,
    deviceRows,
    tokenRows,
  ] = await Promise.all([
    db
      .select({
        catalogId: games.catalogId,
        games: count(),
        users: sql<number>`count(distinct ${games.userId})::int`,
      })
      .from(games)
      .where(sql`${games.catalogId} is not null`)
      .groupBy(games.catalogId)
      .orderBy(desc(count())),
    db
      .select({ games: count(), users: sql<number>`count(distinct ${games.userId})::int` })
      .from(games)
      .where(sql`${games.catalogId} is null`),
    db
      .select({
        presets: count(),
        public: sql<number>`count(*) filter (where ${presets.visibility} = 'public')::int`,
        snapshots: sql<number>`(select count(*)::int from ${revisions})`,
      })
      .from(presets),
    db
      .select({
        id: presets.id,
        name: presets.name,
        slug: presets.slug,
        updatedAt: presets.updatedAt,
        game: games.name,
        gameSlug: games.slug,
        username: profiles.username,
        profilePublic: profiles.isPublic,
        email: users.email,
        userId: users.id,
      })
      .from(presets)
      .innerJoin(games, eq(games.id, presets.gameId))
      .innerJoin(users, eq(users.id, games.userId))
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(presets.visibility, "public"))
      .orderBy(desc(presets.updatedAt))
      .limit(100),
    db.execute<{ day: string; n: number; tokens: number }>(sql`
        select to_char(created_at at time zone 'UTC', 'YYYY-MM-DD') as day, count(*)::int as n,
               coalesce(sum(input_tokens + output_tokens), 0)::int as tokens
        from ${aiRequests} where created_at >= ${daysAgo(30).toISOString()} group by 1`),
    db
      .select({
        model: aiRequests.model,
        requests: count(),
        inputTokens: sql<number>`sum(${aiRequests.inputTokens})::int`,
        outputTokens: sql<number>`sum(${aiRequests.outputTokens})::int`,
        users: sql<number>`count(distinct ${aiRequests.userId})::int`,
      })
      .from(aiRequests)
      .where(gte(aiRequests.createdAt, daysAgo(30)))
      .groupBy(aiRequests.model),
    db
      .select({
        platform: devices.platform,
        lastSeenAt: devices.lastSeenAt,
        applied: devices.applied,
      })
      .from(devices),
    db
      .select({
        tokens: count(),
        used7: sql<number>`count(*) filter (where ${companionTokens.lastUsedAt} >= ${daysAgo(7).toISOString()})::int`,
      })
      .from(companionTokens),
  ]);

  const platforms = new Map<string, number>();
  const applyStatus = { applied: 0, waiting: 0, failed: 0 };
  let seen1 = 0;
  let seen7 = 0;
  for (const d of deviceRows) {
    platforms.set(d.platform ?? "unknown", (platforms.get(d.platform ?? "unknown") ?? 0) + 1);
    if (d.lastSeenAt >= daysAgo(1)) seen1++;
    if (d.lastSeenAt >= daysAgo(7)) seen7++;
    for (const a of Object.values((d.applied ?? {}) as DeviceApplied)) applyStatus[a.status]++;
  }

  const aiByDay = new Map([...aiDays].map((r) => [r.day, r]));
  return {
    catalog: byCatalog,
    custom: customGames[0] ?? { games: 0, users: 0 },
    presets: presetTotals[0] ?? { presets: 0, public: 0, snapshots: 0 },
    publicPresets,
    ai: {
      days: everyDay(
        [...aiDays].map((r) => ({ day: r.day, n: r.n })),
        30,
      ).map((d) => ({
        ...d,
        tokens: aiByDay.get(d.day)?.tokens ?? 0,
      })),
      models: aiModels,
    },
    devices: {
      total: deviceRows.length,
      seen1,
      seen7,
      platforms: [...platforms.entries()].sort((a, b) => b[1] - a[1]),
      applyStatus,
      newPerDay: await perDay("devices", 30),
    },
    tokens: tokenRows[0] ?? { tokens: 0, used7: 0 },
  };
}

// System -----------------------------------------------------------------------------------------

const TABLES = [
  "users",
  "sessions",
  "games",
  "presets",
  "settings",
  "revisions",
  "attachments",
  "devices",
  "companion_tokens",
  "ai_requests",
  "billing_events",
  "admin_audit",
] as const;

export async function getAdminSystem() {
  await requireAdmin();
  const [[size], tables, [sess]] = await Promise.all([
    db.execute<{ bytes: string }>(sql`select pg_database_size(current_database())::text as bytes`),
    db.execute<{ table: string; rows: number; bytes: string }>(sql`
      select c.relname as table, greatest(c.reltuples, 0)::bigint::int as rows,
             pg_total_relation_size(c.oid)::text as bytes
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relname in ${[...TABLES]}
      order by pg_total_relation_size(c.oid) desc`),
    db
      .select({
        active: sql<number>`count(*) filter (where ${sessions.expiresAt} > now())::int`,
        impersonating: sql<number>`count(*) filter (where ${sessions.expiresAt} > now() and ${sessions.impersonatedBy} is not null)::int`,
      })
      .from(sessions),
  ]);
  return {
    databaseBytes: Number(size?.bytes ?? 0),
    tables: [...tables].map((t) => ({ ...t, bytes: Number(t.bytes) })),
    sessions: sess ?? { active: 0, impersonating: 0 },
  };
}

// Audit ------------------------------------------------------------------------------------------

export async function recordAudit(entry: {
  actorId: string | null;
  action: string;
  targetUserId?: string | null;
  details?: Record<string, unknown>;
}) {
  await db.insert(adminAudit).values({
    actorId: entry.actorId,
    action: entry.action,
    targetUserId: entry.targetUserId ?? null,
    details: entry.details ?? {},
  });
}

export async function listAudit(
  opts: { targetUserId?: string; limit?: number; page?: number } = {},
) {
  await requireAdmin();
  const limit = opts.limit ?? ADMIN_PAGE_SIZE;
  return db
    .select({
      id: adminAudit.id,
      action: adminAudit.action,
      targetUserId: adminAudit.targetUserId,
      details: adminAudit.details,
      createdAt: adminAudit.createdAt,
      actorEmail: users.email,
    })
    .from(adminAudit)
    .leftJoin(users, eq(users.id, adminAudit.actorId))
    .where(opts.targetUserId ? eq(adminAudit.targetUserId, opts.targetUserId) : undefined)
    .orderBy(desc(adminAudit.createdAt))
    .limit(limit)
    .offset(((opts.page ?? 1) - 1) * limit);
}

export async function countAudit() {
  await requireAdmin();
  const [row] = await db.select({ n: count() }).from(adminAudit);
  return row?.n ?? 0;
}
