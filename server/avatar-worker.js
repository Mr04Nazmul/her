// Deploy separately from GitHub Pages. The provider key never reaches the browser.
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim());
    if (!origin || !allowed.includes(origin)) return new Response('Forbidden', { status: 403 });
    const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin', 'Cache-Control': 'no-store' };
    const json = (body, status = 200) => Response.json(body, { status, headers });
    if (new URL(request.url).pathname !== '/session') return json({ error: 'Not found' }, 404);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    if (!env.SIMLI_API_KEY || !env.SIMLI_FACE_ID || !env.SESSION_LIMITER) return json({ error: 'Avatar service not configured' }, 503);
    const { success } = await env.SESSION_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') || 'unknown' });
    if (!success) return json({ error: 'Please wait before starting another video call' }, 429);
    try {
      const response = await fetch('https://api.simli.ai/compose/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-simli-api-key': env.SIMLI_API_KEY },
        body: JSON.stringify({ faceId: env.SIMLI_FACE_ID, handleSilence: true, maxSessionLength: 600, maxIdleTime: 60, audioInputFormat: 'pcm16' }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) return json({ error: 'Avatar provider unavailable' }, 502);
      const result = await response.json();
      if (!result.session_token) return json({ error: 'Invalid provider session' }, 502);
      return json({ session_token: result.session_token });
    } catch { return json({ error: 'Avatar provider unavailable' }, 502); }
  },
};
