# CLAUDE.md

## Project Overview

TickTick Assistant — a React SPA that provides an AI chat interface for managing TickTick tasks. Users chat with an LLM that can call TickTick API tools (create/update/delete tasks, manage projects, etc.). Supports multiple LLM providers (Claude, OpenAI, Gemini, Grok).

## Tech Stack

- **Framework**: React 19 + TypeScript 5.9 + Vite 7
- **Styling**: Tailwind CSS 4 + shadcn/ui (new-york style, lucide icons)
- **Routing**: react-router-dom v7
- **Storage**: Dexie (IndexedDB) for conversation persistence
- **HTTP**: ky for API calls
- **Proxy**: Cloudflare Worker (`proxy/worker.ts`) for CORS + API routing

## Commands

- `npm run dev` — start dev server (localhost:5173)
- `npm run build` — type-check + build (`tsc -b && vite build`)
- `npm run lint` — ESLint
- `npm run preview` — preview production build

## Project Structure

```
src/
  App.tsx                    # Root layout: sidebar + routes
  main.tsx                   # Entry point, React Router setup
  pages/
    ChatPage.tsx             # Main chat interface
    SettingsPage.tsx          # API keys, provider config
  components/
    AppSidebar.tsx           # Conversation sidebar
    ChatMessage.tsx          # Message rendering (markdown)
    ChatInput.tsx            # Message input
    ToolCallCard.tsx         # Tool call display
    ConfirmationCard.tsx     # Destructive action confirmation
    ProviderSwitcher.tsx     # LLM provider selector
    ProviderCard.tsx         # Provider config card
    ThemeToggle.tsx          # Dark/light mode toggle
    ConversationList.tsx     # Sidebar conversation list
    ui/                      # shadcn/ui primitives
  lib/
    ticktick.ts              # TickTick API client (projects, tasks, OAuth)
    tools.ts                 # Tool definitions + executor (tool-calling interface)
    tool-loop.ts             # LLM agentic tool-calling loop (max 10 iterations)
    storage.ts               # Provider config types
    db.ts                    # Dexie database schema (conversations)
    utils.ts                 # cn() utility
    use-theme.ts             # Theme hook
    llm/
      base.ts                # LLMProvider interface
      types.ts               # ToolDefinition, ToolCall, Message types
      index.ts               # Provider registry
      claude.ts              # Anthropic Claude provider
      openai.ts              # OpenAI + Grok providers
      gemini.ts              # Google Gemini provider
  hooks/
    use-mobile.ts            # Mobile detection hook
proxy/
  worker.ts                  # Cloudflare Worker CORS proxy
  wrangler.toml              # Worker config
```

## Key Architecture

- **Tool loop**: `tool-loop.ts` sends messages to the LLM, which may return tool calls. The loop executes tools via `tools.ts` → `ticktick.ts`, feeds results back to the LLM, and repeats (up to 10 iterations) until the LLM responds with text only.
- **Provider abstraction**: Each LLM provider implements `LLMProvider` interface from `llm/base.ts`. Providers format requests/responses differently but share the same tool-calling loop.
- **Destructive actions**: Tools with `requiresConfirmation: true` (delete_project, delete_task) trigger a confirmation UI before execution.
- **Projects cache**: `tools.ts` caches project list for 30s to reduce API calls. `invalidateCache()` is called on mutations.
- **All TickTick API calls** go through the Cloudflare Worker proxy which handles CORS and routes to the appropriate upstream API.

## Conventions

- Path alias: `@/` → `./src/`
- shadcn/ui components live in `src/components/ui/` — use `npx shadcn@latest add <component>` to add new ones
- Deployed to GitHub Pages at `/ticktick-assistant/` base path
- Environment variables: `VITE_PROXY_URL` for the proxy URL (in `.env`)
- TickTick API priority values: 0=none, 1=low, 3=medium, 5=high
- Task status: 0=open, 2=completed
