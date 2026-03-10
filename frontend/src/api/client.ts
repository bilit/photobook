import axios from 'axios';
import type { Album, PhotoItem, AuthStatus } from '../types';

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

export async function getAlbums(): Promise<Album[]> {
  const { data } = await api.get('/api/albums');
  return data.albums;
}

export async function getAlbumPhotos(
  albumId: string,
  pageToken?: string
): Promise<{ items: PhotoItem[]; nextPageToken?: string }> {
  const params: Record<string, string> = {};
  if (pageToken) params.pageToken = pageToken;
  const { data } = await api.get(`/api/albums/${albumId}/photos`, { params });

  const items: PhotoItem[] = (data.items || []).map((item: {
    id: string;
    baseUrl: string;
    filename: string;
    mediaMetadata?: { width?: string; height?: string };
  }) => ({
    id: item.id,
    url: item.baseUrl,
    thumbnailUrl: `${item.baseUrl}=w300-h300`,
    filename: item.filename,
    width: parseInt(item.mediaMetadata?.width || '0'),
    height: parseInt(item.mediaMetadata?.height || '0'),
    priority: 1,
  }));

  return { items, nextPageToken: data.nextPageToken };
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
