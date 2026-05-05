# Sift — Research intelligence CLI + Tana Bridge

Search, question, and manage an AI-curated article corpus via the `sift` CLI. Optionally sync curated articles into Tana as structured nodes — Tana becomes the control plane, Sift is the research engine, Claude orchestrates.

## Prerequisites

- `sift` binary installed at `~/bin/sift` (or on PATH)
- Environment variables `SIFT_CLIENT_ID` and `SIFT_CLIENT_SECRET` set
- Account at https://app.getsift.ch
- For Tana integration: `tana-local` MCP server running (Tana Desktop)

## When to use this skill

- User asks about recent news, articles, or research on a topic Sift tracks
- User wants to find sources or references for a specific subject
- User asks "what's new in [topic]" or "find articles about [subject]"
- User wants to add a new feed source or create a research topic
- User says "sync sift", "update my research", "run sift queries", "sync sift to tana"
- User wants to track a topic in Tana: "track AI security in my Tana"
- A scheduled routine fires to auto-sync research

## Commands

### Search articles

```bash
sift search "<query>" --json --limit 10
sift search "<query>" --since 7d --json
sift search "<query>" --topic Security --json
sift search "<query>" --since 30d --topic AI --limit 5 --json
```

Returns matching articles with title, URL, snippet, and publication date. Use `--json` for structured output you can parse.

Options:
- `--since <duration>` — Filter to articles published within duration. Formats: `7d` (days), `4w` (weeks), `3m` (months).
- `--topic <name-or-id>` — Filter by topic name (prefix-matched, case-insensitive) or numeric topic ID.
- `-n, --limit <n>` — Maximum results (default: 10).

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
- When the user asks to monitor a new area, add sources with `source-add` (topic creation requires super admin access via the web UI)

---

## Tana Integration (Sift → Tana Bridge)

Sift imports curated articles directly into Tana as structured nodes. Tana is the control plane — users define research queries as `#sift-query` nodes. Claude runs the queries via `sift search`, imports results as tagged article children, and updates the Last run date. Schedule it for fully autonomous research.

### Architecture

```
TANA (control plane)              SIFT (research engine)
┌──────────────────┐              ┌──────────────────┐
│ #sift-query      │  ← Claude →  │ sift search      │
│   Query:: "..."  │  orchestrates │   --json         │
│   Frequency::    │              │   --limit N      │
│   Last run::     │              └──────────────────┘
│   ├── #article   │
│   ├── #article   │  ← import_tana_paste
│   └── #article   │
└──────────────────┘
```

### Setup (first run)

On first use, ask the user two things:

1. **Query tag:** Create `#sift-query` (always new — Sift-specific)
2. **Article tag:** "Do you have an existing tag for articles/bookmarks/resources? (e.g. #article, #bookmark, #toread)"
   - If yes → use their tag. Discover fields via `get_tag_schema`. Map Sift fields (URL, date, source) to existing fields. Add missing fields only with permission.
   - If no → create `#sift-article` with fields: URL (url), Published (date), Source (plain), Relevance (number)

```
1. list_tags → search for "sift-query"
2. If missing, create sift-query tag with fields:
   - Query (plain), Frequency (options: daily/weekly/on-demand), Last run (date), Max results (number, default 5)
3. Ask user about article tag preference:
   - "I can create a #sift-article tag, or use your existing article/bookmark tag. Which do you prefer?"
   - If existing: get_tag_schema → map fields → store mapping
   - If new: create #sift-article with standard fields
4. Store all tag/field IDs for future use
```

**Important:** Every Tana workspace has different tags. Never hardcode tag or field IDs. Always discover or create on first run, then reference by ID.

### Field mapping for existing tags

When the user chooses an existing article tag, map Sift data to their fields:

| Sift data | Common field names to look for |
|-----------|-------------------------------|
| Article URL | url, link, source, URL |
| Published date | date, published, created, when |
| Source/feed name | source, from, feed, origin, publisher |
| Relevance score | score, relevance, rating, priority |
| Snippet/abstract | summary, description, content, notes |

If a field doesn't exist on their tag, ask before adding it. Some users want minimal metadata — respect that.

### Running the bridge

```
Triggers: "sync sift", "run sift queries", "update my research", "sync sift to tana"

1. search_nodes({ hasType: "<sift-query-tag-id>" }) → get all query nodes
2. For each query node:
   a. read_node(queryNodeId) → get Query field value (fallback: node name), Max results
   b. sift ask "<query>" --json
   c. Check answer_confidence — skip import if < 0.5 (corpus doesn't cover this topic well)
   d. Extract citations array from response
   e. Filter citations: drop articles older than 90 days
   f. get_children(queryNodeId) → existing articles (for dedup by URL)
   g. For each new citation (URL not already in children):
      import_tana_paste into queryNodeId:
        - <title> #[[^article-tag-id]]
          - [[^urlFieldId]]:: <url>
          - [[^summaryFieldId]]:: <AI-generated answer excerpt relevant to this citation>
          - Published:: <date>
   h. set_field_content(queryNodeId, lastRunFieldId, today's date)
3. Report: "Updated N queries, imported M new articles, skipped K duplicates, K low-confidence queries"
```

**Why `sift ask` instead of `sift search`:**
- `ask` returns AI-synthesized answers with relevance-scored citations
- `search` is keyword-matching — returns noisy, often irrelevant results
- `ask` includes `answer_confidence` (0-1) — natural quality gate
- Tradeoff: `ask` is slower and costs API tokens, but quality is dramatically better

### Creating a query node

User says "track AI security in Tana" or "create a sift query for supply chain attacks":

```
import_tana_paste into user's chosen parent node:
- AI Security Research #[[^sift-query-tag-id]]
  - [[^queryFieldId]]:: AI security threats 2026
  - [[^frequencyFieldId]]:: weekly
  - [[^maxResultsFieldId]]:: 5
```

### Scheduled automation

For hands-free research, set up a scheduled routine:

```
/schedule "Read all #sift-query nodes from Tana. For each, run sift search 
with the Query field value. Import new articles as children using the user's 
article tag. Deduplicate by URL. Update Last run date." daily at 8am
```

This runs every morning: Claude wakes up, reads your Tana queries, searches Sift, imports new articles, goes back to sleep. Your Tana research nodes fill up overnight.

**Frequency-aware scheduling:** Check the Frequency field on each query. Only run queries whose frequency matches:
- daily → run every day
- weekly → run only if Last run is 7+ days ago
- on-demand → skip (user triggers manually)

### Deduplication

Before importing, read existing children of the query node. Extract URLs from article nodes. Skip any sift result whose URL already exists as a child. This makes re-runs safe — same query, only new articles imported.

### Example workflows

```
User: "Set up Sift research tracking in my Tana"
→ Create tags if needed, ask about article tag, explain the system

User: "Track articles about Claude Code and personal AI"
→ Create #sift-query node with that search query

User: "Update my research" or "sync sift"
→ Run all queries, import new articles, report results

User: "What did Sift find this week?"
→ Read recent article nodes under #sift-query parents, summarize

User: "Schedule daily research sync"
→ Set up scheduled routine via /schedule
```

---

## Standard CLI workflow

```bash
# 1. Check what topics exist
sift topics --json | jq '.[].name'

# 2. Search for articles on a topic
sift search "supply chain attacks 2026" --json --limit 5

# 3. Ask a synthesized question
sift ask "What are the most significant supply chain attacks this year?" --json

# 4. Add a new source and assign it to a topic
sift source-add "https://security.blog/feed.xml" --type rss --json
sift assign-topic --feed-id 42 --topic-id 3 --json
```
