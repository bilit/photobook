import puppeteer, { Browser } from 'puppeteer-core';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

interface TemplateZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  priority: number;
}

interface PhotoItem {
  id: string;
  url: string;
  filename: string;
  width: number;
  height: number;
  priority: number;
  cropX?: number; // 0-100, default 50
  cropY?: number; // 0-100, default 50
}

interface PhotoGroup {
  id: string;
  name: string;
  template: string; // 'focal' | 'grid' | custom template id
  templateZones?: TemplateZone[];
  fillPage?: boolean;
  photos: PhotoItem[];
}

interface PhotoBook {
  title: string;
  groups: PhotoGroup[];
}

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

// Scale the used zones (those with photos) to fill the full page area
function fillPageZones(zones: TemplateZone[], photoCount: number): TemplateZone[] {
  const used = zones.slice(0, photoCount);
  if (used.length === 0) return zones;
  const minX = Math.min(...used.map((z) => z.x));
  const minY = Math.min(...used.map((z) => z.y));
  const maxX = Math.max(...used.map((z) => z.x + z.width));
  const maxY = Math.max(...used.map((z) => z.y + z.height));
  const rangeX = maxX - minX;
  const rangeY = maxY - minY;
  if (rangeX === 0 || rangeY === 0) return used;
  return used.map((z) => ({
    ...z,
    x: ((z.x - minX) / rangeX) * 100,
    y: ((z.y - minY) / rangeY) * 100,
    width: (z.width / rangeX) * 100,
    height: (z.height / rangeY) * 100,
  }));
}

function loadTemplate(name: string): string {
  return fs.readFileSync(path.join(TEMPLATES_DIR, `${name}.html`), 'utf-8');
}

function loadBaseCSS(): string {
  return fs.readFileSync(path.join(TEMPLATES_DIR, 'base.css'), 'utf-8');
}

function buildPhotoSlots(photos: PhotoItem[]): string {
  return photos
    .map((photo, i) => {
      const imgUrl = photo.id.startsWith('local-')
        ? photo.url
        : photo.id.startsWith('cached-')
          ? `file://${photo.url}`
          : `${photo.url}=w2000-h2000`;
      const cropX = photo.cropX ?? 50;
      const cropY = photo.cropY ?? 50;
      return `<div class="photo-slot photo-${i}"><img src="${imgUrl}" alt="${photo.filename}" style="object-position:${cropX}% ${cropY}%" /></div>`;
    })
    .join('\n    ');
}

function renderFocalTemplate(group: PhotoGroup, baseCSS: string): string {
  const sorted = [...group.photos].sort((a, b) => a.priority - b.priority);
  const n = sorted.length;
  const template = loadTemplate('focal');
  const slots = buildPhotoSlots(sorted);
  const hasTitle = group.name && group.name.trim() !== '';
  const fillCSS = group.fillPage
    ? `.page { padding: 0; gap: 0; }
.layout { gap: 0; }
.photo-slot { border-radius: 0; }`
    : '';

  return template
    .replace('{{BASE_CSS}}', baseCSS + '\n' + fillCSS)
    .replace('{{COUNT}}', String(n))
    .replace('{{PHOTOS}}', slots)
    .replace(
      '{{#if TITLE}}<div class="page-title">{{TITLE}}</div>{{/if}}',
      hasTitle ? `<div class="page-title">${group.name}</div>` : ''
    );
}

function renderGridTemplate(group: PhotoGroup, baseCSS: string): string {
  const sorted = [...group.photos].sort((a, b) => a.priority - b.priority);
  const n = sorted.length;
  const cols = Math.ceil(Math.sqrt(n));
  const template = loadTemplate('grid');
  const slots = buildPhotoSlots(sorted);
  const hasTitle = group.name && group.name.trim() !== '';
  const fillCSS = group.fillPage
    ? `.page { padding: 0; gap: 0; }
.layout { gap: 0; }
.photo-slot { border-radius: 0; }`
    : '';

  return template
    .replace('{{BASE_CSS}}', baseCSS + '\n' + fillCSS)
    .replace('{{COLS}}', String(cols))
    .replace('{{PHOTOS}}', slots)
    .replace(
      '{{#if TITLE}}<div class="page-title">{{TITLE}}</div>{{/if}}',
      hasTitle ? `<div class="page-title">${group.name}</div>` : ''
    );
}

