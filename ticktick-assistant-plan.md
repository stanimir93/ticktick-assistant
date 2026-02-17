# TickTick Assistant — React Chat App Plan

## Context

You want an AI-powered TickTick assistant — a chat interface where you can give natural language instructions to organize, rename, move, and complete your TickTick tasks. The app will be a React SPA hosted on GitHub Pages, with a lightweight Cloudflare Worker proxy to handle CORS for TickTick and LLM API calls. Supports multiple LLM providers — Claude, OpenAI, Gemini, and Grok.

**Project location:** `/Users/stanimir/Projects/ticktick-assistant`

## Architecture

```
GitHub Pages (static hosting)
    └── React + Vite + Tailwind SPA
            ├── Chat UI (DIY with Tailwind)
            └── All API calls go through ↓

Cloudflare Worker (CORS proxy)
    ├── /api/llm/* → forwards to selected LLM provider API
    └── /api/ticktick/* → forwards to api.ticktick.com/api/v2/*
```

**Why a proxy?** TickTick's v2 API does not send CORS headers for third-party origins, and most LLM APIs (OpenAI, Grok) also lack browser CORS support. A Cloudflare Worker (free tier, ~20 lines of code) forwards requests and adds the necessary CORS headers. The proxy is stateless — it only relays requests and never stores data.

**Key insight:** TickTick's unofficial v2 API supports sections/columns, batch operations, and task moves — everything you need. The official v1 API is too limited. The v2 API uses username/password auth (not OAuth), which is actually simpler for this use case.

## Supported LLM Providers

| Provider | API Base URL | Auth | Tool/Function Calling |
|----------|-------------|------|----------------------|
| **Claude** (Anthropic) | `api.anthropic.com` | `x-api-key` header | `tools` array, `tool_use` / `tool_result` content blocks |
| **OpenAI** | `api.openai.com` | `Authorization: Bearer` | `tools` array with `function` objects, `tool_calls` in response |
| **Gemini** (Google) | `generativelanguage.googleapis.com` | API key in URL | `tools` with `function_declarations`, `functionCall` parts |
| **Grok** (xAI) | `api.x.ai` | `Authorization: Bearer` | OpenAI-compatible format |

All four providers support function calling / tool use — the app uses a **provider adapter pattern** to normalize the differences.

## Tech Stack

- **React 19.2** + **Vite 7** + **TypeScript**
- **Tailwind CSS v4** — styling (CSS-first config via `@theme` directive, no `tailwind.config.js`)
- **No chat UI library** — DIY with Tailwind (chat bubbles, input box, markdown rendering)
- **react-markdown** — render LLM markdown responses
- **`@uidotdev/usehooks`** — `useLocalStorage` hook for syncing state with localStorage (auto-reads on mount, updates storage on change, syncs across tabs)
- **Cloudflare Worker** — lightweight CORS proxy (~20 lines, free tier)
- **Provider adapter pattern** — thin abstraction layer to normalize tool calling across LLM APIs (no external LLM SDK needed — just `fetch`)

## Pages / Views

1. **Settings page** (`/#/settings`) — Enter and store credentials:
   - **TickTick section:**
     - Email + password (used once to get session token, then discarded — only the token is stored)
   - **LLM Providers section** — configure each provider independently:
     - One card per provider (Claude / OpenAI / Gemini / Grok)
     - Each card has: API key field, model dropdown (populated per provider), "Test" button
     - Visual indicator: configured (has key) vs not configured
     - Only need to configure the providers you want to use — leave the rest blank
   - **Active provider selector** — pick which configured provider to use for chat (only shows providers that have a key saved)
   - All stored in `localStorage` as a `providers` object keyed by provider name:
     ```json
     {
       "activeProvider": "claude",
       "providers": {
         "claude": { "apiKey": "sk-...", "model": "claude-sonnet-4-5-20250929" },
         "openai": { "apiKey": "sk-...", "model": "gpt-4.1" }
       },
       "ticktickToken": "..."
     }
     ```

