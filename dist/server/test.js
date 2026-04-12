/**
 * Kilo adapter environment diagnostics.
 *
 * Validates that the Kilo CLI is installed, authenticated, has models,
 * and that the configured working directory is valid.
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { asString } from "@paperclipai/adapter-utils/server-utils";
export function testEnvironment(config) {
    const command = asString(config?.command, "kilo");
    const results = [];
    // Check 1: CLI installed
    try {
        const version = execSync(`${command} --version`, {
            encoding: "utf-8",
            timeout: 10_000,
        }).trim();
        results.push({
            id: "kilo_installed",
            level: "error",
            ok: true,
            message: `Kilo CLI ${version}`,
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({
            id: "kilo_installed",
            level: "error",
            ok: false,
            message: `Kilo CLI not found: ${msg}`,
        });
        return results; // Can't proceed without the CLI
    }
    // Check 2: Auth providers
    try {
        const authOutput = execSync(`${command} auth list`, {
            encoding: "utf-8",
            timeout: 10_000,
        }).trim();
        const hasProviders = authOutput.length > 0 && !authOutput.includes("No providers");
        results.push({
            id: "kilo_auth_configured",
            level: "error",
            ok: hasProviders,
            message: hasProviders
                ? "Auth providers configured"
                : "No auth providers — run kilo auth add",
        });
    }
    catch {
        results.push({
            id: "kilo_auth_configured",
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
        results.push({
            id: "kilo_models_available",
            level: "warn",
            ok: count > 0,
            message: `${count} models available`,
        });
    }
    catch {
        results.push({
            id: "kilo_models_available",
            level: "warn",
            ok: false,
            message: "Could not list models",
        });
    }
    // Check 4: CWD valid
    const cwd = asString(config?.cwd, "");
    if (cwd) {
        results.push({
            id: "kilo_cwd_valid",
            level: "error",
            ok: path.isAbsolute(cwd),
            message: `CWD: ${cwd}`,
        });
    }
    return results;
}
//# sourceMappingURL=test.js.map