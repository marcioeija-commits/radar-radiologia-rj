import { boolean, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const monitorSources = mysqlTable("monitor_sources", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  category: mysqlEnum("category", ["official", "aggregator", "employer"]).notNull(),
  urls: text("urls").notNull(),
  keywords: text("keywords").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  lastCheckedAt: timestamp("lastCheckedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const opportunities = mysqlTable("opportunities", {
  id: int("id").autoincrement().primaryKey(),
  sourceId: int("sourceId").notNull(),
  externalId: varchar("externalId", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  organization: varchar("organization", { length: 255 }).notNull(),
  city: varchar("city", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["Técnico", "Tecnólogo", "Outro"]).notNull(),
  kind: mysqlEnum("kind", ["Concurso", "Processo seletivo", "Vaga", "Estágio", "Informativo"]).notNull(),
  sourceUrl: varchar("sourceUrl", { length: 1000 }).notNull(),
  publishedAt: timestamp("publishedAt"),
  deadlineAt: timestamp("deadlineAt"),
  summary: text("summary"),
  rawText: text("rawText"),
  contentHash: varchar("contentHash", { length: 64 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  sourceExternalUnique: uniqueIndex("opportunities_source_external_unique").on(table.sourceId, table.externalId),
  activeRoleIndex: index("opportunities_active_role_idx").on(table.isActive, table.role),
}));

export const alertPreferences = mysqlTable("alert_preferences", {
  userId: int("userId").primaryKey(),
  concursos: boolean("concursos").default(true).notNull(),
  processos: boolean("processos").default(true).notNull(),
  vagas: boolean("vagas").default(true).notNull(),
  tecnico: boolean("tecnico").default(true).notNull(),
  tecnologo: boolean("tecnologo").default(true).notNull(),
  todoEstado: boolean("todoEstado").default(true).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const pushDevices = mysqlTable("push_devices", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 512 }).notNull(),
  platform: mysqlEnum("platform", ["ios", "android", "web"]).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userTokenUnique: uniqueIndex("push_devices_user_token_unique").on(table.userId, table.token),
}));

export const monitorRuns = mysqlTable("monitor_runs", {
  id: int("id").autoincrement().primaryKey(),
  sourceId: int("sourceId").notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  finishedAt: timestamp("finishedAt"),
  status: mysqlEnum("status", ["running", "success", "failed"]).notNull(),
  foundCount: int("foundCount").default(0).notNull(),
  error: text("error"),
}, (table) => ({
  sourceStartedIndex: index("monitor_runs_source_started_idx").on(table.sourceId, table.startedAt),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type MonitorSource = typeof monitorSources.$inferSelect;
export type InsertMonitorSource = typeof monitorSources.$inferInsert;
export type Opportunity = typeof opportunities.$inferSelect;
export type InsertOpportunity = typeof opportunities.$inferInsert;
export type AlertPreference = typeof alertPreferences.$inferSelect;
export type PushDevice = typeof pushDevices.$inferSelect;
