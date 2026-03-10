import { useEffect, useState } from 'react';
import { getAlbums, getAlbumPhotos } from '../api/client';
import type { Album, PhotoItem } from '../types';

interface Props {
  onAddPhotos: (photos: PhotoItem[]) => void;
}

export default function AlbumImporter({ onAddPhotos }: Props) {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loadingAlbums, setLoadingAlbums] = useState(true);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    getAlbums()
      .then(setAlbums)
      .catch(() => setAlbums([]))
      .finally(() => setLoadingAlbums(false));
  }, []);

  const openAlbum = async (album: Album) => {
    setSelectedAlbum(album);
    setPhotos([]);
    setSelected(new Set());
    setLoadingPhotos(true);
    try {
      const result = await getAlbumPhotos(album.id);
      setPhotos(result.items);
      setNextPageToken(result.nextPageToken);
    } catch {
      setPhotos([]);
    } finally {
      setLoadingPhotos(false);
    }
  };

  const loadMore = async () => {
    if (!selectedAlbum || !nextPageToken) return;
    setLoadingPhotos(true);
    try {
      const result = await getAlbumPhotos(selectedAlbum.id, nextPageToken);
      setPhotos((p) => [...p, ...result.items]);
      setNextPageToken(result.nextPageToken);
    } catch {
      // ignore
    } finally {
      setLoadingPhotos(false);
    }
  };

  const togglePhoto = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(photos.map((p) => p.id)));
  const clearAll = () => setSelected(new Set());

  const addSelected = () => {
    const chosen = photos.filter((p) => selected.has(p.id));
    onAddPhotos(chosen);
  };

  if (loadingAlbums) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <svg className="animate-spin h-6 w-6 mr-2" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        Loading albums...
      </div>
    );
  }

  if (!selectedAlbum) {
    return (
      <div>
        <p className="text-gray-500 mb-4">Select an album to import photos from:</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {albums.map((album) => (
            <button
              key={album.id}
              onClick={() => openAlbum(album)}
              className="group rounded-xl overflow-hidden border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all text-left"
            >
              <div className="aspect-square bg-gray-100 overflow-hidden">
                {album.coverPhotoBaseUrl ? (
                  <img
                    src={`${album.coverPhotoBaseUrl}=w300-h300`}
                    alt={album.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">📷</div>
                )}
              </div>
              <div className="p-2">
                <p className="font-medium text-sm text-gray-800 truncate">{album.title}</p>
                <p className="text-xs text-gray-400">{album.mediaItemsCount} photos</p>
              </div>
            </button>
          ))}
        </div>
        {albums.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            No albums found in your Google Photos.
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedAlbum(null)}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            ← Albums
          </button>
          <h3 className="font-semibold text-gray-800">{selectedAlbum.title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={selectAll} className="text-xs text-blue-600 hover:text-blue-800">Select all</button>
          <span className="text-gray-300">|</span>
          <button onClick={clearAll} className="text-xs text-gray-500 hover:text-gray-700">Clear</button>
          {selected.size > 0 && (
            <button
              onClick={addSelected}
              className="ml-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-1.5 px-4 rounded-lg transition-colors"
            >
              Add {selected.size} photo{selected.size !== 1 ? 's' : ''} as new page
            </button>
          )}
        </div>
      </div>

      {loadingPhotos && photos.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <svg className="animate-spin h-6 w-6 mr-2" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Loading photos...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
            {photos.map((photo) => (
              <button
                key={photo.id}
                onClick={() => togglePhoto(photo.id)}
                className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                  selected.has(photo.id)
                    ? 'border-blue-500 shadow-lg'
                    : 'border-transparent hover:border-gray-300'
                }`}
              >
                <img
                  src={photo.thumbnailUrl}
                  alt={photo.filename}
                  className="w-full h-full object-cover"
                />
                {selected.has(photo.id) && (
                  <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
                    <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">✓</div>
                  </div>
                )}
              </button>
            ))}
          </div>

          {nextPageToken && (
            <div className="text-center mt-6">
              <button
                onClick={loadMore}
                disabled={loadingPhotos}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-6 rounded-lg transition-colors"
              >
                {loadingPhotos ? 'Loading...' : 'Load more photos'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
