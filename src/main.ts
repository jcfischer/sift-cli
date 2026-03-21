#!/usr/bin/env bun
import { Command } from 'commander';
import { loadConfig } from './config.ts';
import { SiftClient } from './client.ts';

const program = new Command();

program
  .name('sift')
  .description('CLI for the Sift AI search and Q&A API')
  .version('0.1.0')
  .option('--json', 'Output results as JSON');

// Lazy client factory — only instantiated when a real command runs
function getClient(): SiftClient {
  const config = loadConfig();
  return new SiftClient(config);
}

function isJsonMode(): boolean {
  return program.opts().json === true;
}

// ── search ────────────────────────────────────────────────────────────────

program
  .command('search <query>')
  .description('Search articles for a query')
  .option('-n, --limit <n>', 'Maximum results to return', '10')
  .action(async (query: string, opts: { limit: string }) => {
    const limit = parseInt(opts.limit, 10);
    try {
      const client = getClient();
      const results = await client.search(query, limit);

      if (isJsonMode()) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      if (results.length === 0) {
        console.log('No results found.');
        return;
      }

      for (const r of results) {
        console.log(`\n📰 ${r.title}`);
        if (r.published_at) console.log(`   📅 ${new Date(r.published_at).toLocaleDateString()}`);
        if (r.snippet) console.log(`   ${r.snippet.replace(/<[^>]+>/g, '').slice(0, 120)}…`);
        console.log(`   🔗 ${r.url}`);
      }
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// ── ask ───────────────────────────────────────────────────────────────────

program
  .command('ask <question>')
  .description('Ask a question answered from the article corpus')
  .option('-m, --mode <mode>', 'Answer mode: quick or deep', 'quick')
  .action(async (question: string, opts: { mode: 'quick' | 'deep' }) => {
    try {
      const client = getClient();

      if (!isJsonMode()) {
        process.stderr.write('⏳ Thinking…\n');
      }

      const result = await client.ask(question, opts.mode);

      if (isJsonMode()) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(`\n💡 ${result.answer}`);

      if (result.sources && result.sources.length > 0) {
        console.log('\n📚 Sources:');
        for (const s of result.sources) {
          console.log(`   • ${s.title ?? s.url}`);
          console.log(`     ${s.url}`);
        }
      }
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// ── topics ────────────────────────────────────────────────────────────────

program
  .command('topics')
  .description('List available topics')
  .option('--scope <scope>', 'Filter by scope: system or tenant')
  .option('-n, --limit <n>', 'Maximum results', '50')
  .action(async (opts: { scope?: string; limit: string }) => {
    try {
      const client = getClient();
      const topics = await client.topics({ scope: opts.scope, limit: parseInt(opts.limit, 10) });

      if (isJsonMode()) {
        console.log(JSON.stringify(topics, null, 2));
        return;
      }

      if (topics.length === 0) {
        console.log('No topics found.');
        return;
      }

      for (const t of topics) {
        console.log(`  ${t.name.padEnd(30)} [${t.scope}] ${t.feeds_count} feeds · ${t.articles_count} articles`);
      }
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// ── topic create ─────────────────────────────────────────────────────────

program
  .command('topic-create <name>')
  .description('Create a new topic')
  .option('-d, --description <description>', 'Topic description')
  .action(async (name: string, opts: { description?: string }) => {
    try {
      const client = getClient();
      const result = await client.createTopic({
        name,
        description: opts.description,
      });

      if (isJsonMode()) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(`✅ Topic created (id: ${result.id})`);
      console.log(`   ${result.name} [${result.slug}]`);
      if (result.description) console.log(`   ${result.description}`);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// ── sources ───────────────────────────────────────────────────────────────

program
  .command('sources')
  .description('List feed sources')
  .option('-n, --limit <n>', 'Maximum results', '25')
  .action(async (opts: { limit: string }) => {
    try {
      const client = getClient();
      const sources = await client.sources({ limit: parseInt(opts.limit, 10) });

      if (isJsonMode()) {
        console.log(JSON.stringify(sources, null, 2));
        return;
      }

      if (sources.length === 0) {
        console.log('No sources found.');
        return;
      }

      for (const s of sources) {
        console.log(`  [${s.type}] ${s.title ?? s.url}`);
        if (s.title) console.log(`         ${s.url}`);
      }
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// ── source add ───────────────────────────────────────────────────────────

program
  .command('source-add <url>')
  .description('Add a new feed source')
  .option('-t, --type <type>', 'Source type: rss, webpage, newsletter, academic, social, video', 'rss')
  .option('--title <title>', 'Custom title for the source')
  .option('-p, --priority <n>', 'Priority 1-5', '3')
  .action(async (url: string, opts: { type: string; title?: string; priority: string }) => {
    try {
      const client = getClient();
      const result = await client.createSource({
        url,
        type: opts.type,
        title: opts.title,
        priority: parseInt(opts.priority, 10),
      });

      if (isJsonMode()) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (result.created) {
        console.log(`✅ Source created (id: ${result.id})`);
      } else if (result.subscribed) {
        console.log(`✅ Subscribed to existing source (id: ${result.id})`);
      } else if (result.restored) {
        console.log(`✅ Archived source restored (id: ${result.id})`);
      } else {
        console.log(`ℹ️  Source already exists (id: ${result.id})`);
      }
      console.log(`   ${result.title ?? result.url}`);
      if (result.type) console.log(`   Type: ${result.type}`);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// ── source assign-topic ──────────────────────────────────────────────────

program
  .command('assign-topic')
  .description('Assign a feed source to a topic')
  .requiredOption('--feed-id <id>', 'Feed ID')
  .requiredOption('--topic-id <id>', 'Topic ID')
  .option('-s, --source <source>', 'Assignment source: manual, system, inferred', 'manual')
  .action(async (opts: { feedId: string; topicId: string; source: string }) => {
    try {
      const client = getClient();
      const result = await client.assignFeedTopic({
        feed_id: parseInt(opts.feedId, 10),
        topic_id: parseInt(opts.topicId, 10),
        source: opts.source as 'system' | 'manual' | 'inferred',
      });

      if (isJsonMode()) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (result.created) {
        console.log(`✅ Feed ${result.feed_id} assigned to topic ${result.topic_id} (source: ${result.source})`);
      } else {
        console.log(`ℹ️  Feed ${result.feed_id} already assigned to topic ${result.topic_id}`);
      }
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
