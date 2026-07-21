import type { HttpHandler } from 'msw';

export const handlers: HttpHandler[] = [];

// Example shape for a future handler:
// http.get('/api/example', () => HttpResponse.json({ ok: true }))