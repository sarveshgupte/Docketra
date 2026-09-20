const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PUBLIC_ROUTES = [
  '/',
  '/features',
  '/pricing',
  '/solutions/company-secretaries',
  '/solutions/chartered-accountants',
  '/solutions/corporate-legal-teams',
  '/compare/docketra-vs-excel-whatsapp',
  '/about',
  '/contact',
  '/security',
  '/signup',
  '/terms',
  '/privacy',
  '/acceptable-use',
];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
};

async function prerender() {
  const isUiCwd = fs.existsSync(path.resolve('dist')) && fs.existsSync(path.resolve('vite.config.js'));
  const distDir = isUiCwd ? path.resolve('dist') : path.resolve('ui', 'dist');

  if (!fs.existsSync(distDir) || !fs.existsSync(path.join(distDir, 'index.html'))) {
    console.error(`[prerender] Error: dist directory or index.html not found at ${distDir}. Run build first.`);
    process.exit(1);
  }

  // Backup original template index.html for SPA fallback
  const originalIndexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');

  // Start lightweight static server
  const server = http.createServer((req, res) => {
    const rawPath = req.url.split('?')[0];
    const decodedPath = decodeURIComponent(rawPath);
    let filePath = path.join(distDir, decodedPath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // SPA fallback
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(originalIndexHtml);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[prerender] Local preview server listening on ${baseUrl}`);

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 PrerenderBot',
    });

    console.log(`[prerender] Prerendering ${PUBLIC_ROUTES.length} public marketing routes...`);
    const startTime = Date.now();

    for (const route of PUBLIC_ROUTES) {
      const page = await context.newPage();
      const targetUrl = `${baseUrl}${route}`;

      try {
        await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForSelector('#root > *', { timeout: 10000 });

        // Wait a brief moment for document.title & meta tags to flush
        await page.waitForTimeout(150);

        const renderedHtml = await page.content();

        // Determine destination file paths
        if (route === '/') {
          const destPath = path.join(distDir, 'index.html');
          fs.writeFileSync(destPath, renderedHtml, 'utf8');
          console.log(`  ✓ Prerendered ${route} -> index.html (${(renderedHtml.length / 1024).toFixed(1)} kB)`);
        } else {
          const routeSubdir = path.join(distDir, route.replace(/^\//, ''));
          fs.mkdirSync(routeSubdir, { recursive: true });

          const destIndexPath = path.join(routeSubdir, 'index.html');
          fs.writeFileSync(destIndexPath, renderedHtml, 'utf8');

          console.log(`  ✓ Prerendered ${route} -> ${route.replace(/^\//, '')}/index.html (${(renderedHtml.length / 1024).toFixed(1)} kB)`);
        }
      } catch (err) {
        console.error(`  ✗ Error prerendering ${route}:`, err.message);
        throw err;
      } finally {
        await page.close();
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[prerender] Completed prerendering all ${PUBLIC_ROUTES.length} routes in ${duration}s.`);
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

if (require.main === module) {
  prerender().catch((err) => {
    console.error('[prerender] Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { prerender, PUBLIC_ROUTES };
