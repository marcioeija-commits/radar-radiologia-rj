import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "../../shared/const.js";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const publicReadRateBuckets = new Map<string, { count: number; expiresAt: number }>();
export const publicReadProcedure = t.procedure.use(t.middleware(async ({ ctx, next }) => {
  const now = Date.now();
  const ip = ctx.req.ip || ctx.req.socket.remoteAddress || "unknown";
  let bucket = publicReadRateBuckets.get(ip);
  if (!bucket || bucket.expiresAt <= now) {
    bucket = { count: 0, expiresAt: now + 60_000 };
    publicReadRateBuckets.set(ip, bucket);
  }
  bucket.count += 1;
  if (bucket.count > 120) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Limite temporário de consultas atingido" });
  }
  if (publicReadRateBuckets.size > 10_000) {
    for (const [key, value] of publicReadRateBuckets) {
      if (value.expiresAt <= now) publicReadRateBuckets.delete(key);
    }
  }
  return next();
}));

const requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