2. **Chat page** (`/#/` — main) — The chat interface:
   - Message list (user messages + LLM responses)
   - Input box at bottom
   - **Provider switcher** in the chat header — dropdown to switch the active LLM provider on the fly (only shows configured providers)
   - Each assistant message shows a small badge with which provider + model generated it
   - LLM has access to TickTick tools (implemented as function calling)

## How the Chat + TickTick Integration Works

The LLM is called with **tool use** (function calling). The app defines TickTick tools that the LLM can invoke:

```
User types: "Move all low-priority tasks in Work to the Backlog section"
    ↓
App sends message to LLM API (via proxy) with tool definitions
    ↓
LLM responds with tool call: get_project_tasks(project="Work")
    ↓
App executes the tool call against TickTick v2 API (via proxy)
    ↓
App sends tool result back to LLM
    ↓
LLM responds with tool call: update_tasks(tasks=[...], columnId="backlog-id")
    ↓
App executes, sends result back
    ↓
LLM responds: "Done! I moved 5 tasks to the Backlog section."
```

## TickTick Tools (Function Calling)

These are the tools the LLM can call — the app executes them against the TickTick v2 API:

| Tool | Description | v2 Endpoint |
|------|-------------|-------------|
| `list_projects` | Get all projects/lists | `GET /batch/check/0` → `projectProfiles` |
| `get_project_tasks` | Get all tasks in a project | `GET /batch/check/0` → filter by projectId |
| `get_project_sections` | Get sections/columns for a project | `GET /column/project/{projectId}` |
| `update_task` | Rename, change description, priority | `POST /batch/task` with `update` array |
| `move_task_to_section` | Move task to a different section | `POST /batch/task` — update `columnId` |
| `move_task_to_project` | Move task to a different project | `POST /batch/taskProject` |
| `complete_task` | Mark task as done | `POST /batch/task` — set `status: 2` |
| `create_task` | Create a new task | `POST /batch/task` with `add` array |
| `batch_update_tasks` | Update multiple tasks at once | `POST /batch/task` with multiple in `update` |

## File Structure

```
/Users/stanimir/Projects/ticktick-assistant/
├── .github/
│   └── workflows/
│       └── deploy.yml              # GitHub Pages deployment
├── proxy/
│   └── worker.ts                   # Cloudflare Worker CORS proxy
├── public/
│   └── favicon.svg
├── src/
│   ├── main.tsx                    # Entry point
│   ├── App.tsx                     # Router setup
│   ├── pages/
│   │   ├── ChatPage.tsx            # Main chat interface
│   │   └── SettingsPage.tsx        # Credentials + provider management
│   ├── components/
│   │   ├── ChatMessage.tsx         # Single message bubble (shows provider badge)
│   │   ├── ChatInput.tsx           # Message input box
│   │   ├── ToolCallCard.tsx        # Shows tool calls inline (collapsible)
│   │   ├── ProviderCard.tsx        # Settings: one LLM provider config card
│   │   └── ProviderSwitcher.tsx    # Chat header: dropdown to switch active provider
│   ├── lib/
│   │   ├── llm/
│   │   │   ├── types.ts            # Shared LLM types (Message, ToolCall, etc.)
│   │   │   ├── base.ts             # LLMProvider interface
│   │   │   ├── claude.ts           # Anthropic adapter
│   │   │   ├── openai.ts           # OpenAI adapter (also used by Grok)
│   │   │   ├── gemini.ts           # Google Gemini adapter
│   │   │   └── index.ts            # getProvider(name) factory
│   │   ├── ticktick.ts             # TickTick v2 API client
│   │   ├── tools.ts                # Tool definitions + execution logic
│   │   ├── tool-loop.ts            # Provider-agnostic tool use loop
│   │   └── storage.ts              # localStorage helpers (typed wrappers for provider configs, active provider, token)
│   └── types/
│       └── index.ts                # TypeScript types for tasks, projects, etc.
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

## LLM Provider Adapter Pattern

All providers implement this interface:

```typescript
interface LLMProvider {
  /** Convert our canonical tool definitions to provider-specific format */
  formatTools(tools: ToolDefinition[]): unknown;

