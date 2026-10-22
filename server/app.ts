import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { config, mailTransport } from './config.js';
import { db } from './db.js';
import { loadUser, requireAuth } from './auth.js';
import { addClient } from './events.js';
import { AVATAR_DIR, authRouter } from './routes/auth.js';
import { ticketsRouter } from './routes/tickets.js';
import { bookingRouter } from './routes/booking.js';
import { availabilityRouter } from './routes/availability.js';
import { adminRouter } from './routes/admin.js';
import { statsRouter } from './routes/stats.js';
import { notificationsRouter } from './routes/notifications.js';
import { supportRouter } from './routes/support.js';
import { errorHandler } from './util.js';
import { SERVICE_CONFIG } from './serviceConfig.js';

/** Membuat aplikasi Express tanpa `listen()` supaya bisa dipakai ulang (mis. pengujian). */
export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // Cloudflare Web Analytics menyisipkan beacon ini di domain produksi.
          scriptSrc: ["'self'", 'https://static.cloudflareinsights.com'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'", 'https://cloudflareinsights.com'],
          upgradeInsecureRequests: config.isProd ? [] : null,
        },
      },
    }),
  );
  const jsonBody = express.json({ limit: '200kb' });
  // Upload foto profil memakai parser sendiri dengan batas lebih besar.
  app.use((req, res, next) => (req.path === '/api/auth/avatar' ? next() : jsonBody(req, res, next)));
  app.use(cookieParser());
  app.use(loadUser);

  // SSE dipasang sebelum compression supaya event tidak tertahan buffer.
  app.get('/api/stream', requireAuth, (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 4000\n\n');
    const remove = addClient(req.user!.id, res);
    req.on('close', remove);
  });

  app.use(compression());

  app.use('/avatars', express.static(AVATAR_DIR, { maxAge: '30d', immutable: true, fallthrough: false }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, email: mailTransport ?? false }));
  app.get('/api/meta/config', (_req, res) => res.json(SERVICE_CONFIG));
  app.get('/api/meta/units', (_req, res) => {
    res.json({ units: db.prepare('SELECT id, name, code FROM units WHERE active = 1 ORDER BY name').all() });
  });
  app.use('/api/auth', authRouter);
  app.use('/api/tickets', ticketsRouter);
  app.use('/api/booking', bookingRouter);
  app.use('/api/availability', availabilityRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/support', supportRouter);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan.' }));

  const webDist = path.resolve('dist');
  if (fs.existsSync(webDist)) {
    app.use('/assets', express.static(path.join(webDist, 'assets'), { immutable: true, maxAge: '1y' }));
    app.use(express.static(webDist, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
  }

  app.use(errorHandler);

  return app;
}

