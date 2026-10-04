import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { protectedProcedure, publicProcedure, publicReadProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { runMonitoringCycle } from "./monitoring";

const preferenceSchema = z.object({
  concursos: z.boolean(),
  processos: z.boolean(),
  vagas: z.boolean(),
  tecnico: z.boolean(),
  tecnologo: z.boolean(),
  todoEstado: z.boolean(),
});

export const appRouter = router({
  system: router({
    health: publicProcedure.query(() => ({ ok: true, service: "radar-radiologia-rj" })),
    sources: publicProcedure.query(async () => {
      await db.ensureMonitorSources();
      return db.listMonitorSources();
    }),
    appVersion: publicProcedure.query(() => ({
      version: "1.0.4",
      androidApkUrl: "https://github.com/marcioeija-commits/radar-radiologia-rj/releases/latest",
    })),
  }),
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  monitoring: router({
    opportunities: publicReadProcedure.query(async () => db.listRecentOpportunities(100)),
    runNow: protectedProcedure.mutation(async () => runMonitoringCycle()),
    preferences: router({
      get: protectedProcedure.query(({ ctx }) => db.getAlertPreferences(ctx.user.id)),
      save: protectedProcedure.input(preferenceSchema).mutation(({ ctx, input }) => db.saveAlertPreferences(ctx.user.id, input)),
    }),
    devices: router({
      // Backward-compatible legacy protocol for old APKs. DB writes are restricted to rows without a credential.
      register: publicProcedure
        .input(z.object({
          token: z.string().min(10).max(512).regex(/^(ExponentPushToken|ExpoPushToken)\[[^\]\s]+\]$/),
          platform: z.enum(["ios", "android", "web"]),
          installationId: z.string().min(16).max(128).optional(),
        }))
        .mutation(({ ctx, input }) => ctx.user
          ? db.registerPushDevice(ctx.user.id, input.token, input.platform)
          : db.registerAnonymousPushDevice(input.token, input.platform, input.installationId)),
      setEnabled: publicProcedure
        .input(z.object({ token: z.string().min(10).max(512), enabled: z.boolean() }))
        .mutation(({ input }) => db.setPushDeviceEnabled(input.token, input.enabled)),
      registerInstallation: publicProcedure
        .input(z.object({
          installationId: z.string().uuid(),
          secret: z.string().regex(/^[a-f0-9]{64}$/i),
          token: z.string().min(10).max(512).regex(/^(ExponentPushToken|ExpoPushToken)\[[^\]\s]+\]$/),
          platform: z.enum(["ios", "android"]),
        }))
        .mutation(({ input }) => db.registerInstallationPushDevice(input)),
      setInstallationEnabled: publicProcedure
        .input(z.object({ installationId: z.string().uuid(), secret: z.string().regex(/^[a-f0-9]{64}$/i), enabled: z.boolean() }))
        .mutation(({ input }) => db.setInstallationPushEnabled(input.installationId, input.secret, input.enabled)),
      testNotification: publicProcedure
        .input(z.object({ installationId: z.string().uuid(), secret: z.string().regex(/^[a-f0-9]{64}$/i) }))
        .mutation(async ({ input }) => {
          const device = await db.getInstallationPushToken(input.installationId, input.secret);
          const response = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: device.token,
              sound: "default",
              title: "Radar Radiologia RJ",
              body: "Teste de notificação recebido com sucesso neste aparelho.",
              data: { type: "test-notification" },
            }),
            signal: AbortSignal.timeout(10_000),
          });

          if (!response.ok) {
            throw new Error(`Expo Push API retornou HTTP ${response.status}`);
          }

          const payload = await response.json() as { data?: { status?: string; message?: string } };
          const ticket = payload.data;

          if (ticket?.status !== "ok") {
            throw new Error(ticket?.message || "Expo Push API não confirmou o envio");
          }

          return { ok: true } as const;
        }),
      getInstallationPreferences: publicProcedure
        .input(z.object({ installationId: z.string().uuid(), secret: z.string().regex(/^[a-f0-9]{64}$/i) }))
        .mutation(({ ctx, input }) => db.getInstallationPreferences(input.installationId, input.secret, ctx.user?.id)),
      saveInstallationPreferences: publicProcedure
        .input(z.object({ installationId: z.string().uuid(), secret: z.string().regex(/^[a-f0-9]{64}$/i), preferences: preferenceSchema }))
        .mutation(({ input }) => db.saveInstallationPreferences(input.installationId, input.secret, input.preferences)),
      linkInstallation: protectedProcedure
        .input(z.object({
          installationId: z.string().uuid(),
          secret: z.string().regex(/^[a-f0-9]{64}$/i),
          syncMode: z.enum(["account_to_device", "device_to_account"]),
        }))
        .mutation(({ ctx, input }) => db.linkInstallationToUser(input.installationId, input.secret, ctx.user.id, input.syncMode)),
      unlinkInstallation: protectedProcedure
        .input(z.object({ installationId: z.string().uuid(), secret: z.string().regex(/^[a-f0-9]{64}$/i) }))
        .mutation(({ ctx, input }) => db.unlinkInstallationFromUser(input.installationId, input.secret, ctx.user.id)),
    }),
  }),
});

export type AppRouter = typeof appRouter;
