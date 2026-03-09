import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import type { SiftConfig } from './config.ts';

interface CachedToken {
  access_token: string;
  expires_at: number; // Unix timestamp in ms
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

const TOKEN_CACHE_PATH = join(homedir(), '.config', 'sift', 'token.json');
const EXPIRY_BUFFER_MS = 60_000; // 60 seconds before expiry

function readCache(): CachedToken | null {
  if (!existsSync(TOKEN_CACHE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(TOKEN_CACHE_PATH, 'utf8')) as CachedToken;
  } catch {
    return null;
  }
}

function writeCache(token: CachedToken): void {
  mkdirSync(dirname(TOKEN_CACHE_PATH), { recursive: true });
  writeFileSync(TOKEN_CACHE_PATH, JSON.stringify(token, null, 2), { mode: 0o600 });
}

async function exchangeCredentials(config: SiftConfig): Promise<CachedToken> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as TokenResponse;

  if (!data.access_token) {
    throw new Error('Token exchange response missing access_token');
  }

  const cached: CachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };

  writeCache(cached);
  return cached;
}

export async function getAccessToken(config: SiftConfig): Promise<string> {
  const cached = readCache();

  if (cached && cached.expires_at - Date.now() > EXPIRY_BUFFER_MS) {
    return cached.access_token;
  }

  const fresh = await exchangeCredentials(config);
  return fresh.access_token;
}
