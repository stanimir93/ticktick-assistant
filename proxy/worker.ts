// Allowed origins — add your GitHub Pages URL and localhost for dev
const ALLOWED_ORIGINS = new Set([
  'https://stanimir93.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
]);

interface Env {
  ALLOWED_ORIGINS?: string; // Optional: comma-separated extra origins
}

function getAllowedOrigins(env: Env): Set<string> {
  const origins = new Set(ALLOWED_ORIGINS);
  if (env.ALLOWED_ORIGINS) {
    for (const o of env.ALLOWED_ORIGINS.split(',')) {
      origins.add(o.trim());
    }
  }
  return origins;
}

function getCorsHeaders(origin: string | null, env: Env): Record<string, string> {
  const allowed = getAllowedOrigins(env);
  const effectiveOrigin = origin && allowed.has(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': effectiveOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };
}

const routes: Record<string, string> = {
  '/api/ticktick/': 'https://api.ticktick.com/api/v2/',
  '/api/llm/anthropic/': 'https://api.anthropic.com/',
  '/api/llm/openai/': 'https://api.openai.com/',
  '/api/llm/gemini/': 'https://generativelanguage.googleapis.com/',
  '/api/llm/grok/': 'https://api.x.ai/',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin, env);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Block requests from disallowed origins
    const allowed = getAllowedOrigins(env);
    if (origin && !allowed.has(origin)) {
      return new Response('Forbidden', { status: 403, headers: corsHeaders });
    }

    const url = new URL(request.url);

    let targetUrl: string | undefined;
    for (const [prefix, base] of Object.entries(routes)) {
      if (url.pathname.startsWith(prefix)) {
        targetUrl = base + url.pathname.slice(prefix.length) + url.search;
        break;
      }
    }

    if (!targetUrl) {
      return new Response('Not found', { status: 404, headers: corsHeaders });
    }

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    const newResponse = new Response(response.body, response);
    for (const [key, value] of Object.entries(corsHeaders)) {
      newResponse.headers.set(key, value);
    }
    return newResponse;
  },
};
