/**
 * Kilo adapter environment diagnostics.
 *
 * Validates that the Kilo CLI is installed, authenticated, has models,
 * and that the configured working directory is valid.
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { asString } from "@paperclipai/adapter-utils/server-utils";

interface TestCheck {
  code: string;
  level: "info" | "warn" | "error";
  ok: boolean;
  message: string;
}

interface TestResult {
  status: "pass" | "warn" | "fail";
  testedAt: string;
  checks: TestCheck[];
}

export function testEnvironment(
  config?: Record<string, unknown>,
): TestResult {
  const command = asString(config?.command, "kilo");
  const checks: TestCheck[] = [];

  // Check 1: CLI installed
  try {
    const version = execSync(`${command} --version`, {
      encoding: "utf-8",
      timeout: 10_000,
    }).trim();
    checks.push({
      code: "kilo_installed",
      level: "info",
      ok: true,
      message: `Kilo CLI ${version}`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    checks.push({
      code: "kilo_installed",
      level: "error",
      ok: false,
      message: `Kilo CLI not found: ${msg}`,
    });
    return { status: "fail", testedAt: new Date().toISOString(), checks };
  }

  // Check 2: Auth providers
  try {
    const authOutput = execSync(`${command} auth list`, {
      encoding: "utf-8",
      timeout: 10_000,
    }).trim();
    const hasProviders =
      authOutput.includes("Gateway") ||
      authOutput.includes("oauth") ||
      authOutput.includes("api-key") ||
      (authOutput.length > 0 && !authOutput.includes("No providers"));
    checks.push({
      code: "kilo_auth_configured",
      level: hasProviders ? "info" : "error",
      ok: hasProviders,
      message: hasProviders
        ? "Auth configured"
        : "No auth providers — run kilo auth login",
    });
  } catch {
    checks.push({
      code: "kilo_auth_configured",
      level: "warn",
      ok: false,
      message: "Could not check auth providers",
    });
  }

  // Check 3: Models available
  try {
    const modelsOutput = execSync(`${command} models`, {
      encoding: "utf-8",
      timeout: 15_000,
    }).trim();
    const count = modelsOutput
      .split("\n")
      .filter((l) => l.includes("/")).length;
    checks.push({
      code: "kilo_models_available",
      level: count > 0 ? "info" : "warn",
      ok: count > 0,
      message: `${count} models available`,
    });
  } catch {
    checks.push({
      code: "kilo_models_available",
      level: "warn",
      ok: false,
      message: "Could not list models",
    });
  }

  // Check 4: CWD valid
  const cwd = asString(config?.cwd, "");
  if (cwd) {
    const valid = path.isAbsolute(cwd);
    checks.push({
      code: "kilo_cwd_valid",
      level: valid ? "info" : "error",
      ok: valid,
      message: `CWD: ${cwd}`,
    });
  }

  const status = checks.some((c) => !c.ok && c.level === "error")
    ? "fail"
    : checks.some((c) => !c.ok)
      ? "warn"
      : "pass";
  return { status, testedAt: new Date().toISOString(), checks };
}
