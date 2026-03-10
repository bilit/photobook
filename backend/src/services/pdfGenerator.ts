import puppeteer, { Browser } from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

interface PhotoItem {
  id: string;
  url: string;
  filename: string;
  width: number;
  height: number;
  priority: number;
}

interface PhotoGroup {
  id: string;
  name: string;
  template: 'focal' | 'grid';
  photos: PhotoItem[];
}

interface PhotoBook {
  title: string;
  groups: PhotoGroup[];
}

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

function loadTemplate(name: string): string {
  return fs.readFileSync(path.join(TEMPLATES_DIR, `${name}.html`), 'utf-8');
}

function loadBaseCSS(): string {
  return fs.readFileSync(path.join(TEMPLATES_DIR, 'base.css'), 'utf-8');
}

function buildPhotoSlots(photos: PhotoItem[]): string {
  return photos
    .map((photo, i) => {
      const imgUrl = `${photo.url}=w2000-h2000`;
      return `<div class="photo-slot photo-${i}"><img src="${imgUrl}" alt="${photo.filename}" /></div>`;
    })
    .join('\n    ');
}

function renderFocalTemplate(group: PhotoGroup, baseCSS: string): string {
  const sorted = [...group.photos].sort((a, b) => a.priority - b.priority);
  const template = loadTemplate('focal');
  const slots = buildPhotoSlots(sorted);
  const hasTitle = group.name && group.name.trim() !== '';

  return template
    .replace('{{BASE_CSS}}', baseCSS)
    .replace('{{COUNT}}', String(sorted.length))
    .replace('{{PHOTOS}}', slots)
    .replace('{{#if TITLE}}<div class="page-title">{{TITLE}}</div>{{/if}}',
      hasTitle ? `<div class="page-title">${group.name}</div>` : '');
}

function renderGridTemplate(group: PhotoGroup, baseCSS: string): string {
  const sorted = [...group.photos].sort((a, b) => a.priority - b.priority);
  const n = sorted.length;
  const cols = Math.ceil(Math.sqrt(n));

  const template = loadTemplate('grid');
  const slots = buildPhotoSlots(sorted);
  const hasTitle = group.name && group.name.trim() !== '';

  return template
    .replace('{{BASE_CSS}}', baseCSS)
    .replace('{{COLS}}', String(cols))
    .replace('{{PHOTOS}}', slots)
    .replace('{{#if TITLE}}<div class="page-title">{{TITLE}}</div>{{/if}}',
      hasTitle ? `<div class="page-title">${group.name}</div>` : '');
}

function renderGroup(group: PhotoGroup, baseCSS: string): string {
  if (group.template === 'grid') {
    return renderGridTemplate(group, baseCSS);
  }
  return renderFocalTemplate(group, baseCSS);
}

async function renderPageToPdf(html: string, browser: Browser): Promise<Buffer> {
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdf = await page.pdf({
      format: 'A4',
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
    ],
  };
  // Allow overriding the Chrome executable path via env (e.g. system Chromium)
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

    // Merge all page PDFs into one document
    const mergedDoc = await PDFDocument.create();

    for (const buffer of pageBuffers) {
      const srcDoc = await PDFDocument.load(buffer);
      const pages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
      pages.forEach((p) => mergedDoc.addPage(p));
    }

    const finalBytes = await mergedDoc.save();
    return Buffer.from(finalBytes);
  } finally {
    await browser.close();
  }
}
