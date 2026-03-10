import axios from 'axios';
import { Router, Request, Response } from 'express';
import {
  createPickerSession,
  getPickerSession,
  listPickerMediaItems,
  deletePickerSession,
} from '../services/googlePhotos';

const router = Router();

function requireAuth(req: Request, res: Response, next: () => void) {
  if (!req.isAuthenticated() || !req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  next();
}

// Create a new picker session
router.post('/sessions', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = await createPickerSession(req.user!.accessToken);
    res.json({ sessionId: session.id, pickerUri: session.pickerUri });
  } catch (err) {
    console.error('Error creating picker session:', err);
    res.status(500).json({ error: 'Failed to create picker session' });
  }
});

// Get picker session status (poll until mediaItemsSet: true)
router.get('/sessions/:sessionId', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = await getPickerSession(req.user!.accessToken, req.params.sessionId);
    res.json({ mediaItemsSet: session.mediaItemsSet || false });
  } catch (err) {
    console.error('Error getting picker session:', err);
    res.status(500).json({ error: 'Failed to get picker session' });
  }
});

// List selected media items for a session
router.get('/sessions/:sessionId/items', requireAuth, async (req: Request, res: Response) => {
  try {
    const pageToken = req.query.pageToken as string | undefined;
    const result = await listPickerMediaItems(
      req.user!.accessToken,
      req.params.sessionId,
      pageToken
    );
    res.json(result);
  } catch (err) {
    console.error('Error listing picker media items:', err);
    res.status(500).json({ error: 'Failed to list media items' });
  }
});

// Delete a picker session
router.delete('/sessions/:sessionId', requireAuth, async (req: Request, res: Response) => {
  try {
    await deletePickerSession(req.user!.accessToken, req.params.sessionId);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting picker session:', err);
    res.status(500).json({ error: 'Failed to delete picker session' });
  }
});

// Proxy a Google Photos image so the browser doesn't need to send Bearer auth
router.get('/thumbnail', requireAuth, async (req: Request, res: Response) => {
  const baseUrl = req.query.url as string;
  const size = (req.query.size as string) || '300';

  if (!baseUrl || !baseUrl.startsWith('https://')) {
    res.status(400).json({ error: 'Invalid url parameter' });
    return;
  }

  try {
    const imageUrl = `${baseUrl}=w${size}-h${size}`;
    const upstream = await axios.get(imageUrl, {
      headers: { Authorization: `Bearer ${req.user!.accessToken}` },
      responseType: 'stream',
    });

    res.setHeader('Content-Type', upstream.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    upstream.data.pipe(res);
  } catch (err) {
    console.error('Error proxying thumbnail:', err);
    res.status(502).json({ error: 'Failed to fetch image' });
  }
});

export default router;
