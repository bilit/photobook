import { Router, Request, Response } from 'express';
import { listAlbums, listMediaItems } from '../services/googlePhotos';

const router = Router();

function requireAuth(req: Request, res: Response, next: () => void) {
  if (!req.isAuthenticated() || !req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  next();
}

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const albums = await listAlbums(req.user!.accessToken);
    res.json({ albums });
  } catch (err) {
    console.error('Error fetching albums:', err);
    res.status(500).json({ error: 'Failed to fetch albums' });
  }
});

router.get('/:albumId/photos', requireAuth, async (req: Request, res: Response) => {
  try {
    const { albumId } = req.params;
    const pageToken = req.query.pageToken as string | undefined;
    const result = await listMediaItems(req.user!.accessToken, albumId, pageToken);
    res.json(result);
  } catch (err) {
    console.error('Error fetching photos:', err);
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

export default router;
