import { useEffect, useRef, useState } from 'react';
import { createPickerSession, getPickerSession, getPickerItems, deletePickerSession } from '../api/client';
import type { PhotoItem } from '../types';

interface Props {
  onAddPhotos: (photos: PhotoItem[]) => void;
}

type PickerState = 'idle' | 'creating' | 'picking' | 'loading' | 'done' | 'error';

export default function AlbumImporter({ onAddPhotos }: Props) {
  const [state, setState] = useState<PickerState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pickerUri, setPickerUri] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startPicker = async () => {
    setState('creating');
    setErrorMsg('');
    try {
      const { sessionId: sid, pickerUri: uri } = await createPickerSession();
      setSessionId(sid);
      setPickerUri(uri);
      setState('picking');
      // Open picker in a new tab
      window.open(uri, '_blank', 'noopener,noreferrer');
      // Begin polling for session completion
      pollRef.current = setInterval(async () => {
        try {
          const { mediaItemsSet } = await getPickerSession(sid);
          if (mediaItemsSet) {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            await loadItems(sid);
          }
        } catch {
          // keep polling
        }
      }, 3000);
    } catch {
      setState('error');
      setErrorMsg('Failed to start Google Photos Picker. Please try again.');
    }
  };

  const loadItems = async (sid: string) => {
    setState('loading');
    try {
      const allPhotos: PhotoItem[] = [];
      let pageToken: string | undefined;
      do {
        const result = await getPickerItems(sid, pageToken);
        allPhotos.push(...result.items);
        pageToken = result.nextPageToken;
      } while (pageToken);
      setPhotos(allPhotos);
      setSelected(new Set(allPhotos.map((p) => p.id)));
      setState('done');
    } catch {
      setState('error');
      setErrorMsg('Failed to load selected photos. Please try again.');
    }
  };

  const reset = async () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (sessionId) {
      deletePickerSession(sessionId).catch(() => {});
    }
    setSessionId(null);
    setPickerUri(null);
    setPhotos([]);
    setSelected(new Set());
    setState('idle');
    setErrorMsg('');
  };

  const togglePhoto = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSelected = () => {
    const chosen = photos.filter((p) => selected.has(p.id));
    if (chosen.length === 0) return;
    // Clean up the session in the background
    if (sessionId) deletePickerSession(sessionId).catch(() => {});
    onAddPhotos(chosen);
  };

  if (state === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="text-5xl">📷</div>
        <p className="text-gray-600 text-center max-w-sm">
          Open the Google Photos Picker to select photos from your library.
        </p>
        <button
          onClick={startPicker}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-lg transition-colors flex items-center gap-2"
        >
          Open Google Photos Picker
        </button>
      </div>
    );
  }

  if (state === 'creating') {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        Starting picker...
      </div>
    );
  }

  if (state === 'picking') {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        <p className="text-gray-700 font-medium">Waiting for you to pick photos...</p>
        <p className="text-gray-500 text-sm text-center max-w-xs">
          The Google Photos Picker opened in a new tab. Select your photos there and we'll import them automatically.
        </p>
        {pickerUri && (
          <a
            href={pickerUri}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 text-sm underline"
          >
            Open picker again if the tab was blocked
          </a>
        )}
        <button
          onClick={reset}
          className="mt-2 text-gray-400 hover:text-gray-600 text-sm"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        Loading your selected photos...
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <p className="text-red-500">{errorMsg}</p>
        <button
          onClick={reset}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  // state === 'done'
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            ← Pick again
          </button>
          <h3 className="font-semibold text-gray-800">
            {photos.length} photo{photos.length !== 1 ? 's' : ''} selected
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelected(new Set(photos.map((p) => p.id)))}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Select all
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
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

      {photos.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No photos were selected.{' '}
          <button onClick={reset} className="text-blue-600 hover:underline">
            Open picker again
          </button>
        </div>
      ) : (
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
      )}
    </div>
  );
}
