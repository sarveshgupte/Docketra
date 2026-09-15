const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const publicDir = path.resolve('ui/public');

const SVG_CONTENT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <rect width="100" height="100" rx="22" fill="#0f172a"/>
  <path d="M26 18H50C68 18 82 32 82 50C82 68 68 82 50 82H26V18Z" stroke="#f59e0b" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M40 32H50C60 32 68 40 68 50C68 60 60 68 50 68H40V32Z" stroke="#fbbf24" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M50 44C53.31 44 56 46.69 56 50C56 53.31 53.31 56 50 56" stroke="#fef3c7" stroke-width="4" stroke-linecap="round"/>
</svg>
`;

function createIcoBuffer(pngBuffers) {
  const numImages = pngBuffers.length;
  const headerSize = 6;
  const entrySize = 16;
  const totalHeaderSize = headerSize + entrySize * numImages;

  let offset = totalHeaderSize;
  const entries = [];

  for (const { buffer, size } of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // color count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(buffer.length, 8); // size
    entry.writeUInt32LE(offset, 12); // offset
    entries.push(entry);
    offset += buffer.length;
  }

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = ICO
  header.writeUInt16LE(numImages, 4); // count

  return Buffer.concat([header, ...entries, ...pngBuffers.map((p) => p.buffer)]);
}

async function generate() {
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 1. Write favicon.svg
  const svgPath = path.join(publicDir, 'favicon.svg');
  fs.writeFileSync(svgPath, SVG_CONTENT.trim() + '\n', 'utf8');
  console.log('✓ Written ui/public/favicon.svg');

  // 2. Launch headless browser
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const dataUri = `data:image/svg+xml;base64,${Buffer.from(SVG_CONTENT).toString('base64')}`;

  const SIZES = [
    { name: 'favicon-16x16.png', size: 16 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'favicon-48x48.png', size: 48 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'android-chrome-192x192.png', size: 192 },
    { name: 'android-chrome-512x512.png', size: 512 },
  ];

  const icoSources = [];

  for (const { name, size } of SIZES) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<!DOCTYPE html>
<html>
  <head>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { width: ${size}px; height: ${size}px; overflow: hidden; background: transparent; }
      img { width: 100%; height: 100%; display: block; }
    </style>
  </head>
  <body>
    <img src="${dataUri}" />
  </body>
</html>`);

    const pngBuffer = await page.screenshot({
      type: 'png',
      omitBackground: true,
    });

    const targetPath = path.join(publicDir, name);
    fs.writeFileSync(targetPath, pngBuffer);
    console.log(`✓ Written ui/public/${name} (${size}x${size})`);

    if ([16, 32, 48].includes(size)) {
      icoSources.push({ buffer: pngBuffer, size });
    }
  }

  await browser.close();

  // 3. Write favicon.ico
  const icoBuffer = createIcoBuffer(icoSources);
  const icoPath = path.join(publicDir, 'favicon.ico');
  fs.writeFileSync(icoPath, icoBuffer);
  console.log(`✓ Written ui/public/favicon.ico (${icoBuffer.length} bytes)`);

  console.log('\nAll favicons generated successfully!');
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
