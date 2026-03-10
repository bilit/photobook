import axios from 'axios';

const PICKER_API = 'https://photospicker.googleapis.com/v1';

export interface PickerSession {
  id: string;
  pickerUri: string;
  pollingConfig?: {
    pollInterval: string;
    timeoutIn: string;
  };
  mediaItemsSet?: boolean;
}

export interface PickerMediaItem {
  id: string;
  createTime: string;
  type: string;
  mediaFile: {
    baseUrl: string;
    mimeType: string;
    filename: string;
    mediaFileMetadata?: {
      width?: number;
      height?: number;
    };
  };
}

export async function createPickerSession(accessToken: string): Promise<PickerSession> {
  const response = await axios.post(
    `${PICKER_API}/sessions`,
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return response.data;
}

export async function getPickerSession(accessToken: string, sessionId: string): Promise<PickerSession> {
  const response = await axios.get(
    `${PICKER_API}/sessions/${sessionId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return response.data;
}

export async function listPickerMediaItems(
  accessToken: string,
  sessionId: string,
  pageToken?: string
): Promise<{ mediaItems: PickerMediaItem[]; nextPageToken?: string }> {
  const params: Record<string, string> = { sessionId, pageSize: '100' };
  if (pageToken) params.pageToken = pageToken;

  const response = await axios.get(`${PICKER_API}/mediaItems`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params,
  });

  return {
    mediaItems: response.data.mediaItems || [],
    nextPageToken: response.data.nextPageToken,
  };
}

export async function deletePickerSession(accessToken: string, sessionId: string): Promise<void> {
  await axios.delete(
    `${PICKER_API}/sessions/${sessionId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
}

export async function refreshMediaItemUrls(
  accessToken: string,
  mediaItemIds: string[]
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();

  await Promise.all(
    mediaItemIds.map(async (id) => {
      try {
        const response = await axios.get(`${PICKER_API}/mediaItems/${id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const item: PickerMediaItem = response.data;
        if (item.mediaFile?.baseUrl) {
          urlMap.set(id, item.mediaFile.baseUrl);
        }
      } catch (err) {
        console.error(`Failed to refresh URL for media item ${id}:`, err);
      }
    })
  );

  return urlMap;
}
