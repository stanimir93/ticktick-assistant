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

// Headers that should NOT be forwarded to upstream APIs
const STRIP_HEADERS = new Set([
  'host',
  'origin',
  'referer',
  'cf-connecting-ip',
  'cf-ipcountry',
  'cf-ray',
  'cf-visitor',
  'cf-worker',
  'x-forwarded-for',
  'x-forwarded-proto',
  'x-real-ip',
]);

function cleanHeaders(request: Request): Headers {
  const cleaned = new Headers();
  for (const [key, value] of request.headers.entries()) {
    if (!STRIP_HEADERS.has(key.toLowerCase())) {
      cleaned.set(key, value);
    }
  }
  return cleaned;
}

const routes: Record<string, string> = {
  '/api/ticktick/': 'https://api.ticktick.com/open/v1/',
  '/api/ticktick-oauth/': 'https://ticktick.com/oauth/',
  '/api/ticktick-v2/': 'https://ticktick.com/api/v2/',
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
    const isV2 = url.pathname.startsWith('/api/ticktick-v2/');
    const isV2SignIn = url.pathname === '/api/ticktick-v2/user/signon';

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

    const headers = cleanHeaders(request);

    // For v2 requests: convert X-Ticktick-Session header to Cookie and add required headers
    if (isV2) {
      const session = headers.get('X-Ticktick-Session');
      if (session) {
        headers.set('Cookie', `t=${session}`);
        headers.delete('X-Ticktick-Session');
      }
      headers.set('Origin', 'https://ticktick.com');
      headers.set('X-Device', '{"platform":"web","os":"","device":"Firefox 135.0","name":"","version":6102,"id":"65c8eeb0e69de07d75096b23","channel":"website","campaign":"","websocket":"6802ffc1c23e8b3b795a8e89"}');
    }

    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.body,
    });

    // For v2 sign-in: extract session token from Set-Cookie and embed in response body
    if (isV2SignIn && response.ok) {
      const setCookie = response.headers.get('Set-Cookie') ?? '';
      const match = setCookie.match(/t=([^;]+)/);
      const sessionToken = match?.[1] ?? '';
      const body = await response.json() as Record<string, unknown>;
      body._sessionToken = sessionToken;
      const newResponse = new Response(JSON.stringify(body), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
      for (const [key, value] of Object.entries(corsHeaders)) {
        newResponse.headers.set(key, value);
      }
      return newResponse;
    }

    const newResponse = new Response(response.body, response);
    for (const [key, value] of Object.entries(corsHeaders)) {
      newResponse.headers.set(key, value);
    }
    return newResponse;
  },
};
