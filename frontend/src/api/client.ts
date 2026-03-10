import axios from 'axios';
import type { PhotoItem, AuthStatus } from '../types';

const api = axios.create({
  baseURL: '/',
  withCredentials: true,
});

export async function getAuthStatus(): Promise<AuthStatus> {
  const { data } = await api.get('/auth/status');
  return data;
}

export async function logout(): Promise<void> {
  await api.get('/auth/logout');
}

export async function createPickerSession(): Promise<{ sessionId: string; pickerUri: string }> {
  const { data } = await api.post('/api/picker/sessions');
  return data;
}

export async function getPickerSession(sessionId: string): Promise<{ mediaItemsSet: boolean }> {
  const { data } = await api.get(`/api/picker/sessions/${sessionId}`);
  return data;
}

export async function getPickerItems(
  sessionId: string,
  pageToken?: string
): Promise<{ items: PhotoItem[]; nextPageToken?: string }> {
  const params: Record<string, string> = {};
  if (pageToken) params.pageToken = pageToken;
  const { data } = await api.get(`/api/picker/sessions/${sessionId}/items`, { params });

  const items: PhotoItem[] = (data.mediaItems || []).map((item: {
    id: string;
    mediaFile: {
      baseUrl: string;
      filename: string;
      mediaFileMetadata?: { width?: number; height?: number };
    };
  }) => ({
    id: item.id,
    url: item.mediaFile.baseUrl,
    thumbnailUrl: `/api/picker/thumbnail?url=${encodeURIComponent(item.mediaFile.baseUrl)}&size=300`,
    filename: item.mediaFile.filename,
    width: item.mediaFile.mediaFileMetadata?.width || 0,
    height: item.mediaFile.mediaFileMetadata?.height || 0,
    priority: 1,
  }));

  return { items, nextPageToken: data.nextPageToken };
}

export async function deletePickerSession(sessionId: string): Promise<void> {
  await api.delete(`/api/picker/sessions/${sessionId}`);
}

export async function uploadFiles(files: File[]): Promise<PhotoItem[]> {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  const { data } = await api.post('/api/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return (data.items || []).map((item: {
    id: string;
    filename: string;
    url: string;
    thumbnailUrl: string;
  }) => ({
    id: item.id,
    url: item.url,
    thumbnailUrl: item.thumbnailUrl,
    filename: item.filename,
    width: 0,
    height: 0,
    priority: 1,
  }));
}

export async function generatePdf(book: {
  title: string;
  groups: {
    id: string;
    name: string;
    template: string;
    photos: PhotoItem[];
  }[];
}): Promise<Blob> {
  const response = await api.post('/api/pdf/generate', book, {
    responseType: 'blob',
  });
  return response.data;
}
