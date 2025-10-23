
  import { defineConfig } from 'vite';
  import react from '@vitejs/plugin-react-swc';
  import path from 'path';
  import { promises as fsp } from 'fs';

  export default defineConfig({
    plugins: [
      react(),
      {
        name: 'dev-upload-middleware',
        configureServer(server) {
          // Minimal dev-only upload endpoint: POST /api/upload?filename=...&id=...
          server.middlewares.use(async (req, res, next) => {
            try {
              if (!req.url) return next();
              const url = new URL(req.url, 'http://localhost');
              if (url.pathname !== '/api/upload') return next();

              const uploadsDir = path.resolve(process.cwd(), 'uploads');
              await fsp.mkdir(uploadsDir, { recursive: true });

              // Handle DELETE: best-effort mirror of server cleanup
              if (req.method === 'DELETE') {
                const id = (url.searchParams.get('id') || '').toString();
                const byPath = (url.searchParams.get('path') || url.searchParams.get('file') || url.searchParams.get('filename') || url.searchParams.get('name') || '').toString();
                async function walk(dir) {
                  const out = [] as string[];
                  try {
                    const ents = await fsp.readdir(dir, { withFileTypes: true });
                    for (const ent of ents) {
                      const p = path.join(dir, ent.name);
                      if (ent.isDirectory()) out.push(...await walk(p));
                      else if (ent.isFile()) out.push(p);
                    }
                  } catch {}
                  return out;
                }
                let deleted = 0;
                if (id) {
                  const all = await walk(uploadsDir);
                  for (const abs of all) {
                    if (path.basename(abs).startsWith(`${id}-`)) {
                      try { await fsp.unlink(abs); deleted += 1; } catch {}
                    }
                  }
                }
                if (!id && byPath) {
                  let rel = byPath.replace(/^[A-Za-z]:/i, '').replace(/^\\+|^\/+/, '');
                  rel = rel.replace(/^uploads[\\/]/i, '');
                  const idx = byPath.toLowerCase().indexOf('/uploads/');
                  if (idx >= 0) rel = byPath.slice(idx + '/uploads/'.length);
                  rel = rel.replace(/\\/g, '/');
                  const abs = path.resolve(uploadsDir, rel);
                  if (abs.startsWith(uploadsDir)) { try { await fsp.unlink(abs); deleted += 1; } catch {} }
                }
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: true, deleted }));
                return;
              }

              if (req.method !== 'POST') {
                res.statusCode = 405;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
                return;
              }

              const originalName = (url.searchParams.get('filename') || 'upload.pdf').toString();
              const id = (url.searchParams.get('id') || '').toString();
              const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
              const baseName = (id ? `${id}-` : '') + safeName;
              const filePath = path.join(uploadsDir, baseName);

              const chunks: Buffer[] = [];
              req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
              req.on('end', async () => {
                try {
                  await fsp.writeFile(filePath, Buffer.concat(chunks));
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ ok: true, path: `/uploads/${baseName}` }));
                } catch (err) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ ok: false, error: String(err) }));
                }
              });
              req.on('error', (err) => {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: false, error: String(err) }));
              });
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: false, error: String(err) }));
            }
          });
        },
      },
    ],
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
      alias: {
        'vaul@1.1.2': 'vaul',
        'sonner@2.0.3': 'sonner',
        'recharts@2.15.2': 'recharts',
        'react-resizable-panels@2.1.7': 'react-resizable-panels',
        'react-hook-form@7.55.0': 'react-hook-form',
        'react-day-picker@8.10.1': 'react-day-picker',
        'next-themes@0.4.6': 'next-themes',
        'lucide-react@0.487.0': 'lucide-react',
        'input-otp@1.4.2': 'input-otp',
        'embla-carousel-react@8.6.0': 'embla-carousel-react',
        'cmdk@1.1.1': 'cmdk',
        'class-variance-authority@0.7.1': 'class-variance-authority',
        '@radix-ui/react-tooltip@1.1.8': '@radix-ui/react-tooltip',
        '@radix-ui/react-toggle@1.1.2': '@radix-ui/react-toggle',
        '@radix-ui/react-toggle-group@1.1.2': '@radix-ui/react-toggle-group',
        '@radix-ui/react-tabs@1.1.3': '@radix-ui/react-tabs',
        '@radix-ui/react-switch@1.1.3': '@radix-ui/react-switch',
        '@radix-ui/react-slot@1.1.2': '@radix-ui/react-slot',
        '@radix-ui/react-slider@1.2.3': '@radix-ui/react-slider',
        '@radix-ui/react-separator@1.1.2': '@radix-ui/react-separator',
        '@radix-ui/react-select@2.1.6': '@radix-ui/react-select',
        '@radix-ui/react-scroll-area@1.2.3': '@radix-ui/react-scroll-area',
        '@radix-ui/react-radio-group@1.2.3': '@radix-ui/react-radio-group',
        '@radix-ui/react-progress@1.1.2': '@radix-ui/react-progress',
        '@radix-ui/react-popover@1.1.6': '@radix-ui/react-popover',
        '@radix-ui/react-navigation-menu@1.2.5': '@radix-ui/react-navigation-menu',
        '@radix-ui/react-menubar@1.1.6': '@radix-ui/react-menubar',
        '@radix-ui/react-label@2.1.2': '@radix-ui/react-label',
        '@radix-ui/react-hover-card@1.1.6': '@radix-ui/react-hover-card',
        '@radix-ui/react-dropdown-menu@2.1.6': '@radix-ui/react-dropdown-menu',
        '@radix-ui/react-dialog@1.1.6': '@radix-ui/react-dialog',
        '@radix-ui/react-context-menu@2.2.6': '@radix-ui/react-context-menu',
        '@radix-ui/react-collapsible@1.1.3': '@radix-ui/react-collapsible',
        '@radix-ui/react-checkbox@1.1.4': '@radix-ui/react-checkbox',
        '@radix-ui/react-avatar@1.1.3': '@radix-ui/react-avatar',
        '@radix-ui/react-aspect-ratio@1.1.2': '@radix-ui/react-aspect-ratio',
        '@radix-ui/react-alert-dialog@1.1.6': '@radix-ui/react-alert-dialog',
        '@radix-ui/react-accordion@1.2.3': '@radix-ui/react-accordion',
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      target: 'esnext',
      outDir: 'build',
    },
    server: {
      port: 3000,
      open: true,
    },
  });
