import { GatewayConfig, ProviderConfig } from './config';

export interface ResolvedRoute {
  providerKey: string;
  providerConfig: ProviderConfig;
  model: string;
  alias?: string;
}

export function resolveRoute(modelString: string, config: GatewayConfig): ResolvedRoute {
  let resolved = modelString;
  let alias: string | undefined;

  if (config.aliases?.[modelString]) {
    alias = modelString;
    resolved = config.aliases[modelString];
  }

  const slashIdx = resolved.indexOf('/');
  if (slashIdx === -1) {
    throw new Error(
      `Model "${modelString}" must be in "provider/model" format or a configured alias. ` +
      `Available aliases: ${Object.keys(config.aliases ?? {}).join(', ') || 'none'}`
    );
  }

  const providerKey = resolved.slice(0, slashIdx);
  const model = resolved.slice(slashIdx + 1);
  const providerConfig = config.providers[providerKey];

  if (!providerConfig) {
    throw new Error(
      `Unknown provider "${providerKey}". Available: ${Object.keys(config.providers).join(', ')}`
    );
  }

  return { providerKey, providerConfig, model, alias };
}
