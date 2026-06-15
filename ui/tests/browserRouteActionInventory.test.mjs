import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chromium, devices } from 'playwright';

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const FIRM_SLUG = 'acme';
const OUTPUT_PATH = path.resolve(process.cwd(), 'test-results/route-action-inventory.json');

const routeTemplates = [
  '/superadmin','/superadmin/login','/app/superadmin','/app/superadmin/firms','/app/superadmin/onboarding-insights','/app/superadmin/diagnostics',
  '/:firmSlug/login','/:firmSlug/forgot-password','/app/firm/:firmSlug/dashboard','/app/firm/:firmSlug/worklist','/app/firm/:firmSlug/global-worklist','/app/firm/:firmSlug/qc-queue','/app/firm/:firmSlug/clients','/app/firm/:firmSlug/crm','/app/firm/:firmSlug/cms','/app/firm/:firmSlug/task-manager','/app/firm/:firmSlug/dockets/create','/app/firm/:firmSlug/settings','/app/firm/:firmSlug/storage-settings','/app/firm/:firmSlug/ai-settings','/app/firm/:firmSlug/admin','/app/firm/:firmSlug/admin/hierarchy','/app/firm/:firmSlug/admin/audit-logs','/app/firm/:firmSlug/admin/reports'
];

const roles = [
  { name: 'superadmin', profile: { role: 'SUPERADMIN', userType: 'superadmin', name: 'Root User', firmSlug: null, email: 'root@docketra.test' } },
  { name: 'primary_admin', profile: { role: 'PRIMARY_ADMIN', userType: 'firm', name: 'Primary Admin', firmSlug: FIRM_SLUG, email: 'admin@docketra.test' } },
  { name: 'user', profile: { role: 'USER', userType: 'firm', name: 'Standard User', firmSlug: FIRM_SLUG, email: 'user@docketra.test' } },
  { name: 'anonymous', profile: null }
];

const applySlug = (route) => route.replaceAll(':firmSlug', FIRM_SLUG);

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Vite server did not start within timeout.');
}

function startDevServer() {
  const child = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
    cwd: process.cwd(), stdio: 'pipe', env: { ...process.env, CI: '1' }
  });
  let startupLogs = '';
  child.stdout.on('data', (chunk) => { startupLogs += chunk.toString(); });
  child.stderr.on('data', (chunk) => { startupLogs += chunk.toString(); });
  child.on('exit', (code) => {
    if (code !== 0) {
      console.error(`[route-inventory] Vite exited early with code ${code}.`);
      if (startupLogs.trim()) console.error(startupLogs.trim());
    }
  });
  child.getStartupLogs = () => startupLogs;
  return child;
}

async function installApiMocks(page, role) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname.includes('/auth/profile')) {
      if (!role.profile) {
        return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Unauthenticated' }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: role.profile }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [], message: 'inventory-mock' }) });
  });
}

async function scanRoute(context, role, routeTemplate) {
  const page = await context.newPage();
  const routePath = applySlug(routeTemplate);
  const url = `${BASE_URL}${routePath}`;
  const consoleErrors = [];
  const unhandledRejections = [];

  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => unhandledRejections.push(err.message));

  await installApiMocks(page, role);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  const result = await page.evaluate(() => {
    const main = document.querySelector('main, [role="main"], #root > div');
    const text = document.body?.innerText || '';
    const duplicateShells = document.querySelectorAll('.platform-shell, [data-testid="platform-shell"]').length > 1;
    const title = document.title || null;
    const header = document.querySelector('h1,h2')?.textContent?.trim() || null;
    const actions = [];
    for (const el of document.querySelectorAll('button, a')) {
      const style = window.getComputedStyle(el);
      const visible = style.display !== 'none' && style.visibility !== 'hidden' && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
      if (!visible) continue;
      const label = (el.textContent || el.getAttribute('aria-label') || '').trim();
      const href = el.tagName === 'A' ? (el.getAttribute('href') || '') : null;
      const disabled = el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';
      const suspicious = [];
      if (el.tagName === 'BUTTON' && !disabled) {
        const t = el.getAttribute('type');
        if (!t) suspicious.push('missing_type');
      }
      if (el.tagName === 'A' && (href === '' || href === '#')) suspicious.push('placeholder_href');
      actions.push({ tag: el.tagName.toLowerCase(), label: label.slice(0, 120), href, disabled, suspicious });
    }
    return {
      title,
      header,
      mainRendered: Boolean(main && text.trim().length > 20),
      duplicateShells,
      accessDenied: /access denied|access restricted|forbidden|not authorized/i.test(text),
      notFound: /404|not found|page not found/i.test(text),
      blankRoot: (document.querySelector('#root')?.textContent || '').trim().length === 0,
      actionCount: actions.length,
      warningActions: actions.filter((a) => a.suspicious.length > 0)
    };
  });

  await page.close();
  return { routePath, role: role.name, ...result, consoleErrors, unhandledRejections };
}

(async function run() {
  const server = startDevServer();
  try {
    await waitForServer(BASE_URL).catch((error) => {
      const logs = server.getStartupLogs?.() || '';
      throw new Error(`${error.message}\n[route-inventory] Vite startup logs:\n${logs}`);
    });
    const browser = await chromium.launch();
    const inventory = { generatedAt: new Date().toISOString(), baseUrl: BASE_URL, findings: [], mobile: [] };

    for (const role of roles) {
      const context = await browser.newContext();
      for (const template of routeTemplates) {
        inventory.findings.push(await scanRoute(context, role, template));
      }
      await context.close();
    }

    const mobileContext = await browser.newContext({ ...devices['iPhone 13'] });
    for (const mobileRoute of ['/app/firm/:firmSlug/dashboard', '/app/superadmin']) {
      const page = await mobileContext.newPage();
      await installApiMocks(page, roles[1]);
      await page.goto(`${BASE_URL}${applySlug(mobileRoute)}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
      const mobileResult = await page.evaluate(() => ({
        route: location.pathname,
        hasMenuButton: !!document.querySelector('button[aria-label*="menu" i], button[title*="menu" i], [data-testid*="menu"]'),
        hasAccountAction: /logout|account|profile/i.test(document.body?.innerText || '')
      }));
      inventory.mobile.push(mobileResult);
      await page.close();
    }
    await mobileContext.close();
    await browser.close();

    const blocking = inventory.findings.filter((r) => r.blankRoot || r.consoleErrors.length > 0 || r.unhandledRejections.length > 0 || (!r.mainRendered && !r.accessDenied && !r.notFound));

    await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await fs.writeFile(OUTPUT_PATH, JSON.stringify(inventory, null, 2));
    console.log(`Route/action inventory written: ${OUTPUT_PATH}`);
    console.log(`Routes scanned: ${inventory.findings.length}`);
    console.log(`Blocking findings: ${blocking.length}`);

    if (blocking.length > 0) {
      console.error('Blocking route findings detected. See route-action-inventory.json');
      process.exit(1);
    }
  } finally {
    if (!server.killed) {
      server.kill('SIGTERM');
    }
    await Promise.race([
      once(server, 'exit'),
      new Promise((resolve) => setTimeout(resolve, 4000))
    ]);
  }
})();
