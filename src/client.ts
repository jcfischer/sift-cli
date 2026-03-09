import type { SiftConfig } from './config.ts';
import { getAccessToken } from './token-cache.ts';

export interface SearchResult {
  id: number;
  title: string;
  url: string;
  snippet?: string;
  published_at?: string;
  search_rank?: number;
  quality_score?: number;
}

export interface AskResult {
  answer: string;
  sources?: SearchResult[];
}

export interface Topic {
  id: number;
  name: string;
  slug: string;
  scope: string;
  feeds_count: number;
  articles_count: number;
}

export interface Source {
  id: number;
  url: string;
  title?: string;
  type: string;
}

interface JobResponse {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  data?: unknown;
  error?: string;
}

export class SiftClient {
  private readonly config: SiftConfig;

  constructor(config: SiftConfig) {
    this.config = config;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await getAccessToken(this.config);
    const url = `${this.config.apiUrl}${path}`;

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`API request failed (${res.status}): ${text}`);
    }

    return res.json() as Promise<T>;
  }

  private async pollUntilDone(jobId: string, timeoutMs = 60_000): Promise<unknown> {
    const deadline = Date.now() + timeoutMs;
    let delayMs = 1000;

    while (Date.now() < deadline) {
      const job = await this.request<JobResponse>('GET', `/jobs/${jobId}`);

      if (job.status === 'completed') return job.data;
      if (job.status === 'failed') throw new Error(`Job failed: ${job.error ?? 'unknown error'}`);

      await new Promise((r) => setTimeout(r, delayMs));
      delayMs = Math.min(delayMs * 1.5, 5000);
    }

    throw new Error(`Job ${jobId} timed out after ${timeoutMs}ms`);
  }

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    const job = await this.request<JobResponse>('POST', '/jobs', {
      operation: 'search',
      params: { query, limit },
    });

    if (job.status === 'completed') {
      const data = job.data as { results?: SearchResult[] };
      return data?.results ?? [];
    }

    const data = await this.pollUntilDone(job.job_id) as { results?: SearchResult[] };
    return data?.results ?? [];
  }

  async ask(question: string, mode: 'quick' | 'deep' = 'quick'): Promise<AskResult> {
    const job = await this.request<JobResponse>('POST', '/jobs', {
      operation: 'ask',
      params: { question, mode },
    });

    const data = await this.pollUntilDone(job.job_id, 120_000) as AskResult;
    return data;
  }

  async topics(params?: { scope?: string; limit?: number }): Promise<Topic[]> {
    const job = await this.request<JobResponse>('POST', '/jobs', {
      operation: 'topics',
      params: params ?? {},
    });

    if (job.status === 'completed') {
      const data = job.data as { topics?: Topic[] };
      return data?.topics ?? [];
    }

    const data = await this.pollUntilDone(job.job_id) as { topics?: Topic[] };
    return data?.topics ?? [];
  }

  async sources(params?: { limit?: number; cursor?: string }): Promise<Source[]> {
    const job = await this.request<JobResponse>('POST', '/jobs', {
      operation: 'sources',
      params: params ?? {},
    });

    if (job.status === 'completed') {
      const data = job.data as { sources?: Source[] };
      return data?.sources ?? [];
    }

    const data = await this.pollUntilDone(job.job_id) as { sources?: Source[] };
    return data?.sources ?? [];
  }
}
