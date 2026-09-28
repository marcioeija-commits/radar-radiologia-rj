import { createHash } from "node:crypto";
import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import * as db from "./db";

const USER_AGENT = "RadarRadiologiaRJ/1.0 (+monitoramento de oportunidades; contato pelo app)";
const FETCH_TIMEOUT_MS = 18_000;
const FETCH_RETRIES = 2;
const MAX_TEXT_LENGTH = 20_000;
const MAX_CANDIDATES_PER_PAGE = 80;

const ROLE_TERMS = [
  { role: "Técnico" as const, terms: ["técnico em radiologia", "tecnico em radiologia", "técnico de radiologia", "tecnico de radiologia", "técnico radiologia", "tecnico radiologia"] },
  { role: "Tecnólogo" as const, terms: ["tecnólogo em radiologia", "tecnologo em radiologia", "tecnólogo de radiologia", "tecnologo de radiologia", "tecnologia em radiologia"] },
];
const OPPORTUNITY_TERMS = ["concurso", "processo seletivo", "processo de seleção", "vaga", "vagas", "edital", "convocação", "convocacoes", "contratação", "contratacao", "seleção", "selecao", "estágio", "estagio"];
const EXCLUDED_TERMS = ["termo de referência", "termo de referencia", "estudo técnico preliminar", "estudo tecnico preliminar", "pesquisa de preço", "pesquisa de preco", "contratação de serviço", "contratacao de servico"];

const OPPORTUNITY_MAX_AGE_MS = 120 * 24 * 60 * 60 * 1000;

function isCurrentOpportunity(candidate: MonitorCandidate): boolean {
  const now = Date.now();
  if (candidate.deadlineAt && candidate.deadlineAt.getTime() < now) return false;
  if (candidate.publishedAt && candidate.publishedAt.getTime() < now - OPPORTUNITY_MAX_AGE_MS) return false;
  return true;
}

export type MonitorCandidate = {
  externalId: string;
  title: string;
  organization: string;
  city: string;
  role: "Técnico" | "Tecnólogo" | "Outro";
  kind: "Concurso" | "Processo seletivo" | "Vaga" | "Estágio" | "Informativo";
  sourceUrl: string;
  publishedAt: Date | null;
  deadlineAt: Date | null;
  summary: string;
  rawText: string;
};

function normalizeText(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

function hash(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function inferRole(text: string): MonitorCandidate["role"] {
  const lower = text.toLocaleLowerCase("pt-BR");
  if (ROLE_TERMS[1].terms.some((term) => lower.includes(term))) return "Tecnólogo";
  if (ROLE_TERMS[0].terms.some((term) => lower.includes(term))) return "Técnico";
  if (lower.includes("radiologia") || lower.includes("radiodiagnóstico") || lower.includes("diagnóstico por imagem")) return "Outro";
  return "Outro";
}

export function inferKind(text: string): MonitorCandidate["kind"] {
  const lower = text.toLocaleLowerCase("pt-BR");
  if (lower.includes("estágio") || lower.includes("estagio")) return "Estágio";
  if (lower.includes("concurso")) return "Concurso";
  if (lower.includes("processo seletivo") || lower.includes("processo de seleção") || lower.includes("processo de selecao")) return "Processo seletivo";
  if (lower.includes("vaga") || lower.includes("vagas") || lower.includes("contratação") || lower.includes("contratacao")) return "Vaga";
  if (lower.includes("edital") || lower.includes("convocação") || lower.includes("convocacao")) return "Informativo";
  return "Informativo";
}

function findDate(text: string): Date | null {
  const match = text.match(/\b(\d{1,2})[\/.](\d{1,2})[\/.](20\d{2})\b/);
  if (!match) return null;

  const value = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  if (Number.isNaN(value.getTime())) return null;

  // Datas futuras no texto geralmente representam prazo, prova ou outro evento,
  // e não a data de publicação da oportunidade.
  if (value.getTime() > Date.now()) return null;

  return value;
}

export function looksLikeOpportunity(text: string): boolean {
  const lower = text.toLocaleLowerCase("pt-BR");
  const hasRadiology = lower.includes("radiologia") || lower.includes("radiodiagnóstico") || lower.includes("radiodiagnostico") || lower.includes("diagnóstico por imagem") || lower.includes("diagnostico por imagem") || lower.includes("imagenologia");
  const hasRole = ROLE_TERMS.some((entry) => entry.terms.some((term) => lower.includes(term)));
  const hasOpportunity = OPPORTUNITY_TERMS.some((term) => lower.includes(term));
  const isLikelyServiceDocument = EXCLUDED_TERMS.some((term) => lower.includes(term)) && !hasRole;
  return hasRadiology && (hasRole || hasOpportunity) && !isLikelyServiceDocument;
}

export function extractCandidates(html: string, pageUrl: string, sourceName: string): MonitorCandidate[] {
  const candidates: MonitorCandidate[] = [];
  const seen = new Set<string>();
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorPattern.exec(html)) && candidates.length < MAX_CANDIDATES_PER_PAGE) {
    const href = absoluteUrl(match[1], pageUrl);
    const title = normalizeText(match[2]);
    const before = html.slice(Math.max(0, match.index - 900), match.index);
    const after = html.slice(anchorPattern.lastIndex, Math.min(html.length, anchorPattern.lastIndex + 900));
    const fragment = normalizeText(`${before} ${match[0]} ${after}`);
    if (title.length < 4 && fragment.length < 20) continue;
    const context = normalizeText(`${fragment} ${sourceName} ${href}`);
    if (!looksLikeOpportunity(context)) continue;
    const displayTitle = title.length >= 12 ? title : fragment.slice(-500).slice(0, 255);
    const key = href;
    if (seen.has(key)) continue;
    seen.add(key);
    const role = inferRole(context);
    candidates.push({
      externalId: hash(key).slice(0, 48),
      title: displayTitle.slice(0, 255),
      organization: sourceName.slice(0, 255),
      city: "Rio de Janeiro (RJ)",
      role,
      kind: inferKind(context),
      sourceUrl: href,
      publishedAt: findDate(context),
      deadlineAt: null,
      summary: context.slice(0, 1000),
      rawText: context.slice(0, MAX_TEXT_LENGTH),
    });
  }

  return candidates;
}

