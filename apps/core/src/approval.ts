import type { AppDatabase } from "@fruitctl/db";
import { auditLog, proposals } from "@fruitctl/db";
import { AppError, ErrorCode } from "@fruitctl/shared";
import { and, eq, lt } from "drizzle-orm";

export interface ProposeInput {
	adapter: string;
	action: string;
	params: unknown;
}

export interface Proposal {
	id: string;
	adapter: string;
	action: string;
	params: unknown;
	status: string;
	createdAt: Date | null;
	resolvedAt: Date | null;
	resolvedBy: string | null;
}

export interface ListOptions {
	status?: string;
}

export interface ActionRegistry {
	getAction(
		adapter: string,
		action: string,
	):
		| { execute: (params: unknown) => Promise<unknown> }
		| undefined;
}

export class ApprovalEngine {
	private db: AppDatabase;
	private registry: ActionRegistry | undefined;

	constructor(
		db: AppDatabase,
		options?: { registry?: ActionRegistry },
	) {
		this.db = db;
		this.registry = options?.registry;
	}

	async propose(input: ProposeInput): Promise<Proposal> {
		const id = crypto.randomUUID();
		const row = this.db
			.insert(proposals)
			.values({
				id,
				adapter: input.adapter,
				action: input.action,
				params: JSON.stringify(input.params),
				status: "pending",
			})
			.returning()
			.get();

		return this.toProposal(row);
	}

	async get(id: string): Promise<Proposal> {
		const row = this.db
			.select()
			.from(proposals)
			.where(eq(proposals.id, id))
			.get();

		if (!row) {
			throw new AppError(
				ErrorCode.PROPOSAL_NOT_FOUND,
				`Proposal ${id} not found`,
			);
		}

		return this.toProposal(row);
	}

	async approve(id: string, resolvedBy: string): Promise<Proposal> {
		const resolved = await this.resolve(id, "approved", resolvedBy);

		const actionDef = this.registry?.getAction(
			resolved.adapter,
			resolved.action,
		);
		if (actionDef) {
			try {
				const result = await actionDef.execute(resolved.params);
				await this.logExecution(resolved, result);
			} catch (err) {
				await this.logExecution(
					resolved,
					undefined,
					err instanceof Error ? err.message : String(err),
				);
			}
		}

		return resolved;
	}

	async reject(id: string, resolvedBy: string): Promise<Proposal> {
		return this.resolve(id, "rejected", resolvedBy);
	}

	async list(options?: ListOptions): Promise<Proposal[]> {
		const status = options?.status as typeof proposals.$inferSelect.status | undefined;
		const rows = status
			? this.db
					.select()
					.from(proposals)
					.where(eq(proposals.status, status))
					.orderBy(proposals.createdAt)
					.all()
			: this.db
					.select()
					.from(proposals)
					.orderBy(proposals.createdAt)
					.all();

		return rows.map((row) => this.toProposal(row));
	}

	async expireStale(ttlMs: number): Promise<number> {
		const cutoff = new Date(Date.now() - ttlMs);
		const expired = this.db
			.update(proposals)
			.set({ status: "expired", resolvedAt: new Date() })
			.where(
				and(
					eq(proposals.status, "pending"),
					lt(proposals.createdAt, cutoff),
				),
			)
			.returning()
			.all();

		return expired.length;
	}

	async logExecution(
		proposal: Proposal,
		result?: unknown,
		error?: string,
	): Promise<void> {
		this.db
			.insert(auditLog)
			.values({
				id: crypto.randomUUID(),
				proposalId: proposal.id,
				adapter: proposal.adapter,
				action: proposal.action,
				params: JSON.stringify(proposal.params),
				result: result != null ? JSON.stringify(result) : null,
				error: error ?? null,
			})
			.run();
	}

	setRegistry(registry: ActionRegistry): void {
		this.registry = registry;
	}

	private async resolve(
		id: string,
		status: "approved" | "rejected",
		resolvedBy: string,
	): Promise<Proposal> {
		const existing = await this.get(id);

		if (existing.status !== "pending") {
			throw new AppError(
				ErrorCode.VALIDATION_ERROR,
				`Proposal ${id} is already ${existing.status}`,
			);
		}

		const row = this.db
			.update(proposals)
			.set({
				status,
				resolvedAt: new Date(),
				resolvedBy,
			})
			.where(eq(proposals.id, id))
			.returning()
			.get();

		return this.toProposal(row!);
	}

	private toProposal(row: typeof proposals.$inferSelect): Proposal {
		return {
			id: row.id,
			adapter: row.adapter,
			action: row.action,
			params: JSON.parse(row.params),
			status: row.status,
			createdAt: row.createdAt ?? null,
			resolvedAt: row.resolvedAt ?? null,
			resolvedBy: row.resolvedBy ?? null,
		};
	}
}
