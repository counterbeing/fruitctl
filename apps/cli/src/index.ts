#!/usr/bin/env node
import { Command } from "commander";
import { authCommand } from "./commands/auth.js";
import { proposalsCommand } from "./commands/proposals.js";
import { remindersCommand } from "./commands/reminders.js";
import { serverCommand } from "./commands/server.js";

const program = new Command();

program
	.name("fruitctl")
	.description("Local Apple Integration Gateway CLI")
	.version("0.1.0");

program.addCommand(authCommand);
program.addCommand(serverCommand);
program.addCommand(remindersCommand);
program.addCommand(proposalsCommand);

program.parse();
