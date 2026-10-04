import { createHash, timingSafeEqual } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, inArray, isNull, isNotNull, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  alertPreferences,
  deviceAlertPreferences,
  InsertUser,
  monitorSources,
  monitorRuns,
  opportunities,
  pushDevices,
  users,
  type AlertPreference,
  type DeviceAlertPreference,
  type InsertOpportunity,
  type PushDevice,
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
      urls: JSON.stringify(["https://www.ioerj.com.br/portal/modules/conteudoonline/busca_do.php"]),
      keywords: JSON.stringify(["Técnico em Radiologia", "Tecnico em Radiologia", "Tecnólogo em Radiologia", "Tecnologo em Radiologia", "radiodiagnóstico", "diagnóstico por imagem", "imagenologia"]),
      enabled: true,
    },
    {
      slug: "prefeitura-rio-sms-riosaude",
      name: "Prefeitura do Rio, SMS-Rio e RioSaúde",
      category: "official" as const,
      urls: JSON.stringify([
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
        "https://www.rj.gov.br/fundacaosaude/noticias",
      ]),
      keywords: JSON.stringify(["Técnico em Radiologia", "Técnico de Radiologia", "Tecnólogo em Radiologia", "Radiologia", "Radiodiagnóstico"]),
      enabled: true,
    },
    {
      slug: "ses-rj-selecoes",
      name: "Secretaria de Estado de Saúde do Rio de Janeiro",
      category: "official" as const,
      urls: JSON.stringify([
        "https://www.saude.rj.gov.br/recursos-humanos",
        "https://www.saude.rj.gov.br/organizacoes-sociais-de-saude/editais-de-selecao",
        "https://www.saude.rj.gov.br/noticias",
      ]),
      keywords: JSON.stringify(["Técnico em Radiologia", "Tecnólogo em Radiologia", "radiodiagnóstico", "diagnóstico por imagem"]),
      enabled: true,
    },
    {
      slug: "pci-concursos-rj",
      name: "PCI Concursos — fonte auxiliar (confirmar no órgão oficial)",
      category: "aggregator" as const,
      urls: JSON.stringify([
        "https://www.pciconcursos.com.br/concursos/rj/",
        "https://www.pciconcursos.com.br/vagas/tecnico-em-radiologia",
        "https://www.pciconcursos.com.br/vagas/tecnologo-em-radiologia",
      ]),
      keywords: JSON.stringify(["Técnico em Radiologia", "Tecnólogo em Radiologia"]),
      enabled: true,
    },
  ];
  for (const source of sources) {
    await db.insert(monitorSources).values(source).onDuplicateKeyUpdate({
      set: { name: source.name, category: source.category, urls: source.urls, keywords: source.keywords, enabled: source.enabled },
    });
  }
}

export async function recordMonitorRun(result: {
  sourceId: number;
  url: string;
  startedAt: Date;
  finishedAt: Date;
  httpStatus: number | null;
  foundCount: number;
  durationMs: number;
  error: string | null;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(monitorRuns).values({
    sourceId: result.sourceId,
    url: result.url,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    httpStatus: result.httpStatus,
    status: result.error ? "failed" : "success",
    foundCount: result.foundCount,
    durationMs: result.durationMs,
    error: result.error,
  });
  await db.update(monitorSources).set({ lastCheckedAt: result.finishedAt }).where(eq(monitorSources.id, result.sourceId));
}

export async function getOpportunityById(id: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select({
      id: opportunities.id,
      title: opportunities.title,
      sourceUrl: opportunities.sourceUrl,
    })
    .from(opportunities)
    .where(eq(opportunities.id, id))
    .limit(1);

  return result[0] ?? null;
}

export async function listRecentOpportunities(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: opportunities.id,
    title: opportunities.title,
    organization: opportunities.organization,
    city: opportunities.city,
    role: opportunities.role,
    kind: opportunities.kind,
    sourceUrl: opportunities.sourceUrl,
    publishedAt: opportunities.publishedAt,
    deadlineAt: opportunities.deadlineAt,
    summary: opportunities.summary,
  }).from(opportunities).where(and(eq(opportunities.isActive, true), or(isNull(opportunities.publishedAt), gte(opportunities.publishedAt, new Date(Date.now() - 120 * 24 * 60 * 60 * 1000))), or(isNull(opportunities.deadlineAt), gte(opportunities.deadlineAt, new Date())))).orderBy(desc(opportunities.publishedAt), desc(opportunities.createdAt)).limit(Math.min(Math.max(limit, 1), 100));
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
  const linked = await db.select({ installationId: pushDevices.installationId })
    .from(pushDevices)
    .where(and(eq(pushDevices.linkedUserId, userId), isNotNull(pushDevices.installationId)));
  for (const device of linked) {
    if (device.installationId) await upsertDevicePreferences(device.installationId, values);
  }
  return getAlertPreferences(userId);
}

