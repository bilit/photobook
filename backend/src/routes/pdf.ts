import { Router, Request, Response } from 'express';
import { generatePhotobook } from '../services/pdfGenerator';
import { refreshMediaItemUrls } from '../services/googlePhotos';

const router = Router();

function requireAuth(req: Request, res: Response, next: () => void) {
  if (!req.isAuthenticated() || !req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  next();
}

router.post('/generate', requireAuth, async (req: Request, res: Response) => {
  try {
    const book = req.body;

    if (!book || !book.groups || !Array.isArray(book.groups)) {
      res.status(400).json({ error: 'Invalid book data' });
      return;
    }

    // Collect Google Photos media item IDs (exclude local uploads prefixed with "local-")
    const allPhotoIds = book.groups
      .flatMap((g: { photos: { id: string }[] }) => g.photos.map((p: { id: string }) => p.id))
      .filter((id: string) => id && id.trim() !== '' && !id.startsWith('local-'));

    if (allPhotoIds.length > 0) {
      // Refresh photo URLs to avoid expiry
      const freshUrls = await refreshMediaItemUrls(req.user!.accessToken, allPhotoIds);

      // Update book with fresh URLs
      for (const group of book.groups) {
        for (const photo of group.photos) {
          const freshUrl = freshUrls.get(photo.id);
          if (freshUrl) {
            photo.url = freshUrl;
          }
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
  }
});

export default router;
