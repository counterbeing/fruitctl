import { exec } from "node:child_process";
import { promisify } from "node:util";

type ExecFn = (cmd: string) => Promise<{ stdout: string }>;

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
}
