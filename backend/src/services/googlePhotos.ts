import axios from 'axios';

const PHOTOS_API = 'https://photoslibrary.googleapis.com/v1';

export interface Album {
  id: string;
  title: string;
  mediaItemsCount: string;
  coverPhotoBaseUrl: string;
  coverPhotoMediaItemId: string;
}

export interface MediaItem {
  id: string;
  filename: string;
  baseUrl: string;
  mimeType: string;
  mediaMetadata: {
    width: string;
    height: string;
    creationTime: string;
  };
}

export async function listAlbums(accessToken: string): Promise<Album[]> {
  const albums: Album[] = [];
  let pageToken: string | undefined;

  do {
    const params: Record<string, string> = { pageSize: '50' };
    if (pageToken) params.pageToken = pageToken;

    const response = await axios.get(`${PHOTOS_API}/albums`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params,
    });

    const data = response.data;
    if (data.albums) {
      albums.push(...data.albums);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return albums;
}

export async function listMediaItems(
  accessToken: string,
  albumId: string,
  pageTokenParam?: string
): Promise<{ items: MediaItem[]; nextPageToken?: string }> {
  const response = await axios.post(
    `${PHOTOS_API}/mediaItems:search`,
    { albumId, pageSize: 100, pageToken: pageTokenParam },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  return {
    items: response.data.mediaItems || [],
    nextPageToken: response.data.nextPageToken,
  };
}

export async function getMediaItem(accessToken: string, mediaItemId: string): Promise<MediaItem> {
  const response = await axios.get(`${PHOTOS_API}/mediaItems/${mediaItemId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data;
}

export async function refreshMediaItemUrls(
  accessToken: string,
  mediaItemIds: string[]
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();

  await Promise.all(
    mediaItemIds.map(async (id) => {
      try {
        const item = await getMediaItem(accessToken, id);
        urlMap.set(id, item.baseUrl);
      } catch {
        // Keep old URL if refresh fails
      }
    })
  );

  return urlMap;
}