export async function registerPushDevice(userId: number, token: string, platform: "ios" | "android" | "web") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db.select({ id: pushDevices.id }).from(pushDevices)
    .where(and(eq(pushDevices.userId, userId), eq(pushDevices.token, token), isNull(pushDevices.credentialHash))).limit(1);
  if (existing[0]) {
    await db.update(pushDevices).set({ platform, enabled: true, lastSeenAt: new Date() })
      .where(eq(pushDevices.id, existing[0].id));
  } else {
    await db.insert(pushDevices).values({ userId, token, platform, enabled: true, lastSeenAt: new Date() });
  }
  return { ok: true } as const;
}

export async function registerAnonymousPushDevice(token: string, platform: "ios" | "android" | "web", installationId?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Keep a stable private user identity per app installation, even if Expo rotates its push token.
  const identity = installationId ? `installation:${installationId}` : `token:${token}`;
  const openId = `ap:${createHash("sha256").update(identity).digest("hex").slice(0, 61)}`;
  await db.insert(users).values({ openId, name: "Dispositivo anônimo", loginMethod: "anonymous-push-device" })
    .onDuplicateKeyUpdate({ set: { loginMethod: "anonymous-push-device" } });
  const anonymousUser = await db.select({ id: users.id }).from(users).where(eq(users.openId, openId)).limit(1);
  if (!anonymousUser[0]) throw new Error("Could not create anonymous push identity");

  const existing = await db.select({ id: pushDevices.id, userId: pushDevices.userId }).from(pushDevices)
    .where(and(eq(pushDevices.token, token), isNull(pushDevices.credentialHash))).limit(1);
  if (existing[0]) {
    if (existing[0].userId === anonymousUser[0].id) {
      await db.update(pushDevices).set({ platform, enabled: true, lastSeenAt: new Date() })
        .where(eq(pushDevices.id, existing[0].id));
    }
    return { ok: true } as const;
  }

  return registerPushDevice(anonymousUser[0].id, token, platform);
}

export async function setPushDeviceEnabled(token: string, enabled: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Kept for old APKs during transition; token-only requests never affect credentialed installations.
  await db.update(pushDevices).set({ enabled, lastSeenAt: new Date() })
    .where(and(eq(pushDevices.token, token), isNull(pushDevices.credentialHash)));
  return { ok: true } as const;
}

export type DevicePreferences = Pick<DeviceAlertPreference,
  "concursos" | "processos" | "vagas" | "tecnico" | "tecnologo" | "todoEstado"
>;

const defaultDevicePreferences: DevicePreferences = {
  concursos: true,
  processos: true,
  vagas: true,
  tecnico: true,
  tecnologo: true,
  todoEstado: true,
};