  /** Build the request body for the provider's API */
  buildRequest(messages: Message[], tools: ToolDefinition[], model: string): {
    url: string;
    headers: Record<string, string>;
    body: unknown;
  };

  /** Parse the provider's response into our canonical format */
  parseResponse(response: unknown): {
    text?: string;
    toolCalls?: ToolCall[];  // { id, name, arguments }
  };

  /** Format a tool result for sending back to the provider */
  formatToolResult(toolCallId: string, result: string): unknown;

  /** Default models and available model options */
  models: { default: string; options: string[] };
}
```

### Provider-specific notes

- **Claude**: Uses `tool_use`/`tool_result` content blocks. Tool schemas use `input_schema`. Requires `anthropic-version` header.
- **OpenAI**: Uses `tools` with `function` wrappers. Tool calls come as `tool_calls` array. Tool results sent as `role: "tool"` messages.
- **Gemini**: Uses `function_declarations` inside `tools`. Responses contain `functionCall` parts. Tool results sent as `functionResponse` parts. API key passed as URL param, not header.
- **Grok**: xAI's API is fully OpenAI-compatible — reuse the OpenAI adapter with a different base URL.

### The tool-use loop (`tool-loop.ts`)

The loop is **provider-agnostic** — it works the same regardless of which LLM is active:

```typescript
async function runToolLoop(provider, messages, tools, ticktickClient) {
  while (true) {
    const response = await fetch(provider.buildRequest(messages, tools, model));
    const parsed = provider.parseResponse(await response.json());

    if (!parsed.toolCalls?.length) {
      return parsed.text;  // Final text response — done
    }

    // Execute each tool call against TickTick API
    for (const call of parsed.toolCalls) {
      const result = await executeTool(call.name, call.arguments, ticktickClient);
      messages.push(provider.formatToolResult(call.id, result));
    }
  }
}
```

## Implementation Steps

### Step 1: Cloudflare Worker proxy
- Create `proxy/worker.ts` — a simple request forwarder:
  - `POST /api/ticktick/*` → forward to `https://api.ticktick.com/api/v2/*`
  - `POST /api/llm/anthropic/*` → forward to `https://api.anthropic.com/*`
  - `POST /api/llm/openai/*` → forward to `https://api.openai.com/*`
  - `POST /api/llm/gemini/*` → forward to `https://generativelanguage.googleapis.com/*`
  - `POST /api/llm/grok/*` → forward to `https://api.x.ai/*`
  - Add `Access-Control-Allow-Origin: *` and other CORS headers to all responses
  - Handle `OPTIONS` preflight requests
- Deploy with `npx wrangler deploy`
- Store the Worker URL as an env var in the Vite config (e.g., `VITE_PROXY_URL`)

### Step 2: Project scaffolding
- `npm create vite@latest . -- --template react-ts` (scaffolds with Vite 7 + React 19.2)
- Install deps: `tailwindcss @tailwindcss/vite`, `react-markdown`, `@uidotdev/usehooks`
- Configure Vite with `base: '/ticktick-assistant/'` for GitHub Pages
- Add `@tailwindcss/vite` plugin to `vite.config.ts`
- Set up Tailwind CSS v4 — no `tailwind.config.js` needed; use CSS-first config with `@import "tailwindcss"` and `@theme { ... }` in your CSS entry file
- Simple `useState`-based view switching (chat vs settings) — no router needed for two views

### Step 3: Settings page + localStorage
- Build `SettingsPage.tsx` with two sections:
  - **TickTick connection:** email + password login form → credentials sent to TickTick to get a session token, then discarded; only the token stored in localStorage. "Test Connection" button.
  - **LLM Providers:** one `<ProviderCard>` per provider (Claude / OpenAI / Gemini / Grok):
    - API key input (masked, shows if already saved)
    - Model dropdown (options populated per provider from the adapter's `models` list)
    - "Test" button — makes a simple "say hello" call to validate the key
    - "Remove" button to clear a saved key
    - Visual state: configured (checkmark) vs not configured (greyed out)
  - **Active provider selector:** radio buttons showing only providers that have a key saved
- State management via `useLocalStorage` from `@uidotdev/usehooks`:
  ```typescript
  // In SettingsPage / ChatPage — each hook auto-syncs with localStorage
  const [providers, setProviders] = useLocalStorage<ProvidersMap>("llm-providers", {});
  // e.g. { claude: { apiKey: "sk-...", model: "claude-sonnet-4-5-20250929" }, openai: { ... } }
  const [activeProvider, setActiveProvider] = useLocalStorage<string | null>("active-provider", null);
  const [ticktickToken, setTicktickToken] = useLocalStorage<string | null>("ticktick-token", null);
  ```
- `storage.ts` — just the TypeScript types (`ProvidersMap`, `ProviderConfig`) and any helper functions (e.g., `getConfiguredProviderNames(providers)`) — no manual `localStorage.getItem/setItem` needed

### Step 4: TickTick v2 API client
- `ticktick.ts` — implement:
  - `login(email, password)` → POST `/user/signon` → returns token
  - `getAllData(token)` → GET `/batch/check/0` → returns projects, tasks, etc.
  - `getProjectSections(token, projectId)` → GET `/column/project/{id}`
  - `updateTasks(token, tasks)` → POST `/batch/task`
  - `moveTasks(token, moves)` → POST `/batch/taskProject`
- All requests go through the Cloudflare Worker proxy
- Auth token sent as `Cookie: t=<token>` header (set by the proxy, not the browser)

### Step 5: LLM provider adapters
- Implement the `LLMProvider` interface for each provider:
  - `claude.ts` — Anthropic Messages API adapter
  - `openai.ts` — OpenAI Chat Completions adapter (also works for Grok with different base URL)
  - `gemini.ts` — Gemini generateContent adapter
- `index.ts` — factory function: `getProvider(name: string): LLMProvider`
- `tool-loop.ts` — provider-agnostic tool use loop
- `tools.ts` — canonical tool definitions (provider-independent) + execution logic

### Step 6: Chat UI
- `ChatPage.tsx` — the main chat view:
  - `<ProviderSwitcher>` dropdown in the header — switch active LLM provider on the fly (only shows providers with a saved API key)
  - Scrollable message list
  - User messages on right, LLM on left (standard chat layout)
  - Each assistant message shows a small badge with provider + model that generated it
  - Tool calls shown inline as collapsible cards (so user can see what the LLM did)
  - Markdown rendering for LLM responses
  - Input box with send button at bottom
  - Auto-scroll to latest message
- Chat history stored in `useReducer` (not persisted — fresh each session)

### Step 7: GitHub repo + Pages deployment
- Create GitHub repo `ticktick-assistant`
- Add `.github/workflows/deploy.yml` for automated deployment
- Push code, enable GitHub Pages (source: GitHub Actions)
- Verify deployment at `https://<username>.github.io/ticktick-assistant/`

## Cloudflare Worker Proxy (sketch)

```typescript
export default {
  async fetch(request: Request): Promise<Response> {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    let targetUrl: string;

    if (url.pathname.startsWith("/api/ticktick/")) {
      targetUrl = "https://api.ticktick.com/api/v2/" + url.pathname.slice("/api/ticktick/".length);
    } else if (url.pathname.startsWith("/api/llm/anthropic/")) {
      targetUrl = "https://api.anthropic.com/" + url.pathname.slice("/api/llm/anthropic/".length);
    } else if (url.pathname.startsWith("/api/llm/openai/")) {
      targetUrl = "https://api.openai.com/" + url.pathname.slice("/api/llm/openai/".length);
    } else if (url.pathname.startsWith("/api/llm/gemini/")) {
      targetUrl = "https://generativelanguage.googleapis.com/" + url.pathname.slice("/api/llm/gemini/".length) + url.search;
    } else if (url.pathname.startsWith("/api/llm/grok/")) {
      targetUrl = "https://api.x.ai/" + url.pathname.slice("/api/llm/grok/".length);
    } else {
      return new Response("Not found", { status: 404 });
    }

    // Forward the request, preserving headers and body
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    // Return response with CORS headers
    const newResponse = new Response(response.body, response);
    newResponse.headers.set("Access-Control-Allow-Origin", "*");
    newResponse.headers.set("Access-Control-Allow-Headers", "*");
    newResponse.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    return newResponse;
  }
};
```

## Default Models Per Provider

| Provider | Default Model | Other Options |
|----------|--------------|---------------|
| Claude | `claude-sonnet-4-5-20250929` | `claude-haiku-4-5-20251001`, `claude-opus-4-6` |
| OpenAI | `gpt-4.1` | `gpt-4.1-mini`, `o3`, `o4-mini` |
| Gemini | `gemini-2.5-flash` | `gemini-2.5-pro`, `gemini-2.5-flash-lite` |
| Grok | `grok-4-fast-non-reasoning` | `grok-4-1-fast-non-reasoning`, `grok-3` |

## TickTick v2 API Auth Details

```typescript
// Login — via proxy to avoid CORS and Cookie header issues
const response = await fetch(`${PROXY_URL}/api/ticktick/user/signon?wc=true&remember=true`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-device": JSON.stringify({
      platform: "web", os: "macOS", device: "Chrome",
      name: "", version: 4576, id: crypto.randomUUID().replace(/-/g, "").slice(0, 24),
      channel: "website", campaign: "", websocket: ""
    })
  },
  body: JSON.stringify({ username: email, password: password })
});
const data = await response.json();
// Store data.token in localStorage — proxy sets Cookie: t=<token> on subsequent requests
```

## TickTick v2 API — Key Endpoints Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/user/signon?wc=true&remember=true` | Login (returns token) |
| GET | `/batch/check/0` | Full sync — all projects, tasks, tags |
| GET | `/column/project/{projectId}` | List sections/columns for a project |
| POST | `/batch/task` | Create/Update/Delete tasks (batch) |
| POST | `/batch/taskProject` | Move tasks between projects |
| POST | `/batch/taskParent` | Set parent-child (subtask) relationships |
| POST | `/batch/project` | Create/Update/Delete projects |
| GET | `/project/all/completed?from=...&to=...` | Get completed tasks |

All endpoints proxied through Cloudflare Worker: `${PROXY_URL}/api/ticktick/...`

### Task Object Key Fields
- `id` — task ID (24-char alphanumeric)
- `projectId` — which project it belongs to
- `columnId` — which section/column it's in
- `title` — task title
- `content` — description/notes
- `status` — 0=open, 2=completed
- `priority` — 0=none, 1=low, 3=medium, 5=high
- `tags` — array of tag strings
- `parentId` — parent task ID (for subtasks)

### Required Headers for All v2 Requests (set by proxy)
```typescript
{
  "Content-Type": "application/json",
  "x-device": JSON.stringify({
    platform: "web", os: "macOS", device: "Chrome",
    name: "", version: 4576, id: "<24-char-hex>",
    channel: "website", campaign: "", websocket: ""
  }),
  "Cookie": "t=<auth-token>"  // Set by the proxy — browsers cannot set Cookie headers
}
```

## Security Notes

- TickTick email/password are used once to get a session token, then discarded — only the token is stored in localStorage
- LLM API keys are stored in localStorage (browser-local, never leaves device except to the proxy)
- The Cloudflare Worker proxy is stateless — it forwards requests and adds CORS headers, no logging or data storage
- All traffic is over HTTPS (GitHub Pages → Worker → API endpoints)
- The app and proxy are fully open-source and auditable
- Users should deploy their own Worker instance for maximum trust (instructions in README)

## Verification

1. Settings page: select a provider, enter API key, enter TickTick credentials
2. Click "Test Connection" for both TickTick and LLM
3. Chat: type "Show me all my projects" — should list TickTick projects
4. Chat: type "List tasks in [project name]" — should show tasks with sections
5. Chat: type "Rename task X to Y" — should update the task title in TickTick
6. Chat: type "Move task X to section Y" — should change the task's column
7. Chat: type "Complete task X" — should mark it done
8. Verify changes appear in the TickTick app
9. Switch to a different LLM provider and repeat — should work the same