async function fetchText(url: string, onHttpStatus: (status: number) => void): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= FETCH_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        redirect: "follow",
      });
      onHttpStatus(response.status);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("pdf") || new URL(response.url || url).pathname.toLowerCase().endsWith(".pdf")) {
        throw new Error("Resposta PDF; extração de PDF ainda não configurada");
      }
      const text = await response.text();
      if (!text.trim()) throw new Error("Resposta HTML vazia");
      return text;
    } catch (error) {
      lastError = error;
      if (attempt < FETCH_RETRIES) await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function sendExpoPushNotifications(items: MonitorCandidate[]) {
  if (items.length === 0) return { sent: 0 };
  const devices = await db.listEnabledPushDevices();
  const eligibleDevices = devices.filter((device) => /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(device.token));
  const devicePreferences = await Promise.all(eligibleDevices.map(async (device) => ({
    device,
    preference: await db.getPushDeviceAlertPreferences(device),
  })));
  // Do not mutate or merge database rows. If a legacy and secure row address the same Expo destination,
  // prefer the secure row for this send so an upgraded phone receives one message using its device prefs.
  const recipients = new Map<string, typeof devicePreferences[number]>();
  for (const entry of devicePreferences) {
    const current = recipients.get(entry.device.token);
    if (!current || (!current.device.credentialHash && entry.device.credentialHash)) {
      recipients.set(entry.device.token, entry);
    }
  }
  const messages = [...recipients.values()]
    .flatMap(({ device, preference }) => {
      if (!preference) return [];
      return items
        .filter((item) => {
          const kindEnabled = item.kind === "Concurso"
            ? preference.concursos
            : item.kind === "Processo seletivo"
              ? preference.processos
              : preference.vagas;
          const roleEnabled = item.role === "Técnico"
            ? preference.tecnico
            : item.role === "Tecnólogo" && preference.tecnologo;
          return kindEnabled && roleEnabled && preference.todoEstado;
        })
        .slice(0, 3)
        .map((item) => ({ to: device.token, sound: "default", title: `Nova oportunidade: ${item.role}`, body: item.title, data: { opportunityId: item.externalId, url: item.sourceUrl } }));
    });
  let sent = 0;
  for (let index = 0; index < messages.length; index += 100) {
    const batch = messages.slice(index, index + 100);
    const response = await fetch("https://exp.host/--/api/v2/push/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(batch), signal: AbortSignal.timeout(10_000) });
    if (!response.ok) continue;
    const payload = await response.json() as { data?: Array<{ status?: string }> };
    sent += payload.data?.filter((ticket) => ticket.status === "ok").length ?? 0;
  }
  return { sent };
}

export async function runMonitoringCycle() {
  await db.ensureMonitorSources();
  const sources = await db.listMonitorSources();
  const fresh: MonitorCandidate[] = [];
  const failures: string[] = [];
  let pages = 0;

  const jobs = sources.flatMap((source) => {
    const urls = JSON.parse(source.urls) as string[];
    return urls.map((url) => ({ source, url }));
  });

  const CONCURRENCY = 4;

  for (let index = 0; index < jobs.length; index += CONCURRENCY) {
    const batch = jobs.slice(index, index + CONCURRENCY);

    await Promise.all(
      batch.map(async ({ source, url }) => {
        const startedAt = new Date();
        let httpStatus: number | null = null;
        let foundCount = 0;
        let runError: string | null = null;

        try {
          const html = await fetchText(url, (status) => {
            httpStatus = status;
          });
          pages += 1;

          const candidates = extractCandidates(html, url, source.name);

          for (const candidate of candidates) {
            if (!isCurrentOpportunity(candidate)) continue;

            const result = await db.upsertOpportunity({
              sourceId: source.id,
              externalId: candidate.externalId,
              title: candidate.title,
              organization: candidate.organization,
              city: candidate.city,
              role: candidate.role,
              kind: candidate.kind,
              sourceUrl: candidate.sourceUrl,
              publishedAt: candidate.publishedAt,
              deadlineAt: candidate.deadlineAt,
              summary: candidate.summary,
              rawText: candidate.rawText,
              contentHash: hash(candidate.rawText),
              isActive: true,
            });
            foundCount += 1;

            if (
              result.created &&
              candidate.role !== "Outro" &&
              candidate.kind !== "Informativo"
            ) {
              fresh.push(candidate);
            }
          }
        } catch (error) {
          const message = `${source.slug}: ${url} — ${String(error)}`;
          failures.push(message);
          runError = message;
        }

        const finishedAt = new Date();
        await db.recordMonitorRun({
          sourceId: source.id,
          url,
          startedAt,
          finishedAt,
          httpStatus,
          foundCount,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          error: runError ? runError.slice(0, 6000) : null,
        });
      }),
    );
  }

  const notification = await sendExpoPushNotifications(fresh);

  return {
    sources: sources.length,
    pages,
    newOpportunities: fresh.length,
    notificationsSent: notification.sent,
    failures,
  };
}
export async function handleMonitorCron(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const result = await runMonitoringCycle();
    return res.json({ ok: true, taskUid: user.taskUid, ...result });
  } catch (error) {
    return res.status(500).json({ error: String(error), context: { url: req.originalUrl }, timestamp: new Date().toISOString() });
  }
}
