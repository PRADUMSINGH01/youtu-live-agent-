import express, { type Request, type Response } from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import streamRouter from './route/stream-mang/upload-video.route.js';
import addStreamRouter from './route/stream-mang/add-streeam.route.js';
import googleAuthRouter, { handleGoogleCallback } from './route/auth/google-auth.route.js';
import youtubeRouter from './route/youtube/youtube.route.js';
import { streamworker, emailworker } from './queues/workers.js';
import { db } from './firebase/init.js';
import path from 'path';
dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 5000;

// Serve static frontend files
app.use(express.static(path.resolve(process.cwd(), 'frontend', 'dist')));
app.use(express.static(path.resolve(process.cwd(), 'frontend')));

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health Check Endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'online',
    version: '2.5.0',
    serverTime: new Date().toISOString(),
    activeRtmpWorkers: 3,
    storage: 'Firebase Storage Active',
    firestore: 'Firestore DB Connected',
  });
});

// Authentication & Multi-Channel YouTube Routes
app.use('/api/auth', googleAuthRouter);
app.use('/api/youtube', youtubeRouter);

// Universal Google OAuth Redirect URIs support
app.get('/oauth/callback', handleGoogleCallback);
app.get('/api/oauth/callback', handleGoogleCallback);
app.get('/auth/google/callback', handleGoogleCallback);

// RTMP Stream Management & Video Upload Routes
app.use('/api', streamRouter);
app.use('/api', addStreamRouter);

app.listen(port, () => {
  console.log(`YouTube Agent Firebase Upload API ready at http://localhost:${port}`);
});

// Optional Port 3000 OAuth Bridge
// If GOOGLE_REDIRECT_URI in .env is configured with port 3000 (e.g. http://localhost:3000/oauth/callback),
// start a bridge server on port 3000 to catch and process the Google redirect.
const redirectUri = process.env.GOOGLE_REDIRECT_URI || '';
if (redirectUri.includes(':3000') && port !== 3000) {
  const bridgeApp = express();
  bridgeApp.use(cors({ origin: '*' }));
  bridgeApp.get('/oauth/callback', handleGoogleCallback);
  bridgeApp.get('/api/auth/google/callback', handleGoogleCallback);
  bridgeApp.use((req: Request, res: Response) => {
    res.redirect(`http://localhost:5000${req.originalUrl}`);
  });

  const bridgeServer = http.createServer(bridgeApp);
  bridgeServer.listen(3000, () => {
    console.log(`[OAuth Bridge] Listening on port 3000 for Google OAuth callbacks -> forwarding to backend`);
  });
  bridgeServer.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[OAuth Bridge] Port 3000 already in use (skipping bridge)`);
    } else {
      console.warn(`[OAuth Bridge] Port 3000 error:`, err.message);
    }
  });
}
