import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const config = sqliteTable("config", {
	key: text("key").primaryKey(),
	value: text("value").notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
});

export const proposals = sqliteTable("proposals", {
	id: text("id").primaryKey(),
	adapter: text("adapter").notNull(),
	action: text("action").notNull(),
	params: text("params").notNull(), // JSON string
	status: text("status", {
		enum: ["pending", "approved", "rejected", "expired", "executed"],
	}).notNull(),
	createdAt: integer("created_at", { mode: "timestamp" })
		.$defaultFn(() => new Date()),
	resolvedAt: integer("resolved_at", { mode: "timestamp" }),
	resolvedBy: text("resolved_by"),
});

export const auditLog = sqliteTable("audit_log", {
	id: text("id").primaryKey(),
	proposalId: text("proposal_id")
		.notNull()
		.references(() => proposals.id),
	adapter: text("adapter").notNull(),
	action: text("action").notNull(),
	params: text("params").notNull(),
	result: text("result"),
	error: text("error"),
	timestamp: integer("timestamp", { mode: "timestamp" })
		.$defaultFn(() => new Date()),
});
