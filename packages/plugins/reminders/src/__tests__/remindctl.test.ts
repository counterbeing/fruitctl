import { describe, expect, it, vi } from "vitest";
import { Remindctl } from "../remindctl.js";

describe("Remindctl", () => {
	it("parses list output from --json", async () => {
		const mockExec = vi.fn().mockResolvedValue({
			stdout: JSON.stringify([
				{ id: "list-1", title: "Groceries" },
				{ id: "list-2", title: "Errands" },
			]),
		});
		const ctl = new Remindctl(mockExec);
		const lists = await ctl.listLists();
		expect(mockExec).toHaveBeenCalledWith("remindctl list --json");
		expect(lists).toEqual([
			{ id: "list-1", title: "Groceries" },
			{ id: "list-2", title: "Errands" },
		]);
	});

	it("parses reminders for a specific list", async () => {
		const mockExec = vi.fn().mockResolvedValue({
			stdout: JSON.stringify([{ id: "r-1", title: "Milk", completed: false }]),
		});
		const ctl = new Remindctl(mockExec);
		const reminders = await ctl.listReminders("Groceries");
		expect(mockExec).toHaveBeenCalledWith('remindctl list "Groceries" --json');
		expect(reminders).toHaveLength(1);
	});

	it("checks if remindctl binary exists", async () => {
		const mockExec = vi.fn().mockResolvedValue({ stdout: "" });
		const ctl = new Remindctl(mockExec);
		const available = await ctl.isAvailable();
		expect(available).toBe(true);
	});

	it("returns false when remindctl not found", async () => {
		const mockExec = vi.fn().mockRejectedValue(new Error("not found"));
		const ctl = new Remindctl(mockExec);
		const available = await ctl.isAvailable();
		expect(available).toBe(false);
	});
});
