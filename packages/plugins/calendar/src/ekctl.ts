import { exec } from "node:child_process";
import { promisify } from "node:util";

type ExecFn = (cmd: string) => Promise<{ stdout: string }>;

interface Calendar {
  id: string;
  title: string;
  type: string;
  source: string;
  allowsModifications: boolean;
  color: string;
}

interface AddEventOptions {
  calendar: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  notes?: string;
  allDay?: boolean;
}

const defaultExec: ExecFn = promisify(exec);

export class Ekctl {
  private exec: ExecFn;

  constructor(execFn?: ExecFn) {
    this.exec = execFn ?? defaultExec;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.exec("ekctl --version");
      return true;
    } catch {
      return false;
    }
  }

  async listCalendars(): Promise<Calendar[]> {
    const { stdout } = await this.exec("ekctl list calendars");
    const data = JSON.parse(stdout);
    return data.calendars.filter((c: Calendar) => c.type === "event");
  }

  async listEvents(
    calendar: string,
    from: string,
    to: string,
  ): Promise<unknown[]> {
    const { stdout } = await this.exec(
      `ekctl list events --calendar "${calendar}" --from "${from}" --to "${to}"`,
    );
    const data = JSON.parse(stdout);
    return data.events;
  }

  async showEvent(id: string): Promise<any> {
    const { stdout } = await this.exec(`ekctl show event "${id}"`);
    const data = JSON.parse(stdout);
    return data.event;
  }

  async addEvent(opts: AddEventOptions): Promise<any> {
    const parts = ["ekctl add event"];
    parts.push(`--calendar "${opts.calendar}"`);
    parts.push(`--title "${opts.title}"`);
    parts.push(`--start "${opts.start}"`);
    parts.push(`--end "${opts.end}"`);
    if (opts.location) parts.push(`--location "${opts.location}"`);
    if (opts.notes) parts.push(`--notes "${opts.notes}"`);
    if (opts.allDay) parts.push("--all-day");
    const { stdout } = await this.exec(parts.join(" "));
    return JSON.parse(stdout);
  }

  async deleteEvent(id: string): Promise<void> {
    await this.exec(`ekctl delete event "${id}"`);
  }
}
