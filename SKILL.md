# Sift — Research intelligence CLI

Search, question, and manage an AI-curated article corpus via the `sift` CLI.

Sift monitors RSS feeds, newsletters, YouTube channels, and web pages across your research topics. It scores articles for relevance and quality, then generates daily or weekly digest summaries. This skill gives you CLI access to that corpus.

## Prerequisites

- `sift` binary installed at `~/bin/sift` (or on PATH)
- Environment variables `SIFT_CLIENT_ID` and `SIFT_CLIENT_SECRET` set
- Account at https://app.getsift.ch

## When to use this skill

- User asks about recent news, articles, or research on a topic Sift tracks
- User wants to find sources or references for a specific subject
- User asks "what's new in [topic]" or "find articles about [subject]"
- User wants to add a new feed source or create a research topic

## Commands

### Search articles

```bash
sift search "<query>" --json --limit 10
```

Returns matching articles with title, URL, snippet, and publication date. Use `--json` for structured output you can parse.

### Ask a research question

```bash
sift ask "<question>" --json
sift ask "<question>" --mode deep --json
```

Returns an AI-generated answer with citations from the article corpus. Use `--mode deep` for thorough analysis across more sources.

### List topics

```bash
sift topics --json
```

Returns all research topics with article and feed counts.

### Create a topic

```bash
sift topic-create "<name>" --description "<description>" --json
```

### List sources

```bash
sift sources --json --limit 50
```

### Add a source

```bash
sift source-add "<url>" --type rss --json
```

Types: `rss`, `webpage`, `newsletter`, `academic`, `social`, `video`.

### Assign source to topic

```bash
sift assign-topic --feed-id <id> --topic-id <id> --json
```

## Usage guidelines

- Always use `--json` flag when calling from an agent so you can parse the output
- For broad research questions, use `sift ask` with `--mode deep`
- For finding specific articles, use `sift search` with targeted queries
- Check `sift topics --json` first to see what research areas are available
- When the user asks to monitor a new area, create a topic with `topic-create` and add sources with `source-add`

## Example workflow

```bash
# 1. Check what topics exist
sift topics --json | jq '.[].name'

# 2. Search for articles on a topic
sift search "supply chain attacks 2026" --json --limit 5

# 3. Ask a synthesized question
sift ask "What are the most significant supply chain attacks this year?" --json

# 4. Add a new source the user mentioned
sift source-add "https://security.blog/feed.xml" --type rss --json

# 5. Assign it to a topic
sift assign-topic --feed-id 42 --topic-id 3 --json
```
