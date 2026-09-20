const path = require('path');
const { chromium } = require('playwright');

async function generate() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 1200px;
      height: 630px;
      background: radial-gradient(circle at 80% 20%, #1e293b 0%, #0b0f19 70%, #05070c 100%);
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 64px 80px;
      position: relative;
      overflow: hidden;
    }
    .grid-pattern {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
      background-size: 40px 40px;
      pointer-events: none;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 18px;
      z-index: 2;
    }
    .logo-icon {
      width: 52px;
      height: 52px;
      color: #f59e0b;
    }
    .brand-text {
      display: flex;
      flex-direction: column;
    }
    .brand-name {
      font-size: 34px;
      font-weight: 900;
      letter-spacing: -0.03em;
      color: #ffffff;
      line-height: 1;
    }
    .brand-tag {
      font-size: 13px;
      font-weight: 800;
      color: #d97706;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      margin-top: 5px;
    }
    .main {
      z-index: 2;
      max-width: 1000px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.35);
      color: #fbbf24;
      padding: 6px 16px;
      border-radius: 9999px;
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 24px;
    }
    .badge-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #f59e0b;
    }
    .title {
      font-size: 54px;
      font-weight: 900;
      line-height: 1.12;
      letter-spacing: -0.03em;
      color: #f8fafc;
      margin-bottom: 18px;
    }
    .title span {
      color: #fbbf24;
    }
    .desc {
      font-size: 22px;
      color: #94a3b8;
      line-height: 1.45;
      font-weight: 400;
      max-width: 860px;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid rgba(255,255,255,0.1);
      padding-top: 24px;
      z-index: 2;
    }
    .pills {
      display: flex;
      gap: 12px;
    }
    .pill {
      background: rgba(30, 41, 59, 0.8);
      border: 1px solid rgba(255,255,255,0.1);
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #cbd5e1;
    }
    .domain {
      font-size: 18px;
      font-weight: 800;
      color: #f59e0b;
      letter-spacing: 0.05em;
    }
  </style>
</head>
<body>
  <div class="grid-pattern"></div>
  <div class="header">
    <svg class="logo-icon" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M25 15H50C69.33 15 85 30.67 85 50C85 69.33 69.33 85 50 85H25V15Z" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M40 30H50C61.05 30 70 38.95 70 50C70 61.05 61.05 70 50 70H40V30Z" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M50 44C53.31 44 56 46.69 56 50C56 53.31 53.31 56 50 56" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
    </svg>
    <div class="brand-text">
      <div class="brand-name">Docketra</div>
      <div class="brand-tag">The Company Brain</div>
    </div>
  </div>
  <div class="main">
    <div class="badge"><span class="badge-dot"></span> Built for Indian Professional Firms</div>
    <div class="title">Client Memory, Dockets &amp; <span>QC Review</span> in One Place</div>
    <div class="desc">The connected workspace for CS, CA, and legal teams to manage matters, statutory deadlines, team workbaskets, and Google Drive records.</div>
  </div>
  <div class="footer">
    <div class="pills">
      <span class="pill">Company Secretaries</span>
      <span class="pill">Chartered Accountants</span>
      <span class="pill">Corporate Legal Teams</span>
    </div>
    <div class="domain">docketra.in</div>
  </div>
</body>
</html>`;

  await page.setContent(html);
  const outPath = path.resolve('ui/public/og-image.png');
  await page.screenshot({ path: outPath, type: 'png' });
  console.log('Successfully generated og-image.png at ' + outPath);
  await browser.close();
}

generate().catch(err => {
  console.error('Error generating image:', err);
  process.exit(1);
});
