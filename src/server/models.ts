/**
 * Kilo model discovery via `kilo models` CLI command.
 */

import { execSync } from "node:child_process";
import type { AdapterModel } from "@paperclipai/adapter-utils";

export function listKiloModels(command = "kilo"): AdapterModel[] {
  try {
    const output = execSync(`${command} models`, {
      encoding: "utf-8",
      timeout: 15_000,
    }).trim();

    return output
      .split("\n")
      .filter((l) => l.includes("/"))
      .map((l) => {
        const t = l.trim();
        const i = t.indexOf("/");
        return { id: t, label: t.slice(i + 1), group: t.slice(0, i) };
      });
  } catch {
    return [];
  }
}
