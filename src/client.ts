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

export interface CreateSourceParams {
  url: string;
  type?: string;
  title?: string;
  priority?: number;
}

export interface CreateSourceResult {
  id: number;
  url: string;
  title?: string;
  type?: string;
  created?: boolean;
  subscribed?: boolean;
  restored?: boolean;
  message?: string;
}

export interface CreateTopicParams {
  name: string;
  description?: string;
}

export interface CreateTopicResult {
  id: number;
  name: string;
  slug: string;
  scope: string;
  description?: string;
  created: boolean;
}

export interface AssignFeedTopicParams {
  feed_id: number;
  topic_id: number;
  source?: 'system' | 'manual' | 'inferred';
}

export interface AssignFeedTopicResult {
  feed_id: number;
  topic_id: number;
  source: string;
  created: boolean;
}

interface JobError {
  code: string;
  message: string;
}

interface JobResponse {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  data?: unknown;
  error?: string | JobError;
}

function formatJobError(err: string | JobError | undefined): string {
  if (!err) return 'unknown error';
  if (typeof err === 'string') return err;
  return err.message ?? err.code ?? JSON.stringify(err);
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
      if (job.status === 'failed') throw new Error(`Job failed: ${formatJobError(job.error)}`);

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

  async createTopic(params: CreateTopicParams): Promise<CreateTopicResult> {
    const job = await this.request<JobResponse>('POST', '/jobs', {
      operation: 'topics',
      params: { action: 'create', ...params },
    });

    if (job.status === 'completed') return job.data as CreateTopicResult;
    return await this.pollUntilDone(job.job_id) as CreateTopicResult;
  }

  async createSource(params: CreateSourceParams): Promise<CreateSourceResult> {
    const job = await this.request<JobResponse>('POST', '/jobs', {
      operation: 'sources',
      params: { action: 'create', ...params },
    });

    if (job.status === 'completed') return job.data as CreateSourceResult;
    return await this.pollUntilDone(job.job_id) as CreateSourceResult;
  }

  async assignFeedTopic(params: AssignFeedTopicParams): Promise<AssignFeedTopicResult> {
    const job = await this.request<JobResponse>('POST', '/jobs', {
      operation: 'topics',
      params: { action: 'assign', ...params },
    });

    if (job.status === 'completed') return job.data as AssignFeedTopicResult;
    return await this.pollUntilDone(job.job_id) as AssignFeedTopicResult;
  }

  async sources(params?: { limit?: number; offset?: number }): Promise<{ sources: Source[]; hasMore: boolean; cursor?: string }> {
    const cursor = params?.offset ? Buffer.from(JSON.stringify({ offset: params.offset })).toString('base64') : undefined;
    const job = await this.request<JobResponse>('POST', '/jobs', {
      operation: 'sources',
      params: { limit: params?.limit, cursor },
    });

    let data: { sources?: Source[]; has_more?: boolean; cursor?: string };
    if (job.status === 'completed') {
      data = job.data as typeof data;
    } else {
      data = await this.pollUntilDone(job.job_id) as typeof data;
    }

    return {
      sources: data?.sources ?? [],
      hasMore: data?.has_more ?? false,
      cursor: data?.cursor,
    };
  }

  async allSources(params?: { limit?: number }): Promise<Source[]> {
    const pageSize = params?.limit ?? 100;
    const allSources: Source[] = [];
    let offset = 0;

    while (true) {
      const page = await this.sources({ limit: pageSize, offset });
      allSources.push(...page.sources);
      if (!page.hasMore) break;
      offset += pageSize;
    }

    return allSources;
  }

  async catalog(params?: { limit?: number; offset?: number }): Promise<{ sources: Source[]; hasMore: boolean; cursor?: string }> {
    const cursor = params?.offset ? Buffer.from(JSON.stringify({ offset: params.offset })).toString('base64') : undefined;
    const job = await this.request<JobResponse>('POST', '/jobs', {
      operation: 'sources',
      params: { action: 'catalog', limit: params?.limit, cursor },
    });

    let data: { sources?: Source[]; has_more?: boolean; cursor?: string };
    if (job.status === 'completed') {
      data = job.data as typeof data;
    } else {
      data = await this.pollUntilDone(job.job_id) as typeof data;
    }

    return {
      sources: data?.sources ?? [],
      hasMore: data?.has_more ?? false,
      cursor: data?.cursor,
    };
  }

  async allCatalog(params?: { limit?: number }): Promise<Source[]> {
    const pageSize = params?.limit ?? 100;
    const all: Source[] = [];
    let offset = 0;

    while (true) {
      const page = await this.catalog({ limit: pageSize, offset });
      all.push(...page.sources);
      if (!page.hasMore) break;
      offset += pageSize;
    }

    return all;
  }
}
