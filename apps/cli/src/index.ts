#!/usr/bin/env node
import { calendarCommand } from "@fruitctl/calendar";
import { remindersCommand } from "@fruitctl/reminders";
import { Command } from "commander";
import { authCommand } from "./commands/auth.js";
import { proposalsCommand } from "./commands/proposals.js";
import { serverCommand } from "./commands/server.js";

const program = new Command();

program
  .name("fruitctl")
  .description("Local Apple Integration Gateway CLI")
  .version("0.1.0");

program.addCommand(authCommand);
program.addCommand(calendarCommand);
program.addCommand(serverCommand);
program.addCommand(remindersCommand);
program.addCommand(proposalsCommand);

program.parse();
