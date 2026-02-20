import { Command } from "commander";
import { apiRequest } from "@fruitctl/shared";

export const proposalsCommand = new Command("proposals");

proposalsCommand
	.command("list")
	.description("List proposals")
	.option("--status <status>", "Filter by status (pending, approved, rejected, expired)")
	.action(async (opts) => {
		const query = opts.status ? `?status=${opts.status}` : "";
		const data = (await apiRequest("GET", `/proposals${query}`)) as any;
		if (data.items.length === 0) {
			console.log("No proposals found.");
			return;
		}
		for (const p of data.items) {
			const date = p.createdAt ? new Date(p.createdAt).toLocaleString() : "unknown";
			console.log(
				`[${p.status.toUpperCase()}] ${p.id.slice(0, 8)} — ${p.adapter}:${p.action} (${date})`,
			);
			console.log(`  params: ${JSON.stringify(p.params)}`);
		}
	});

proposalsCommand
	.command("approve <id>")
	.description("Approve a pending proposal")
	.action(async (id) => {
		const data = (await apiRequest("POST", `/proposals/${id}/approve`)) as any;
		console.log(`Proposal ${id.slice(0, 8)} approved.`);
		if (data.adapter) {
			console.log(`Action: ${data.adapter}:${data.action}`);
		}
	});

proposalsCommand
	.command("reject <id>")
	.description("Reject a pending proposal")
	.action(async (id) => {
		await apiRequest("POST", `/proposals/${id}/reject`);
		console.log(`Proposal ${id.slice(0, 8)} rejected.`);
	});

proposalsCommand
	.command("show <id>")
	.description("Show details of a specific proposal")
	.action(async (id) => {
		const data = (await apiRequest("GET", `/proposals/${id}`)) as any;
		console.log(JSON.stringify(data, null, 2));
	});
