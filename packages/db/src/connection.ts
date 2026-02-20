import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema.js";

const migrationsFolder = resolve(
	fileURLToPath(import.meta.url),
	"../../drizzle",
);

export function createDatabase(path: string) {
	const sqlite = new Database(path);
	sqlite.pragma("journal_mode = WAL");
	sqlite.pragma("foreign_keys = ON");
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder });
	return db;
}

export type AppDatabase = ReturnType<typeof createDatabase>;
