import { createServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import type { Express } from 'express';  // npm i -D @types/express if missing

export async function setupVite(app: Express, server: any, port: number = 3001) {
  const vite = await createServer({
    server: {
      middlewareMode: true,
      port,
    },
  });
  // Integrate with Express
  app.use(vite.middlewares);
  return vite;
}

export function serveStatic(req: IncomingMessage, res: ServerResponse, next: () => void) {
  // Basic static serving (use express.static in index.ts for full)
  if (req.url?.startsWith('/static')) {
    console.log('Serving static:', req.url);
    next();
  } else {
    next();
  }
}

export function log(message: string, level: 'info' | 'error' | 'warn' = 'info') {
  const timestamp = new Date().toISOString();
  console[level](`[${timestamp}] ${level.toUpperCase()}: ${message}`);
}