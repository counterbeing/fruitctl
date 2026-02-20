import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CONFIG_DIR = join(homedir(), ".config", "fruitctl");
const CREDS_PATH = join(CONFIG_DIR, "credentials.json");

interface Credentials {
	token: string;
	serverUrl: string;
}

export function saveCredentials(creds: Credentials): void {
	mkdirSync(CONFIG_DIR, { recursive: true });
	writeFileSync(CREDS_PATH, JSON.stringify(creds, null, 2));
}

export function loadCredentials(): Credentials {
	const raw = readFileSync(CREDS_PATH, "utf-8");
	return JSON.parse(raw);
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
