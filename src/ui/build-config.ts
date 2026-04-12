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

export function buildAdapterConfig(
  fields: KiloConfigFormFields,
): KiloAdapterConfig {
  const c: KiloAdapterConfig = {};

  if (fields.command) c.command = fields.command;
  if (fields.model) c.model = fields.model;
  if (fields.variant) c.variant = fields.variant;
  if (fields.cwd) c.cwd = fields.cwd;
  if (fields.timeoutSec)
    c.timeoutSec = Number(fields.timeoutSec) || 0;
  if (fields.graceSec)
    c.graceSec = Number(fields.graceSec) || 20;
  if (fields.thinking) c.thinking = true;
  if (fields.promptTemplate) c.promptTemplate = fields.promptTemplate;
  if (fields.bootstrapPromptTemplate)
    c.bootstrapPromptTemplate = fields.bootstrapPromptTemplate;
  if (fields.instructionsFilePath)
    c.instructionsFilePath = fields.instructionsFilePath;
  if (fields.extraArgs) {
    const a = fields.extraArgs.split(/\s+/).filter(Boolean);
    if (a.length > 0) c.extraArgs = a;
  }

  return c;
}

export const configFields: AdapterConfigField[] = [
  {
    key: "model",
    label: "Model",
    type: "model_select",
    required: true,
    description: "Provider/model format (e.g. zai-coding-plan/glm-5.1)",
  },
  {
    key: "variant",
    label: "Thinking Effort",
    type: "select",
    options: ["", "minimal", "low", "medium", "high", "max"],
  },
  {
    key: "command",
    label: "Command",
    type: "text",
    placeholder: "kilo",
  },
  {
    key: "promptTemplate",
    label: "Prompt Template",
    type: "textarea",
  },
  {
    key: "extraArgs",
    label: "Extra Arguments",
    type: "text",
  },
];
