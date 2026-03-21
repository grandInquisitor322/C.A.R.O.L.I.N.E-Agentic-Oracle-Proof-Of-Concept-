import 'dotenv/config';
import express, { type Request, Response, NextFunction, Router } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import apiRouter from "./routes";
import fs from 'fs/promises';
import path from 'path';

export { createServer } from "http";

export const app = express();
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url} from ${req.headers.host || 'unknown'}`);
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/api', apiRouter);

console.log("Registered API routes:");
apiRouter.stack.forEach((layer: any) => {
  if (layer.route) {
    const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
    console.log(`  ${methods} ${layer.route.path}`);
  }
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
  });

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

let server: any;

// Start the server setup (add this async block back)
(async () => {
  // This line is crucial — it registers all the app.get routes from registerRoutes
  server = await registerRoutes(app);

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

   // Vite setup in development
  if (app.get("env") === "development") {
    const vite = await setupVite(app, server);   // ← add this line (assuming setupVite returns vite)

    // Catch-all handler for frontend routes (SPA / React app)
    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next(); // let API routes handle themselves
      }

      try {
        // Change this line to point to YOUR real index.html
        const indexPath = path.resolve(process.cwd(), 'client/index.html'); // ← adjust path as needed

        let template = await fs.readFile(indexPath, 'utf-8');
        const url = req.originalUrl;
        const transformed = await vite.transformIndexHtml(url, template);

        res.status(200).set('Content-Type', 'text/html').end(transformed);
      } catch (err) {
        console.error('Frontend serve error:', err);
        if (err instanceof Error) {
        vite?.ssrFixStacktrace?.(err);
      }
        res.status(500).end('Frontend loading error');
    }
  })
  } else {
    app.use(serveStatic);
  }
})
