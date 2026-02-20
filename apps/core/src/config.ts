import { readFileSync } from "node:fs";
import { credentialsPath } from "@fruitctl/shared";
import { z } from "zod/v4";

export const serverConfigSchema = z.object({
  port: z.number().default(3456),
  host: z.string().default("0.0.0.0"),
  secret: z.string().min(16),
  dbPath: z.string().default("./fruitctl.db"),
  adapters: z.array(z.string()).default(["reminders", "calendar"]),
});

export type ServerConfig = z.infer<typeof serverConfigSchema>;

function readSecretFromCredentials(path: string): string | undefined {
  try {
    const raw = readFileSync(path, "utf-8");
    const data = JSON.parse(raw);
    if (data.mode === "server" && typeof data.secret === "string") {
      return data.secret;
    }
  } catch {
    // File doesn't exist or is invalid
  }
  return undefined;
}

export function loadConfig(
  env: Record<string, string | undefined> = process.env,
  credsPath: string = credentialsPath(),
): ServerConfig {
  const secret = env.FRUITCTL_SECRET ?? readSecretFromCredentials(credsPath);

  return serverConfigSchema.parse({
    port: env.FRUITCTL_PORT ? Number(env.FRUITCTL_PORT) : undefined,
    host: env.FRUITCTL_HOST ?? undefined,
    secret,
    dbPath: env.FRUITCTL_DB_PATH ?? undefined,
    adapters: env.FRUITCTL_ADAPTERS?.split(",") ?? undefined,
  });
}