function hashInstallationSecret(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

function credentialMatches(secret: string, storedHash: string | null) {
  if (!storedHash || !/^[a-f0-9]{64}$/i.test(storedHash)) return false;
  const candidate = Buffer.from(hashInstallationSecret(secret), "hex");
  const expected = Buffer.from(storedHash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

async function getOrCreateInstallationUser(installationId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Separate internal pseudo-users from legacy installation identities without modifying legacy rows.
  const openId = `ap:${createHash("sha256").update(`secure-installation:${installationId}`).digest("hex").slice(0, 61)}`;
  await db.insert(users).values({ openId, name: "Dispositivo anônimo", loginMethod: "anonymous-push-device" })
    .onDuplicateKeyUpdate({ set: { loginMethod: "anonymous-push-device" } });
  const result = await db.select({ id: users.id }).from(users).where(eq(users.openId, openId)).limit(1);
  if (!result[0]) throw new Error("Could not create installation identity");
  return result[0].id;
}

async function getAuthorizedInstallation(installationId: string, secret: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(pushDevices).where(eq(pushDevices.installationId, installationId)).limit(1);
  const device = result[0];
  if (!device || !credentialMatches(secret, device.credentialHash)) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Credencial da instalação inválida" });
  }
  return device;
}

async function upsertDevicePreferences(installationId: string, values: DevicePreferences) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(deviceAlertPreferences).values({ installationId, ...values })
    .onDuplicateKeyUpdate({ set: values });
}

async function getDevicePreferences(installationId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(deviceAlertPreferences)
    .where(eq(deviceAlertPreferences.installationId, installationId)).limit(1);
  if (result[0]) return result[0];
  await upsertDevicePreferences(installationId, defaultDevicePreferences);
  const created = await db.select().from(deviceAlertPreferences)
    .where(eq(deviceAlertPreferences.installationId, installationId)).limit(1);
  if (!created[0]) throw new Error("Could not initialize installation preferences");
  return created[0];
}

export async function registerInstallationPushDevice(input: {
  installationId: string;
  secret: string;
  token: string;
  platform: "ios" | "android" | "web";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(pushDevices)
    .where(eq(pushDevices.installationId, input.installationId)).limit(1);
  const secretHash = hashInstallationSecret(input.secret);
  if (existing[0]) {
    if (!credentialMatches(input.secret, existing[0].credentialHash)) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Credencial da instalação inválida" });
    }
    const conflictingDevice = await db.select({ id: pushDevices.id }).from(pushDevices)
      .where(and(eq(pushDevices.token, input.token), isNotNull(pushDevices.credentialHash)))
      .limit(1);
    if (conflictingDevice[0] && conflictingDevice[0].id !== existing[0].id) {
      throw new TRPCError({ code: "CONFLICT", message: "Este token já está associado a outra instalação" });
    }
    await db.update(pushDevices).set({ token: input.token, platform: input.platform, lastSeenAt: new Date() })
      .where(eq(pushDevices.id, existing[0].id));
    await getDevicePreferences(input.installationId);
    return { ok: true, enabled: existing[0].enabled } as const;
  }

  const conflictingDevice = await db.select({ id: pushDevices.id }).from(pushDevices)
    .where(and(eq(pushDevices.token, input.token), isNotNull(pushDevices.credentialHash))).limit(1);
  if (conflictingDevice[0]) {
    throw new TRPCError({ code: "CONFLICT", message: "Este token já está associado a outra instalação" });
  }

  const userId = await getOrCreateInstallationUser(input.installationId);
  await db.insert(pushDevices).values({
    userId,
    token: input.token,
    platform: input.platform,
    enabled: true,
    lastSeenAt: new Date(),
    installationId: input.installationId,
    credentialHash: secretHash,
  });
  await upsertDevicePreferences(input.installationId, defaultDevicePreferences);
  return { ok: true, enabled: true } as const;
}

export async function setInstallationPushEnabled(installationId: string, secret: string, enabled: boolean) {
  const device = await getAuthorizedInstallation(installationId, secret);
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(pushDevices).set({ enabled, lastSeenAt: new Date() }).where(eq(pushDevices.id, device.id));
  return { ok: true } as const;
}

export async function getInstallationPreferences(installationId: string, secret: string, userId?: number) {
  const device = await getAuthorizedInstallation(installationId, secret);
  const preferences = await getDevicePreferences(installationId);
  return { ...preferences, linked: userId !== undefined && device.linkedUserId === userId };
}

export async function saveInstallationPreferences(installationId: string, secret: string, values: DevicePreferences) {
  const device = await getAuthorizedInstallation(installationId, secret);
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await upsertDevicePreferences(installationId, values);
  if (device.linkedUserId !== null) {
    await db.insert(alertPreferences).values({ userId: device.linkedUserId, ...values })
      .onDuplicateKeyUpdate({ set: values });
    const linked = await db.select({ installationId: pushDevices.installationId }).from(pushDevices)
      .where(and(eq(pushDevices.linkedUserId, device.linkedUserId), isNotNull(pushDevices.installationId)));
    for (const linkedDevice of linked) {
      if (linkedDevice.installationId) await upsertDevicePreferences(linkedDevice.installationId, values);
    }
  }
  return getDevicePreferences(installationId);
}

export async function linkInstallationToUser(
  installationId: string,
  secret: string,
  userId: number,
  syncMode: "account_to_device" | "device_to_account",
) {
  const device = await getAuthorizedInstallation(installationId, secret);
  if (device.linkedUserId !== null && device.linkedUserId !== userId) {
    throw new TRPCError({ code: "CONFLICT", message: "A instalação já está vinculada a outra conta" });
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(pushDevices).set({ linkedUserId: userId }).where(eq(pushDevices.id, device.id));
  if (syncMode === "account_to_device") {
    const accountPreferences = await getAlertPreferences(userId);
    await upsertDevicePreferences(installationId, accountPreferences);
  } else {
    const devicePreferences = await getDevicePreferences(installationId);
    await db.insert(alertPreferences).values({
      userId,
      concursos: devicePreferences.concursos,
      processos: devicePreferences.processos,
      vagas: devicePreferences.vagas,
      tecnico: devicePreferences.tecnico,
      tecnologo: devicePreferences.tecnologo,
      todoEstado: devicePreferences.todoEstado,
    }).onDuplicateKeyUpdate({
      set: {
        concursos: devicePreferences.concursos,
        processos: devicePreferences.processos,
        vagas: devicePreferences.vagas,
        tecnico: devicePreferences.tecnico,
        tecnologo: devicePreferences.tecnologo,
        todoEstado: devicePreferences.todoEstado,
      },
    });
    const linked = await db.select({ installationId: pushDevices.installationId }).from(pushDevices)
      .where(and(eq(pushDevices.linkedUserId, userId), isNotNull(pushDevices.installationId)));
    for (const linkedDevice of linked) {
      if (linkedDevice.installationId) await upsertDevicePreferences(linkedDevice.installationId, devicePreferences);
    }
  }
  return { ok: true } as const;
}

export async function unlinkInstallationFromUser(installationId: string, secret: string, userId: number) {
  const device = await getAuthorizedInstallation(installationId, secret);
  if (device.linkedUserId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "A instalação não está vinculada a esta conta" });
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(pushDevices).set({ linkedUserId: null }).where(eq(pushDevices.id, device.id));
  return { ok: true } as const;
}

export async function getPushDeviceAlertPreferences(device: PushDevice) {
  if (device.credentialHash && device.installationId) {
    return getDevicePreferences(device.installationId);
  }
  return getAlertPreferences(device.userId);
}

export async function listEnabledPushDevices(userIds?: number[]) {
  const db = await getDb();
  if (!db) return [];
  const filters = [eq(pushDevices.enabled, true)];
  if (userIds?.length) filters.push(inArray(pushDevices.userId, userIds));
  return db.select().from(pushDevices).where(and(...filters));
}

export async function getInstallationPushToken(installationId: string, secret: string) {
  const device = await getAuthorizedInstallation(installationId, secret);
  if (!device.enabled) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "As notificações estão desativadas neste aparelho" });
  }
  return { token: device.token, platform: device.platform } as const;
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
