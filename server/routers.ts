import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
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
    opportunities: protectedProcedure.query(async () => db.listRecentOpportunities()),
    runNow: protectedProcedure.mutation(async () => runMonitoringCycle()),
    preferences: router({
      get: protectedProcedure.query(({ ctx }) => db.getAlertPreferences(ctx.user.id)),
      save: protectedProcedure.input(preferenceSchema).mutation(({ ctx, input }) => db.saveAlertPreferences(ctx.user.id, input)),
    }),
    devices: router({
      register: protectedProcedure
        .input(z.object({ token: z.string().min(10).max(512), platform: z.enum(["ios", "android", "web"]) }))
        .mutation(({ ctx, input }) => db.registerPushDevice(ctx.user.id, input.token, input.platform)),
    }),
  }),
});

export type AppRouter = typeof appRouter;
