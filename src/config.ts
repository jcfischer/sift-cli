import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

const ConfigFileSchema = z.object({
  clientId: z.string().min(1).optional(),
  clientSecret: z.string().min(1).optional(),
  tokenUrl: z.string().url().optional(),
  apiUrl: z.string().url().optional(),
});

export interface SiftConfig {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  apiUrl: string;
}

const DEFAULT_TOKEN_URL = 'https://app.getsift.ch/v1/auth/token';
const DEFAULT_API_URL = 'https://app.getsift.ch/v1';

let _config: SiftConfig | null = null;

function loadConfigFile(): z.infer<typeof ConfigFileSchema> {
  const configPath = join(homedir(), '.config', 'sift', 'config.json');
  if (!existsSync(configPath)) return {};
  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf8'));
    return ConfigFileSchema.parse(raw);
  } catch {
    return {};
  }
}

export function loadConfig(): SiftConfig {
  if (_config) return _config;

  const file = loadConfigFile();

  const clientId = process.env.SIFT_CLIENT_ID ?? file.clientId;
  const clientSecret = process.env.SIFT_CLIENT_SECRET ?? file.clientSecret;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing Sift credentials. Set SIFT_CLIENT_ID and SIFT_CLIENT_SECRET environment variables, ' +
        'or add clientId/clientSecret to ~/.config/sift/config.json'
    );
  }

  _config = {
    clientId,
    clientSecret,
    tokenUrl: process.env.SIFT_TOKEN_URL ?? file.tokenUrl ?? DEFAULT_TOKEN_URL,
    apiUrl: process.env.SIFT_API_URL ?? file.apiUrl ?? DEFAULT_API_URL,
  };

  return _config;
}
