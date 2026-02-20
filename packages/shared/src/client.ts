import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const CONFIG_DIR = join(homedir(), ".config", "fruitctl");
const CREDS_PATH = join(CONFIG_DIR, "credentials.json");

export interface ServerCredentials {
  mode: "server";
  secret: string;
  adminKey: string;
  agentKey: string;
  serverUrl: string;
}

export interface ClientCredentials {
  mode: "client";
  token: string;
  serverUrl: string;
}

export type Credentials = ServerCredentials | ClientCredentials;

export function credentialsPath(): string {
  return CREDS_PATH;
}

export function saveCredentials(
  creds: Credentials,
  path: string = CREDS_PATH,
): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(creds, null, 2));
}

export function loadCredentials(
  path: string = CREDS_PATH,
): Credentials & { token: string } {
  const raw = readFileSync(path, "utf-8");
  const parsed: Credentials = JSON.parse(raw);
  if (parsed.mode === "server") {
    return { ...parsed, token: parsed.adminKey };
  }
  return parsed;
}

export async function apiRequest(
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const { token, serverUrl } = loadCredentials();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (body) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${serverUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    const err = (data as any).error;
    throw new Error(
      `[${err?.code ?? res.status}] ${err?.message ?? "Request failed"}`,
    );
  }
  return data;
}
