# RAG System Overview — Status, Architecture & Expansion Roadmap

> **Document version:** 1.0  
> **Last updated:** 2026-04-24  
> **Audience:** Product & Engineering  

---

## Table of Contents

1. [What is RAG?](#1-what-is-rag)
2. [Our Current Implementation (v1 — Structured Retrieval)](#2-our-current-implementation-v1--structured-retrieval)
3. [Architecture Diagram](#3-architecture-diagram)
4. [What the AI Currently Sees](#4-what-the-ai-currently-sees)
5. [Known Limitations of v1](#5-known-limitations-of-v1)
6. [Expansion Options — The RAG Roadmap](#6-expansion-options--the-rag-roadmap)
7. [RAG v2 — Enhanced Structured Retrieval](#7-rag-v2--enhanced-structured-retrieval)
8. [RAG v3 — Semantic Search with Embeddings](#8-rag-v3--semantic-search-with-embeddings)
9. [RAG v4 — User Knowledge Uploads (PDF, Documents)](#9-rag-v4--user-knowledge-uploads-pdf-documents)
10. [RAG v5 — Admin Knowledge Base](#10-rag-v5--admin-knowledge-base)
11. [RAG v6 — Agentic RAG (Tool-Based Retrieval)](#11-rag-v6--agentic-rag-tool-based-retrieval)
12. [Technology Comparison](#12-technology-comparison)
13. [Cost & Token Impact Analysis](#13-cost--token-impact-analysis)
14. [Recommendation & Priority Matrix](#14-recommendation--priority-matrix)
15. [File References](#15-file-references)

---

## 1. What is RAG?

**Retrieval Augmented Generation (RAG)** means the AI doesn't just rely on its training data and system prompt — it **retrieves relevant information from our own data** before generating a response.

Think of it like this: instead of asking a friend who "sort of knows Serbian", you're asking a friend who **first opens the textbook to the right page**, then answers your question.

There are different levels of RAG sophistication:

| Level | Name | How it works | We have this? |
|-------|------|-------------|---------------|
| **L0** | No RAG | AI only uses system prompt + conversation history | — |
| **L1** | Structured Retrieval | Fetch specific DB records by known keys (unit number, user ID) | **✅ Current** |
| **L2** | Enhanced Structured | L1 + personalized data (progress, weak spots, more content types) | Partially planned |
| **L3** | Semantic Search | Convert question to embedding, find similar content via vector search | ❌ Not yet |
| **L4** | Document Ingestion | Users/admins upload documents, system chunks + embeds them | ❌ Not yet |
| **L5** | Agentic RAG | AI decides *what* to retrieve using tools, multi-step reasoning | ❌ Not yet |

---

## 2. Our Current Implementation (v1 — Structured Retrieval)

### How it Works

Our current system is a **deterministic, structured retrieval** approach — no embeddings, no vector database, no similarity search. The AI context is built from known database tables using the user's current unit number as the lookup key.

### Data Sources Currently Used

| Source | Table | What's Retrieved | Limitation |
|--------|-------|-----------------|------------|
| Vocabulary | `courseVocabulary` | Serbian word + translation + gender | Max 30 entries per unit |
| Unit Title | `unitMetadata` | Title of current unit | English only |
| Grammar | `unitContent` (type=grammar) | Grammar explanation | **Truncated to 500 chars** |

### Data Sources That Exist But Are NOT Used

| Source | Table | What Could Be Retrieved | Why Valuable |
|--------|-------|------------------------|-------------|
| Phrases | `unitContent` (type=phrases) | Common phrases for the unit | Conversational help |
| Dialogues | `unitContent` (type=dialogues) | Example conversations | Situational practice |
| Full grammar | `unitContent` (type=grammar) | Complete explanation | Currently truncated |
| Overview | `unitContent` (type=overview) | Unit introduction text | General context |
| Pronunciation | `courseVocabulary.pronunciation` | How to pronounce words | Pronunciation questions |
| Vocabulary notes | `courseVocabulary.noteEn/noteDe` | Language-specific notes | Cultural/usage context |
| User progress | `vocabularyProgress` | Mastered/weak vocabulary | Personalization |
| Quiz results | `quizProgress`, `exerciseQuestionProgress` | Scores, wrong answers | Targeted coaching |
| Course structure | `moduleMetadata` | Module titles, descriptions | Curriculum overview |

### Both Chat Paths

| Path | Used For | Context Source |
|------|----------|---------------|
| **Streaming** (primary) | Live chat via HTTP SSE | `getStreamContext()` — finds last user message with `unitContext` in history |
| **Non-streaming** (fallback) | Action-based response | `sendMessage()` — receives `unitContext` directly as argument |

---

## 3. Architecture Diagram

### Current (v1)

```
┌──────────────┐     ┌───────────────────┐     ┌──────────────────┐
│  User sends  │     │  Convex Backend    │     │  AI Provider     │
│  message     │────▶│                    │────▶│  (Gemini/OpenAI) │
│              │     │  1. Get user info  │     │                  │
│  unitContext  │     │  2. Load DB prompt │     │  System prompt   │
│  = currentUnit│     │  3. buildUnitCtx() │     │  + Unit context  │
│              │     │     ├─ vocabulary   │     │  + Chat history  │
│              │     │     ├─ metadata     │     │  + User message  │
│              │     │     └─ grammar      │     │                  │
│              │     │  4. Assemble prompt │     │  → Response      │
└──────────────┘     └───────────────────┘     └──────────────────┘
```

### Future (v3+ with Embeddings)

```
┌──────────────┐     ┌───────────────────┐     ┌──────────────────┐
│  User sends  │     │  Convex Backend    │     │  AI Provider     │
│  message     │────▶│                    │────▶│                  │
│              │     │  1. Embed question │     │  System prompt   │
│              │     │       ↓            │     │  + Retrieved     │
│              │     │  2. Vector search  │     │    knowledge     │
│              │     │     ├─ unit chunks │     │  + Unit context  │
│              │     │     ├─ KB docs     │     │  + User profile  │
│              │     │     └─ user data   │     │  + Chat history  │
│              │     │  3. Score & rank   │     │  + User message  │
│              │     │  4. Assemble       │     │                  │
└──────────────┘     └───────────────────┘     └──────────────────┘
                              ↑
                     ┌────────┴────────┐
                     │  Embedding      │
                     │  Pipeline       │
                     │  (ingest docs,  │
                     │   chunk, embed) │
                     └─────────────────┘
```

---

## 4. What the AI Currently Sees

Example for a user in **Unit 1** with learning language **English**:

```
[SYSTEM PROMPT]
You are Brate — the personal Serbian language & Balkan life companion...
(~400-600 tokens)

[UNIT CONTEXT: Greetings & Introductions (Unit 1)]

Key vocabulary for this unit:
- Zdravo = Hello
- Dobar dan = Good day
- Hvala = Thank you
- Molim (m) = Please / You're welcome
...

Grammar summary:
The verb "biti" (to be) is one of the most important verbs...
(truncated at 500 characters)

[END UNIT CONTEXT]

[CONVERSATION HISTORY — last 8 messages]
User: How do I say "nice to meet you"?
```

**Token budget estimate (current v1):**

| Component | ~Tokens |
|-----------|---------|
| System prompt | 400–600 |
| Unit context block | 300–500 |
| Conversation history (8 msgs) | 500–1500 |
| User message | 20–100 |
| **Total input** | **~1200–2700** |
| Output (maxTokens) | up to 2048 |

---

## 5. Known Limitations of v1

| # | Limitation | Impact | Severity |
|---|-----------|--------|----------|
| 1 | **Only current unit** — no cross-unit context | AI can't reference grammar from earlier units | Medium |
| 2 | **Grammar truncated to 500 chars** | Complex grammar gets cut off mid-explanation | High |
| 3 | **English-only metadata** | German users see English unit titles in context | Low |
| 4 | **No personalization** | AI doesn't know which words the user struggles with | High |
| 5 | **No phrases/dialogues** | AI misses conversational examples from the unit | Medium |
| 6 | **No relevance filtering** | Full block always attached, even for off-topic questions | Low |
| 7 | **No external knowledge** | Brate can't reference uploaded PDFs, guides, or external docs | High (for Brate concept) |
| 8 | **No pronunciation data** | Can't help with "How do I pronounce...?" questions effectively | Medium |
| 9 | **Max 30 vocabulary entries** | Large units lose vocabulary | Low |
| 10 | **No isActive/published filter** | Could theoretically include draft/archived content | Low |

---

## 6. Expansion Options — The RAG Roadmap

Here's an overview of all expansion stages, from quick wins to sophisticated systems:

```
Current         Quick Wins           Medium Effort         Major Investment
  v1      ──▶     v2          ──▶       v3           ──▶      v4/v5/v6
                                                       
Structured    Enhanced            Semantic Search       Document Upload
Retrieval     Retrieval           + Embeddings          + Knowledge Base
                                                        + Agentic RAG
              • Full grammar      • Vector DB           
              • Phrases           • Chunk + embed       • PDF upload
              • Personalization   • Similarity search   • Admin KB
              • Multi-unit        • Hybrid retrieval    • AI tool calls
              
~2-3 days     ~3-5 days           ~1-2 weeks            ~2-4 weeks
```

---

## 7. RAG v2 — Enhanced Structured Retrieval

**Effort: Low (~2-3 days) | Impact: High | No new infrastructure needed**

This is the immediate next step — get much more out of what we already have.

### What Changes

| Enhancement | What | How |
|------------|------|-----|
| **Full grammar** | Remove 500-char truncation, use full grammar text (or 2000+ chars) | Change `slice(0, 500)` to `slice(0, 3000)` in `buildUnitContextBlock` |
| **Phrases** | Load `unitContent` with `contentType: "phrases"` | Add query in `buildUnitContextBlock` |
| **Dialogues** | Load example dialogues from the unit | Add query for `contentType: "dialogues"` |
| **Pronunciation** | Include pronunciation hints from `courseVocabulary` | Add `pronunciation` field to vocab block |
| **Vocabulary notes** | Include `noteEn`/`noteDe` per word | Add language-specific notes to vocab block |
| **Localized metadata** | Load `unitMetadata` in user's language | Add language filter to metadata query |
| **Personalization** | Load weak vocabulary from `vocabularyProgress` | New query: "User struggles with: kuća, prozor, vrata" |
| **Progress context** | Tell AI: "User is in Unit 5, completed 1-4, 340 XP" | Load from `userProgress` |
| **Multi-unit vocabulary** | Include words from the last 2-3 units as "previously learned" | Multiple vocabulary queries |

### Example: What the AI Would See (v2)

```
[UNIT CONTEXT: Greetings & Introductions (Unit 1)]

Key vocabulary for this unit:
- Zdravo [ZDRAH-voh] = Hello (note: informal, use with friends)
- Dobar dan [DOH-bar dahn] = Good day (note: formal greeting)
...

Key phrases:
- Kako se zovete? = What is your name? (formal)
- Drago mi je = Nice to meet you (literally: "It is dear to me")
...

Example dialogue:
A: Dobar dan! Kako se zovete?
B: Dobar dan! Ja sam Marko. A vi?
...

Grammar (full):
The verb "biti" (to be) is one of the most important verbs in Serbian.
Present tense: ja sam, ti si, on/ona/ono je, mi smo, vi ste, oni/one/ona su
Negative: ja nisam, ti nisi, on/ona/ono nije...
(complete explanation, not truncated)

[USER PROFILE]
Current unit: 1 | Completed: none yet | XP: 45 | Streak: 3 days
Weak vocabulary: (none yet — just started)

[END UNIT CONTEXT]
```

---

## 8. RAG v3 — Semantic Search with Embeddings

**Effort: Medium (~1-2 weeks) | Impact: Very High | New infrastructure needed**

This is where things get *really* powerful. Instead of "give the AI everything from Unit X", the system **understands the user's question** and finds **the most relevant content** across the entire knowledge base.

### How It Works

1. **Ingestion Pipeline** (one-time + on content changes):
   - Take all unit content (grammar, phrases, dialogues, vocabulary, overviews)
   - **Chunk** them into smaller pieces (~200-500 tokens each)
   - **Embed** each chunk using an embedding model (e.g., OpenAI `text-embedding-3-small`)
   - Store chunks + embeddings in a vector-capable database

2. **Query Time** (every chat message):
   - Convert the user's question into an embedding
   - **Vector search** for the most similar chunks
   - Optionally: combine with structured retrieval (unit context) = **Hybrid RAG**
   - Feed top-K results into the AI prompt

### Technology Options

| Option | Description | Pros | Cons |
|--------|------------|------|------|
| **Convex Vector Search** | Built-in `vectorSearch()` in Convex | No extra service, stays in-stack | Limited to 1536 dimensions, basic filtering |
| **Pinecone** | Managed vector database | Very fast, scales well, metadata filtering | Extra service + cost (~$70/mo for Starter) |
| **Qdrant** | Open-source vector DB (self-hosted or cloud) | Free self-hosted, powerful filtering | Self-hosting complexity |
| **Turbopuffer** | Serverless vector DB, pay-per-query | No fixed cost, Convex integration exists | Newer, smaller community |
| **pgvector (Neon)** | PostgreSQL extension for vector search | Familiar SQL, Vercel integration | Needs PostgreSQL, slight performance overhead |

### Recommended: Convex Built-In Vector Search

Convex has native `vectorSearch()` support. This keeps everything in one stack and is the most pragmatic choice for our scale.

**Schema addition:**
```typescript
knowledgeChunks: defineTable({
  content: v.string(),           // The actual text chunk
  embedding: v.array(v.float64()), // 1536-dim vector
  sourceType: v.string(),        // "grammar", "vocabulary", "phrase", "dialogue", "culture"
  sourceId: v.optional(v.string()),
  unitNumber: v.optional(v.number()),
  language: v.string(),          // "en", "de"
  metadata: v.optional(v.string()), // JSON: title, category, etc.
})
  .vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536,
    filterFields: ["language", "sourceType"],
  })
```

**Query flow:**
```typescript
// 1. Embed the user's question
const questionEmbedding = await embedText(userMessage);

// 2. Vector search for relevant chunks
const results = await ctx.vectorSearch("knowledgeChunks", "by_embedding", {
  vector: questionEmbedding,
  limit: 5,
  filter: (q) => q.eq("language", userLanguage),
});

// 3. Add to prompt
const context = results.map(r => r.content).join("\n\n");
```

### Embedding Model Options

| Model | Dimensions | Cost (per 1M tokens) | Quality |
|-------|-----------|---------------------|---------|
| OpenAI `text-embedding-3-small` | 1536 | $0.02 | Good |
| OpenAI `text-embedding-3-large` | 3072 | $0.13 | Very good |
| Google `text-embedding-004` | 768 | Free (low rate) | Good |
| Cohere `embed-v4.0` | 1024 | $0.10 | Very good |

**Recommendation:** OpenAI `text-embedding-3-small` — cheapest, 1536 dims (Convex max), well-tested.

### Hybrid RAG Strategy

Don't replace structured retrieval — **combine** it:

```
User asks: "How do I conjugate 'imati' in past tense?"

Structured RAG (v2):        Semantic RAG (v3):
├─ Current unit context     ├─ Chunk: "Past tense of 'imati'..."
├─ User progress            ├─ Chunk: "Verb conjugation patterns..."
└─ Weak vocabulary          └─ Chunk: "Examples with 'imati'..."
                                   ↓
                            Combined & deduplicated
                                   ↓
                            Fed to AI prompt
```

---

## 9. RAG v4 — User Knowledge Uploads (PDF, Documents)

**Effort: High (~2-3 weeks) | Impact: Very High for Brate concept**

This enables users (or the "Brate" experience) to work with **uploaded documents** — immigration forms, rental contracts, medical documents, travel guides, etc.

### Use Cases

| Scenario | Document Type | What Brate Does |
|----------|-------------|----------------|
| **Immigration** | PDF visa application form | "This field asks for 'Ime i prezime' — that's your first and last name" |
| **Rental** | Lease contract (Serbian) | "This clause says 'zakupnina' (rent) is 500€ per month, due on the 1st" |
| **Medical** | Doctor's report | "The diagnosis 'upala grla' means throat infection" |
| **Travel** | Serbian train timetable | "Voz 742 polazi u 14:30 — Train 742 departs at 2:30 PM" |
| **Learning** | User's own study notes | RAG uses them for personalized coaching |

### Technical Pipeline

```
User uploads PDF
       ↓
1. Store in Convex Storage (generateUploadUrl)
       ↓
2. Extract text (pdf-parse — already in dependencies!)
       ↓
3. Chunk text (~300-500 tokens per chunk)
       ↓
4. Embed each chunk (OpenAI text-embedding-3-small)
       ↓
5. Store in userDocumentChunks table
       ↓
6. On chat: vector search user's documents + course knowledge
       ↓
7. AI sees relevant document excerpts in context
```

### New Schema

```typescript
userDocuments: defineTable({
  userId: v.id("users"),
  fileName: v.string(),
  fileType: v.string(),              // "pdf", "txt", "md"
  storageId: v.id("_storage"),       // Convex file storage
  status: v.union(
    v.literal("uploaded"),
    v.literal("processing"),
    v.literal("ready"),
    v.literal("error")
  ),
  totalChunks: v.optional(v.number()),
  description: v.optional(v.string()), // User's description of the doc
  category: v.optional(v.string()),    // "immigration", "medical", "learning", etc.
})
  .index("by_user", ["userId"])
  .index("by_user_status", ["userId", "status"]),

userDocumentChunks: defineTable({
  documentId: v.id("userDocuments"),
  userId: v.id("users"),
  content: v.string(),
  embedding: v.array(v.float64()),
  chunkIndex: v.number(),
  metadata: v.optional(v.string()),
})
  .index("by_document", ["documentId"])
  .vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536,
    filterFields: ["userId"],
  }),
```

### Limits & Safety

| Concern | Mitigation |
|---------|-----------|
| Storage costs | Limit: 5 documents per user, max 10MB each |
| Processing time | Background action with status tracking |
| Sensitive data | Documents are user-scoped, never shared |
| Token budget | Max 3 document chunks per query (~1500 tokens) |
| Abuse prevention | File type validation, virus scanning consideration |

### Existing Infrastructure We Can Reuse

- `pdf-parse` — **already in `package.json`** (used in Content Studio)
- Convex Storage — already used for audio, avatars, backups
- `generateUploadUrl` pattern — already implemented in multiple places

---

## 10. RAG v5 — Admin Knowledge Base

**Effort: Medium (~1-2 weeks) | Impact: High for Brate's cultural knowledge**

This is where **we** (admins) upload curated knowledge that **all users** benefit from — cultural guides, holiday explanations, common phrases, city guides, etc.

### Content Types

| Category | Examples | Format |
|----------|---------|--------|
| **Culture** | Slava guide, Božić traditions, kafana etiquette | Markdown articles |
| **Practical** | "How to open a bank account in Serbia", "Belgrade public transport guide" | Structured guides |
| **Language** | Colloquial expressions, regional dialects, slang dictionary | Vocabulary lists |
| **Geography** | City guides (Belgrade, Novi Sad, Niš), tourist tips | Rich text |
| **Cuisine** | Recipe explanations, restaurant vocabulary, food culture | Articles |
| **Immigration** | Visa types, work permits, bureaucracy guide | Official info + tips |

### Architecture

```
Admin uploads knowledge article (via Content Studio or dedicated KB admin)
       ↓
1. Store article in knowledgeArticles table
       ↓
2. Chunk + embed (background action)
       ↓
3. Store in knowledgeChunks table (shared, not user-scoped)
       ↓
4. Available to ALL users via vector search
```

### Difference from v4 (User Uploads)

| Aspect | v4 (User Documents) | v5 (Admin Knowledge Base) |
|--------|---------------------|--------------------------|
| Who uploads | Individual users | Admins/editors |
| Scope | User-private | Shared across all users |
| Content type | Personal documents | Curated knowledge |
| Quality control | None (user's own) | Reviewed, structured |
| Vector search filter | Filter by `userId` | No user filter needed |

---

## 11. RAG v6 — Agentic RAG (Tool-Based Retrieval)

**Effort: Very High (~3-4 weeks) | Impact: Transformative**

Instead of us deciding *what* context to retrieve, the AI **decides for itself** what information it needs, using tool calls.

### How It Works

```
User: "I'm moving to Belgrade next month. What documents do I need?"

AI thinks: "I need immigration info + practical guide + maybe bureaucracy tips"
       ↓
AI calls tool: searchKnowledge("immigration documents Belgrade")
AI calls tool: searchKnowledge("moving to Serbia checklist")
AI calls tool: getUserProfile()  → sees: German speaker, beginner
       ↓
AI assembles response from retrieved knowledge + its own knowledge
```

### Available Tools for the AI

```typescript
const tools = {
  searchKnowledge: {
    description: "Search the knowledge base for relevant articles and guides",
    parameters: { query: "string", category: "optional string" },
  },
  getUnitContent: {
    description: "Get vocabulary, grammar, or phrases for a specific unit",
    parameters: { unitNumber: "number", contentType: "string" },
  },
  getUserProgress: {
    description: "Get the user's learning progress and weak areas",
    parameters: {},
  },
  searchVocabulary: {
    description: "Search for a specific Serbian word or phrase",
    parameters: { query: "string" },
  },
};
```

### When This Makes Sense

- When we have a **large** knowledge base (50+ articles)
- When user questions are **diverse** and unpredictable
- When the AI needs to **combine multiple sources** intelligently
- Requires AI models that support tool/function calling well

---

## 12. Technology Comparison

### Vector Database Options (for v3+)

| Solution | Monthly Cost | Latency | Max Vectors | Convex Integration | Setup |
|----------|-------------|---------|-------------|-------------------|-------|
| **Convex vectorSearch** | $0 (included) | ~50ms | Millions | ✅ Native | None |
| Pinecone Starter | $0 (free tier) | ~30ms | 100K | SDK needed | Easy |
| Pinecone Standard | ~$70/mo | ~20ms | Millions | SDK needed | Easy |
| Turbopuffer | Pay-per-query | ~40ms | Millions | Community lib | Medium |
| Qdrant Cloud | ~$25/mo | ~30ms | Millions | SDK needed | Medium |
| pgvector (Neon) | ~$19/mo | ~60ms | Depends | SQL adapter | Medium |

**Recommendation:** Start with **Convex vectorSearch** — zero additional cost, zero additional infrastructure, good enough for our scale (likely <50K chunks).

### Embedding Model Options

| Model | Provider | Cost/1M tokens | Dimensions | Quality |
|-------|----------|---------------|------------|---------|
| `text-embedding-3-small` | OpenAI | $0.02 | 1536 | Good |
| `text-embedding-3-large` | OpenAI | $0.13 | 3072 | Very good |
| `text-embedding-004` | Google | Free (quota) | 768 | Good |
| `embed-v4.0` | Cohere | $0.10 | 1024 | Very good |
| Local (e.g., `nomic-embed-text`) | Self-hosted | $0 | 768 | Decent |

**Recommendation:** OpenAI `text-embedding-3-small` — $0.02/1M tokens is negligible. Our entire course content would cost <$0.01 to embed once. Compatible with Convex's 1536 dimension limit.

### Document Processing

| Library | Use Case | Already Installed? |
|---------|---------|-------------------|
| `pdf-parse` | Extract text from PDF | **✅ Yes** |
| `mammoth` | Extract text from .docx | No |
| `marked` / `remark` | Parse Markdown | **✅ Yes** (via markdown rendering) |
| `tiktoken` | Token counting for chunking | No |
| `langchain` | Full RAG framework | No (heavy) |

---

## 13. Cost & Token Impact Analysis

### Current v1 Costs

| Component | Tokens/request | Monthly estimate (1000 msgs/day) |
|-----------|---------------|--------------------------------|
| System prompt | ~500 | — |
| Unit context | ~400 | — |
| History (8 msgs) | ~1000 | — |
| User message | ~50 | — |
| **Total input** | **~1950** | ~58.5M input tokens |
| Output (~300 tokens avg) | ~300 | ~9M output tokens |
| **Cost (Gemini 2.0 Flash)** | — | **~$2-5/month** |

### v2 Enhanced (larger context)

| Additional context | Extra tokens | Monthly cost increase |
|-------------------|-------------|---------------------|
| Full grammar (3000 chars) | +400 | ~$0.50 |
| Phrases + dialogues | +300 | ~$0.40 |
| User progress + weak vocab | +200 | ~$0.25 |
| **v2 total increase** | **+900** | **~$1.15/month** |

### v3 Semantic Search

| Component | Cost per request | Monthly (1000 msgs/day) |
|-----------|-----------------|------------------------|
| Embed user question | $0.000002 | $0.06 |
| Vector search (Convex) | $0 | $0 |
| Additional context tokens | ~500 extra | ~$0.60 |
| **v3 total increase** | — | **~$0.66/month** |

### v4 Document Upload

| Component | Cost | Frequency |
|-----------|------|-----------|
| Embed document (10 pages) | ~$0.001 | Per upload |
| Store chunks + embeddings | Included in Convex | — |
| Vector search at query time | Same as v3 | Per message |
| **v4 marginal increase** | **Negligible** | — |

**Bottom line:** Even the most advanced RAG setup adds <$5/month at 1000 messages/day on Gemini Flash. Cost is not a blocker.

---

## 14. Recommendation & Priority Matrix

| Priority | Version | Effort | Impact | When |
|----------|---------|--------|--------|------|
| **🔴 P0** | **v2 — Enhanced Structured** | 2-3 days | High | **Now** — Quick wins, no new infra |
| **🟡 P1** | **v3 — Semantic Search** | 1-2 weeks | Very High | Next sprint — enables intelligent retrieval |
| **🟡 P1** | **v5 — Admin Knowledge Base** | 1-2 weeks | High | Same sprint as v3 — shares embedding infra |
| **🟢 P2** | **v4 — User Document Uploads** | 2-3 weeks | Very High (Brate) | After v3 infra is in place |
| **🔵 P3** | **v6 — Agentic RAG** | 3-4 weeks | Transformative | When KB is large enough to warrant it |

### Recommended Implementation Order

```
Week 1-2:   v2 — Enhanced Structured Retrieval
            └─ Full grammar, phrases, personalization, multi-unit

Week 3-4:   v3 + v5 — Semantic Search + Admin KB
            └─ Convex vectorSearch, embedding pipeline
            └─ Admin uploads cultural/practical knowledge
            └─ Hybrid retrieval (structured + semantic)

Week 5-7:   v4 — User Document Uploads
            └─ PDF upload UI, processing pipeline
            └─ Brate can reference user's documents
            └─ "Upload your rental contract — I'll help you understand it"

Week 8+:    v6 — Agentic RAG (if needed)
            └─ AI chooses what to retrieve
            └─ Multi-step reasoning
```

### Why This Order?

1. **v2 first** because it's almost free — we already have the data, just need to use it
2. **v3 + v5 together** because they share the embedding infrastructure
3. **v4 after v3** because user docs need the same vector search that v3 builds
4. **v6 last** because it requires a mature KB to be useful

---

## 15. File References

### Current RAG Code

| File | Key Functions |
|------|--------------|
| `convex/chat.ts` | `buildUnitContextBlock()`, `getUnitContextBlock()`, `getStreamContext()` |
| `convex/chat.ts` | `sendMessage()` (non-streaming), `streamChatMessage` (HTTP streaming) |
| `convex/ai/chatConfig.ts` | `resolveModelConfig()`, `generateChatResponse()`, `streamChatResponse()` |
| `convex/http.ts` | HTTP endpoint routing for `/chat/stream` |

### Schema Files

| File | Relevant Tables |
|------|----------------|
| `convex/schema/chat.ts` | `chatSessions`, `chatMessages`, `chatPrompts`, `chatSuggestions` |
| `convex/schema/vocabulary.ts` | `courseVocabulary`, `vocabularyProgress` |
| `convex/schema/learning.ts` | `unitMetadata`, `unitContent`, `unitInteractiveTests` |
| `convex/schema/progress.ts` | `userProgress`, `quizProgress`, `exerciseQuestionProgress` |

### Existing Documentation

| File | Content |
|------|---------|
| `docs/RAG-CHAT-INTEGRATION.md` | Original RAG documentation (v1 focused) |
| `docs/BUDDY_SYSTEM_PROMPT_V2.md` | Brate persona & system prompt spec |
| `docs/FEATURE_PACKAGES_MARKETING.md` | Package tiers (Learning, Buddy, Complete) |
| `docs/FEATURE_PACKAGES_IMPLEMENTATION_PLAN.md` | Feature gating implementation plan |

### Dependencies Already Available

| Package | Used For | RAG Relevance |
|---------|---------|--------------|
| `pdf-parse` | PDF text extraction | ✅ Ready for v4 document uploads |
| `@convex-dev/persistent-text-streaming` | Chat streaming | ✅ Already integrated |
| `ai`, `@ai-sdk/openai`, `@ai-sdk/google` | AI SDK | Available but not used in chat (chat uses raw fetch) |

---

*This document will be updated as we progress through the RAG roadmap. Each version will get its own detailed implementation plan when we start working on it.*
