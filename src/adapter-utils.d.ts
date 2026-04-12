/**
 * Type stubs for @paperclipai/adapter-utils.
 *
 * At install time these are resolved from the real peer dependency.
 * This file enables standalone `tsc` without the monorepo present.
 */

declare module "@paperclipai/adapter-utils" {
  export interface AdapterAgent {
    id: string;
    companyId: string;
    name: string;
    adapterType: string;
    adapterConfig: Record<string, unknown>;
  }

  export interface AdapterRuntime {
    sessionId?: string | null;
    sessionParams?: Record<string, unknown> | null;
    sessionDisplayId?: string | null;
    taskKey?: string | null;
  }

  export type AdapterBillingType =
    | "api"
    | "subscription"
    | "metered_api"
    | "unknown";

  export interface AdapterExecutionContext {
    runId: string;
    agent: AdapterAgent;
    runtime: AdapterRuntime;
    config: Record<string, unknown>;
    context: Record<string, unknown>;
    onLog: (stream: "stdout" | "stderr", chunk: string) => Promise<void>;
    onMeta?: (meta: Record<string, unknown>) => Promise<void>;
    onSpawn?: (pid: number) => void;
    authToken?: string;
  }

  export interface AdapterUsage {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens?: number;
  }

  export interface AdapterExecutionResult {
    exitCode?: number | null;
    signal?: string | null;
    timedOut?: boolean;
    errorMessage?: string | null;
    errorCode?: string | null;
    usage?: AdapterUsage;
    sessionId?: string | null;
    sessionParams?: Record<string, unknown> | null;
    sessionDisplayId?: string | null;
    provider?: string | null;
    biller?: string | null;
    model?: string | null;
    billingType?: AdapterBillingType;
    costUsd?: number;
    resultJson?: Record<string, unknown>;
    summary?: string;
    clearSession?: boolean;
  }

  export interface AdapterSessionCodec<T = Record<string, unknown>> {
    serialize(params: unknown): T | null;
    deserialize(raw: unknown): T | null;
    getDisplayId(params: unknown): string | null;
  }

  export interface AdapterEnvironmentTestCheck {
    id: string;
    level: "error" | "warn" | "info";
    ok: boolean;
    message: string;
  }

  export interface AdapterModel {
    id: string;
    label: string;
    group?: string;
  }

  export interface TranscriptEntry {
    type: string;
    text?: string;
    tool?: string;
    input?: unknown;
    output?: unknown;
    status?: string;
    metadata?: Record<string, unknown>;
    tokens?: Record<string, number>;
    cost?: number;
  }

  export interface AdapterConfigField {
    key: string;
    label: string;
    type: string;
    required?: boolean;
    description?: string;
    placeholder?: string;
    options?: string[];
  }
}

declare module "@paperclipai/adapter-utils/server-utils" {
  import type { AdapterAgent } from "@paperclipai/adapter-utils";

  export function asString(value: unknown, fallback: string): string;
  export function asNumber(value: unknown, fallback: number): number;
  export function asStringArray(value: unknown): string[];
  export function parseObject(value: unknown): Record<string, unknown>;
  export function buildPaperclipEnv(
    agent: AdapterAgent,
  ): Record<string, string>;
  export function joinPromptSections(sections: string[]): string;
  export function buildInvocationEnvForLogs(
    env: Record<string, string>,
    opts: {
      runtimeEnv: Record<string, string>;
      includeRuntimeKeys?: string[];
      resolvedCommand?: string;
    },
  ): Record<string, string>;
  export function ensureAbsoluteDirectory(
    dir: string,
    opts?: { createIfMissing?: boolean },
  ): Promise<void>;
  export function ensurePathInEnv(
    env: Record<string, string | undefined>,
  ): Record<string, string | undefined>;
  export function resolveCommandForLogs(
    command: string,
    cwd: string,
    env: Record<string, string>,
  ): Promise<string>;
  export function renderTemplate(
    template: string,
    data: Record<string, unknown>,
  ): string;

  export interface ChildProcessResult {
    stdout: string;
    stderr: string;
    exitCode: number | null;
    signal: string | null;
    timedOut: boolean;
  }

  export interface RunChildProcessOptions {
    cwd: string;
    env: Record<string, string>;
    stdin?: string;
    timeoutSec: number;
    graceSec: number;
    onSpawn?: (pid: number) => void;
    onLog: (stream: "stdout" | "stderr", chunk: string) => Promise<void>;
  }

  export function runChildProcess(
    runId: string,
    command: string,
    args: string[],
    options: RunChildProcessOptions,
  ): Promise<ChildProcessResult>;
}
