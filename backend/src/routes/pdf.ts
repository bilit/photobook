import { Router, Request, Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { generatePhotobook } from '../services/pdfGenerator';

const router = Router();

function requireAuth(req: Request, res: Response, next: () => void) {
  if (!req.isAuthenticated() || !req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  next();
}

/**
 * Download a Google Photos image to a local temp file using the Bearer token.
 * Returns the local file path on success, or null on failure.
 */
async function downloadPhoto(
  accessToken: string,
  baseUrl: string,
  destPath: string
): Promise<string | null> {
  try {
    const imageUrl = `${baseUrl}=w2000-h2000`;
    const response = await axios.get(imageUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    fs.writeFileSync(destPath, response.data);
    return destPath;
  } catch (err) {
    console.error(`Failed to download photo:`, err instanceof Error ? err.message : err);
    return null;
  }
}

router.post('/generate', requireAuth, async (req: Request, res: Response) => {
  let tempDir: string | null = null;

  try {
    const book = req.body;

    if (!book || !book.groups || !Array.isArray(book.groups)) {
      res.status(400).json({ error: 'Invalid book data' });
      return;
    }

    // Download Google Photos images locally so Puppeteer can render them
    // without needing auth or worrying about URL expiry.
    const googlePhotos: { photo: { id: string; url: string }; destPath: string }[] = [];

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'photobook-pdf-'));

    let fileIndex = 0;
    for (const group of book.groups) {
      for (const photo of group.photos) {
        if (photo.id && !photo.id.startsWith('local-') && photo.url) {
          const destPath = path.join(tempDir, `photo_${fileIndex++}.jpg`);
          googlePhotos.push({ photo, destPath });
        }
      }
    }

    if (googlePhotos.length > 0) {
      const accessToken = req.user!.accessToken;
      const results = await Promise.all(
        googlePhotos.map(({ photo, destPath }) =>
          downloadPhoto(accessToken, photo.url, destPath)
        )
      );

      // Update photo URLs to point to local files for successfully downloaded images
      for (let i = 0; i < googlePhotos.length; i++) {
        if (results[i]) {
          const { photo } = googlePhotos[i];
          photo.url = results[i]!;
          photo.id = `cached-${photo.id}`;
        }
      }
    }

    const pdfBuffer = await generatePhotobook(book);

    const title = (book.title || 'photobook').replace(/[^a-z0-9_-]/gi, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${title}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  } finally {
    // Clean up temp files
    if (tempDir) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch { /* ignore cleanup errors */ }
    }
  }
});

export default router;
