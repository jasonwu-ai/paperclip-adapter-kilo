/**
 * UI-side adapter config builder and field definitions for kilo_local.
 *
 * buildAdapterConfig() converts form field values into the adapterConfig
 * JSON stored in the database. configFields defines the UI form schema.
 */
import type { AdapterConfigField } from "@paperclipai/adapter-utils";
export interface KiloAdapterConfig {
    command?: string;
    model?: string;
    variant?: string;
    cwd?: string;
    timeoutSec?: number;
    graceSec?: number;
    thinking?: boolean;
    promptTemplate?: string;
    bootstrapPromptTemplate?: string;
    instructionsFilePath?: string;
    extraArgs?: string[];
}
export interface KiloConfigFormFields {
    command?: string;
    model?: string;
    variant?: string;
    cwd?: string;
    timeoutSec?: string | number;
    graceSec?: string | number;
    thinking?: boolean;
    promptTemplate?: string;
    bootstrapPromptTemplate?: string;
    instructionsFilePath?: string;
    extraArgs?: string;
}
export declare function buildAdapterConfig(fields: KiloConfigFormFields): KiloAdapterConfig;
export declare const configFields: AdapterConfigField[];
//# sourceMappingURL=build-config.d.ts.map