function renderCustomTemplate(group: PhotoGroup, baseCSS: string): string {
  const rawZones = [...(group.templateZones || [])].sort((a, b) => a.priority - b.priority);
  const sorted = [...group.photos].sort((a, b) => a.priority - b.priority);
  const zones = group.fillPage && sorted.length < rawZones.length
    ? fillPageZones(rawZones, sorted.length)
    : rawZones;
  const hasTitle = group.name && group.name.trim() !== '';

  // Build absolute-positioned zone CSS
  const zoneCSS = zones
    .map(
      (zone, i) => `.zone-${i} {
      position: absolute;
      left: ${zone.x}%;
      top: ${zone.y}%;
      width: ${zone.width}%;
      height: ${zone.height}%;
      overflow: hidden;
      border-radius: 2mm;
      background: #f0f0f0;
    }`
    )
    .join('\n');

  // Map photos to zones
  const photoSlots = zones
    .map((_, i) => {
      const photo = sorted[i];
      if (!photo) return `<div class="zone-${i}"></div>`;
      const imgUrl = photo.id.startsWith('local-')
        ? photo.url
        : photo.id.startsWith('cached-')
          ? `file://${photo.url}`
          : `${photo.url}=w2000-h2000`;
      const cropX = photo.cropX ?? 50;
      const cropY = photo.cropY ?? 50;
      return `<div class="zone-${i}"><img src="${imgUrl}" alt="${photo.filename}" style="width:100%;height:100%;object-fit:cover;object-position:${cropX}% ${cropY}%;" /></div>`;
    })
    .join('\n    ');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
${baseCSS}

.layout {
  flex: 1;
  position: relative;
  min-height: 0;
}

${zoneCSS}
</style>
</head>
<body>
<div class="page">
  ${hasTitle ? `<div class="page-title">${group.name}</div>` : ''}
  <div class="layout">
    ${photoSlots}
  </div>
</div>
</body>
</html>`;
}

function renderGroup(group: PhotoGroup, baseCSS: string): string {
  if (group.template === 'grid') return renderGridTemplate(group, baseCSS);
  if (group.template === 'focal') return renderFocalTemplate(group, baseCSS);
  // Custom template (has zones)
  if (group.templateZones && group.templateZones.length > 0) {
    return renderCustomTemplate(group, baseCSS);
  }
  // Fallback to focal
  return renderFocalTemplate(group, baseCSS);
}

async function renderPageToPdf(html: string, browser: Browser): Promise<Buffer> {
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdf = await page.pdf({
      width: '11in',
      height: '8.5in',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

export async function generatePhotobook(book: PhotoBook): Promise<Buffer> {
  const baseCSS = loadBaseCSS();

  const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--allow-file-access-from-files',
    ],
  };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const browser = await puppeteer.launch(launchOptions);

  try {
    const pageBuffers: Buffer[] = [];

    for (const group of book.groups) {
      if (group.photos.length === 0) continue;
      const html = renderGroup(group, baseCSS);
      const pdfBuffer = await renderPageToPdf(html, browser);
      pageBuffers.push(pdfBuffer);
    }

    if (pageBuffers.length === 0) {
      throw new Error('No pages to generate');
    }

    const mergedDoc = await PDFDocument.create();

    for (const buffer of pageBuffers) {
      const srcDoc = await PDFDocument.load(buffer);
      const pages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
      pages.forEach((p: import('pdf-lib').PDFPage) => mergedDoc.addPage(p));
    }

    const finalBytes = await mergedDoc.save();
    return Buffer.from(finalBytes);
  } finally {
    await browser.close();
  }
}
