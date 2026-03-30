import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Setup __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

async function startServer() {
  const app = express();
  const port = 3000;

  // 1. JSON and body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  console.log('🚀 Starting Local Story Intervention System (Standalone Mode)...');

  // 2. Mock Vercel API routes
  const apiDir = path.resolve(__dirname, 'api');
  
  app.all('/api/:route', async (req, res) => {
    const { route } = req.params;
    const tsFile = path.join(apiDir, `${route}.ts`);
    const jsFile = path.join(apiDir, `${route}.js`);
    
    const targetFile = fs.existsSync(tsFile) ? tsFile : (fs.existsSync(jsFile) ? jsFile : null);

    if (!targetFile) {
      console.error(`❌ API Route not found: /api/${route}`);
      return res.status(404).json({ error: 'Route not found' });
    }

    try {
      // Use tsx to dynamically import TS files if needed, 
      // but for this standalone script, we assume node can handle it or we use a loader
      // For simplicity in this environment, we'll try to import directly 
      // (The user already has tsx in devDependencies)
      
      const { default: handler } = await import(`file://${targetFile}?t=${Date.now()}`);
      
      if (typeof handler === 'function') {
        // Vercel style handler(req, res)
        await handler(req, res);
      } else {
        res.status(500).json({ error: 'Handler is not a function' });
      }
    } catch (err) {
      console.error(`💥 Error in /api/${route}:`, err);
      res.status(500).json({ 
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined 
      });
    }
  });

  // 3. Create Vite server in middleware mode
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  // Use vite's connect instance as middleware
  app.use(vite.middlewares);

  app.listen(port, () => {
    console.log(`\n✨ Successfully running at: http://localhost:${port}`);
    console.log(`💻 Local API and Frontend are synchronized.`);
    console.log(`🚫 NO Vercel Link required.`);
    console.log(`\nPress Ctrl+C to stop.\n`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
