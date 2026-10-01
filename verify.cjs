const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ recordVideo: { dir: './videos' } });
  const page = await context.newPage();
  await page.goto('http://localhost:4173');
  await page.screenshot({ path: 'screenshot.png' });
  await browser.close();
})();
