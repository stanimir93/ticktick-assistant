import type { ToolDefinition } from './llm/types';
import type { ApiVersion } from './api-version';
import { toolDefinitions as v1Tools, executeTool as executeV1Tool } from './tools';
import { toolDefinitions as v2Tools, executeTool as executeV2Tool } from './tools-v2';

export function getToolDefinitions(version: ApiVersion): ToolDefinition[] {
  return version === 'v2' ? v2Tools : v1Tools;
}

export async function executeTool(
  version: ApiVersion,
  name: string,
  args: Record<string, unknown>,
  oauthToken: string,
  sessionToken?: string
): Promise<string> {
  if (version === 'v2' && sessionToken) {
    return executeV2Tool(name, args, oauthToken, sessionToken);
  }
  return executeV1Tool(name, args, oauthToken);
}
