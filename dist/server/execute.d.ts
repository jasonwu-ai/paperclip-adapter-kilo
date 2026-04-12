/**
 * Kilo adapter execute function.
 *
 * Spawns `kilo run --format json --auto` as a child process, streams output,
 * and returns an AdapterExecutionResult with usage, session state, and cost.
 */
import type { AdapterExecutionContext, AdapterExecutionResult } from "@paperclipai/adapter-utils";
export declare function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult>;
//# sourceMappingURL=execute.d.ts.map