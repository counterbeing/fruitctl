import { z } from "zod/v4";

export const serverConfigSchema = z.object({
  port: z.number().default(3456),
  host: z.string().default("127.0.0.1"),
  jwtSecret: z.string().min(16),
  dbPath: z.string().default("./fruitctl.db"),
  adapters: z.array(z.string()).default(["reminders", "calendar"]),
});

export type ServerConfig = z.infer<typeof serverConfigSchema>;

export function loadConfig(
  env: Record<string, string | undefined> = process.env,
): ServerConfig {
  return serverConfigSchema.parse({
    port: env.FRUITCTL_PORT ? Number(env.FRUITCTL_PORT) : undefined,
    host: env.FRUITCTL_HOST ?? undefined,
    jwtSecret: env.FRUITCTL_JWT_SECRET,
    dbPath: env.FRUITCTL_DB_PATH ?? undefined,
    adapters: env.FRUITCTL_ADAPTERS?.split(",") ?? undefined,
  });
}
