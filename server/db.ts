import { and, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  alertPreferences,
  InsertUser,
  monitorSources,
  opportunities,
  pushDevices,
  users,
  type AlertPreference,
  type InsertOpportunity,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function listMonitorSources() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(monitorSources).where(eq(monitorSources.enabled, true));
}

export async function ensureMonitorSources() {
  const db = await getDb();
  if (!db) return;
  const sources = [
    {
      slug: "ioerj-doerj-rj",
      name: "Diário Oficial do Estado do Rio de Janeiro (IOERJ)",
      category: "official" as const,
      urls: JSON.stringify([
        "https://portal.ioerj.com.br/",
        "https://www.ioerj.com.br/portal/modules/conteudoonline/busca_do.php",
        "https://www.ioerj.com.br/portal/modules/conteudoonline/do_ultima_edicao.php",
      ]),
      keywords: JSON.stringify(["Técnico em Radiologia", "Tecnico em Radiologia", "Tecnólogo em Radiologia", "Tecnologo em Radiologia", "radiodiagnóstico", "diagnóstico por imagem", "imagenologia"]),
      enabled: true,
    },
    {
      slug: "prefeitura-rio-sms-riosaude",
      name: "Prefeitura do Rio, SMS-Rio e RioSaúde",
      category: "official" as const,
      urls: JSON.stringify([
        "https://saude.prefeitura.rio/gestao-de-pessoas/",
        "https://prefeitura.rio/rio-saude/processo-seletivo/",
        "https://riosaude.prefeitura.rio/processos-seletivos/",
        "https://riosaude.prefeitura.rio/processos-seletivos-editais-abertos/",
        "https://riosaude.prefeitura.rio/concursos-publicos-2/",
        "https://www.rio.rj.gov.br/web/portaldeconcursos/concursos",
        "https://www.rio.rj.gov.br/web/portaldeconcursos/processos-seletivos",
        "https://doweb.rio.rj.gov.br/",
      ]),
      keywords: JSON.stringify(["Técnico em Radiologia", "Técnico de Radiologia", "Tecnólogo em Radiologia", "Tecnologia em Radiologia", "Radiologia", "Imagem e Diagnóstico"]),
      enabled: true,
    },
    {
      slug: "fundacao-saude-rj",
      name: "Fundação Saúde do Estado do Rio de Janeiro",
      category: "employer" as const,
      urls: JSON.stringify([
        "https://www.fs.rj.gov.br/",
        "http://www.fs.rj.gov.br/concursos/",
        "http://www.fs.rj.gov.br/concursos/outras-convocacoes-e-noticias-sobre-concursos/?ano=Concursos",
      ]),
      keywords: JSON.stringify(["Técnico em Radiologia", "Técnico de Radiologia", "Tecnólogo em Radiologia", "Radiologia", "Radiodiagnóstico"]),
      enabled: true,
    },
  ];
  for (const source of sources) {
    await db.insert(monitorSources).values(source).onDuplicateKeyUpdate({
      set: { name: source.name, category: source.category, urls: source.urls, keywords: source.keywords, enabled: source.enabled },
    });
  }
}

export async function listRecentOpportunities(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(opportunities).where(eq(opportunities.isActive, true)).orderBy(desc(opportunities.publishedAt), desc(opportunities.createdAt)).limit(limit);
}

export async function getAlertPreferences(userId: number): Promise<AlertPreference> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(alertPreferences).where(eq(alertPreferences.userId, userId)).limit(1);
  if (result[0]) return result[0];
  const defaults = { userId, concursos: true, processos: true, vagas: true, tecnico: true, tecnologo: true, todoEstado: true } as const;
  await db.insert(alertPreferences).values(defaults);
  const created = await db.select().from(alertPreferences).where(eq(alertPreferences.userId, userId)).limit(1);
  return created[0];
}

export async function saveAlertPreferences(userId: number, values: Omit<AlertPreference, "userId" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(alertPreferences).values({ userId, ...values }).onDuplicateKeyUpdate({ set: values });
  return getAlertPreferences(userId);
}

export async function registerPushDevice(userId: number, token: string, platform: "ios" | "android" | "web") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(pushDevices).values({ userId, token, platform, enabled: true, lastSeenAt: new Date() }).onDuplicateKeyUpdate({
    set: { platform, enabled: true, lastSeenAt: new Date() },
  });
  return { ok: true } as const;
}

export async function listEnabledPushDevices(userIds?: number[]) {
  const db = await getDb();
  if (!db) return [];
  const filters = [eq(pushDevices.enabled, true)];
  if (userIds?.length) filters.push(inArray(pushDevices.userId, userIds));
  return db.select().from(pushDevices).where(and(...filters));
}

export async function upsertOpportunity(data: InsertOpportunity) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(opportunities).where(and(eq(opportunities.sourceId, data.sourceId), eq(opportunities.externalId, data.externalId))).limit(1);
  await db.insert(opportunities).values(data).onDuplicateKeyUpdate({
    set: {
      title: data.title,
      organization: data.organization,
      city: data.city,
      role: data.role,
      kind: data.kind,
      sourceUrl: data.sourceUrl,
      publishedAt: data.publishedAt,
      deadlineAt: data.deadlineAt,
      summary: data.summary,
      rawText: data.rawText,
      contentHash: data.contentHash,
      isActive: data.isActive,
    },
  });
  const result = await db.select().from(opportunities).where(and(eq(opportunities.sourceId, data.sourceId), eq(opportunities.externalId, data.externalId))).limit(1);
  return { opportunity: result[0], created: existing.length === 0 };
}
