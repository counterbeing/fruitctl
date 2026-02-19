import { exec } from "node:child_process";
import { promisify } from "node:util";

type ExecFn = (cmd: string) => Promise<{ stdout: string }>;

interface AddOptions {
	title: string;
	list?: string;
	due?: string;
	notes?: string;
	priority?: "none" | "low" | "medium" | "high";
}

interface EditOptions {
	title?: string;
	list?: string;
	due?: string;
	notes?: string;
	priority?: "none" | "low" | "medium" | "high";
}

const defaultExec: ExecFn = promisify(exec);

export class Remindctl {
	private exec: ExecFn;

	constructor(execFn?: ExecFn) {
		this.exec = execFn ?? defaultExec;
	}

	async isAvailable(): Promise<boolean> {
		try {
			await this.exec("remindctl status");
			return true;
		} catch {
			return false;
		}
	}

	async listLists(): Promise<{ id: string; title: string }[]> {
		const { stdout } = await this.exec("remindctl list --json");
		return JSON.parse(stdout);
	}

	async listReminders(list: string): Promise<unknown[]> {
		const { stdout } = await this.exec(`remindctl list "${list}" --json`);
		return JSON.parse(stdout);
	}

	async getReminder(id: string): Promise<unknown> {
		const { stdout } = await this.exec("remindctl all --json");
		const all = JSON.parse(stdout);
		const found = all.find((r: any) => r.id === id);
		if (!found) return null;
		return found;
	}

	async add(opts: AddOptions): Promise<unknown> {
		const parts = ["remindctl add"];
		parts.push(`--title "${opts.title}"`);
		if (opts.list) parts.push(`--list "${opts.list}"`);
		if (opts.due) parts.push(`--due "${opts.due}"`);
		if (opts.notes) parts.push(`--notes "${opts.notes}"`);
		if (opts.priority) parts.push(`--priority ${opts.priority}`);
		parts.push("--json --no-input");
		const { stdout } = await this.exec(parts.join(" "));
		return JSON.parse(stdout);
	}

	async complete(id: string): Promise<void> {
		await this.exec(`remindctl complete ${id} --json --no-input`);
	}

	async delete(id: string): Promise<void> {
		await this.exec(`remindctl delete ${id} --force --json --no-input`);
	}

	async edit(id: string, opts: EditOptions): Promise<unknown> {
		const parts = [`remindctl edit ${id}`];
		if (opts.title) parts.push(`--title "${opts.title}"`);
		if (opts.list) parts.push(`--list "${opts.list}"`);
		if (opts.due) parts.push(`--due "${opts.due}"`);
		if (opts.notes) parts.push(`--notes "${opts.notes}"`);
		if (opts.priority) parts.push(`--priority ${opts.priority}`);
		parts.push("--json --no-input");
		const { stdout } = await this.exec(parts.join(" "));
		return JSON.parse(stdout);
	}
}
