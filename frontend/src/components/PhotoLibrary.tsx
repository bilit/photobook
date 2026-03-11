import { useState } from 'react';
import type { PhotoItem } from '../types';

interface Props {
  importedPhotos: PhotoItem[];
  pagePhotos: PhotoItem[];     // photos currently on this page
  onAssign: (photos: PhotoItem[]) => void;
  onClose: () => void;
}

export default function PhotoLibrary({ importedPhotos, pagePhotos, onAssign, onClose }: Props) {
  const pagePhotoIds = new Set(pagePhotos.map((p) => p.id));
  const [selected, setSelected] = useState<Set<string>>(new Set(pagePhotos.map((p) => p.id)));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(importedPhotos.map((p) => p.id)));
  const clearAll = () => setSelected(new Set());

  const handleApply = () => {
    const selectedPhotos = importedPhotos.filter((p) => selected.has(p.id));
    onAssign(selectedPhotos);
    onClose();
  };

  // Group photos by date
  const photosByDay = (() => {
    const sorted = [...importedPhotos].sort((a, b) => {
      if (!a.createdAt && !b.createdAt) return 0;
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    const groups: { label: string; photos: PhotoItem[] }[] = [];
    const seen = new Map<string, PhotoItem[]>();
    for (const photo of sorted) {
      let label = 'Unknown date';
      if (photo.createdAt) {
        const d = new Date(photo.createdAt);
        label = d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      }
      if (!seen.has(label)) {
        seen.set(label, []);
        groups.push({ label, photos: seen.get(label)! });
      }
      seen.get(label)!.push(photo);
    }
    return groups;
  })();

  const toggleDay = (photos: PhotoItem[]) => {
    const ids = photos.map((p) => p.id);
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const useDateGroups = photosByDay.length > 1 || (photosByDay.length === 1 && photosByDay[0].label !== 'Unknown date');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 sm:p-4">
      <div className="bg-white flex flex-col w-full h-full sm:rounded-xl sm:shadow-2xl sm:w-[90vw] sm:max-w-[900px] sm:max-h-[85vh] sm:h-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Photo Library</h2>
            <p className="text-xs text-gray-400 mt-0.5">Select which photos appear on this page</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={selectAll} className="text-xs text-blue-600 hover:text-blue-700 font-medium">Select All</button>
            <span className="text-gray-300">|</span>
            <button onClick={clearAll} className="text-xs text-gray-500 hover:text-gray-700 font-medium">Clear</button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold ml-2">×</button>
          </div>
        </div>

        {importedPhotos.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 p-12">
            <div className="text-center">
              <div className="text-5xl mb-4">🖼️</div>
              <p className="font-medium text-gray-600 mb-1">No photos imported yet</p>
              <p className="text-sm">Use the import buttons to add photos to your library first.</p>
            </div>
          </div>
        ) : useDateGroups ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {photosByDay.map(({ label, photos }) => {
              const allSelected = photos.every((p) => selected.has(p.id));
              return (
                <div key={label}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-semibold text-gray-500">{label}</span>
                    <span className="text-xs text-gray-400">{photos.length} photo{photos.length !== 1 ? 's' : ''}</span>
                    <button
                      onClick={() => toggleDay(photos)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {allSelected ? 'Deselect day' : 'Select day'}
                    </button>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-8 gap-2">
                    {photos.map((photo) => {
                      const isSelected = selected.has(photo.id);
                      const wasOnPage = pagePhotoIds.has(photo.id);
                      return (
                        <button
                          key={photo.id}
                          onClick={() => toggle(photo.id)}
                          className={`relative rounded-lg overflow-hidden border-2 transition-all group ${
                            isSelected
                              ? 'border-blue-500 ring-2 ring-blue-200'
                              : 'border-transparent hover:border-gray-300'
                          }`}
                          style={{ aspectRatio: '1' }}
                          title={photo.filename}
                        >
                          <img src={photo.thumbnailUrl} alt={photo.filename} className="w-full h-full object-cover" />
                          {isSelected && (
                            <div className="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow">
                              <span className="text-white text-xs font-bold">✓</span>
                            </div>
                          )}
                          {!isSelected && wasOnPage && (
                            <div className="absolute inset-0 bg-black bg-opacity-30" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-8 gap-2">
              {importedPhotos.map((photo) => {
                const isSelected = selected.has(photo.id);
                const wasOnPage = pagePhotoIds.has(photo.id);
                return (
                  <button
                    key={photo.id}
                    onClick={() => toggle(photo.id)}
                    className={`relative rounded-lg overflow-hidden border-2 transition-all group ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-200'
                        : 'border-transparent hover:border-gray-300'
                    }`}
                    style={{ aspectRatio: '1' }}
                    title={photo.filename}
                  >
                    <img src={photo.thumbnailUrl} alt={photo.filename} className="w-full h-full object-cover" />
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow">
                        <span className="text-white text-xs font-bold">✓</span>
                      </div>
                    )}
                    {!isSelected && wasOnPage && (
                      <div className="absolute inset-0 bg-black bg-opacity-30" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <span className="text-sm text-gray-500">
            {selected.size} of {importedPhotos.length} photos selected
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={selected.size === 0}
              className="px-6 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold rounded-lg transition-colors"
            >
              Apply {selected.size > 0 ? `(${selected.size} photos)` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
