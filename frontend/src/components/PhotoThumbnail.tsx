import { useState } from 'react';
import type { PhotoItem } from '../types';

interface Props {
  photo: PhotoItem;
  onPriorityChange: (id: string, priority: number) => void;
  onRemove: (id: string) => void;
  onZoomChange?: (id: string, zoom: number) => void;
}

export default function PhotoThumbnail({ photo, onPriorityChange, onRemove, onZoomChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(photo.priority));

  const commitPriority = () => {
    const val = parseInt(draft);
    if (!isNaN(val) && val >= 1 && val <= 99) {
      onPriorityChange(photo.id, val);
    }
    setEditing(false);
  };

  return (
    <div className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-100 aspect-square">
      <img
        src={photo.thumbnailUrl}
        alt={photo.filename}
        className="w-full h-full object-cover"
      />

      {/* Priority badge */}
      <div
        className="absolute top-1 left-1"
        onClick={(e) => { e.stopPropagation(); setDraft(String(photo.priority)); setEditing(true); }}
      >
        {editing ? (
          <input
            autoFocus
            type="number"
            min={1}
            max={99}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitPriority}
            onKeyDown={(e) => { if (e.key === 'Enter') commitPriority(); if (e.key === 'Escape') setEditing(false); }}
            className="w-10 h-6 text-xs text-center font-bold border-2 border-blue-500 rounded bg-white outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <button
            title="Click to change priority"
            className="w-6 h-6 bg-white bg-opacity-90 hover:bg-opacity-100 border border-gray-300 hover:border-blue-400 text-xs font-bold text-gray-700 rounded flex items-center justify-center shadow-sm transition-all"
          >
            {photo.priority}
          </button>
        )}
      </div>

      {/* Remove button */}
      <button
        onClick={() => onRemove(photo.id)}
        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow-sm"
        title="Remove photo"
      >
        ×
      </button>

      {/* Filename tooltip */}
      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
        {photo.filename}
      </div>

      {/* Zoom slider — shown on hover */}
      {onZoomChange && (
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 px-1 pb-1 pt-4 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <input
            type="range"
            min={0.5}
            max={4}
            step={0.1}
            value={photo.zoom ?? 1}
            onChange={(e) => onZoomChange(photo.id, parseFloat(e.target.value))}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 h-1 accent-white cursor-pointer"
            title={`Zoom: ${(photo.zoom ?? 1).toFixed(1)}×`}
          />
          <span className="text-white text-xs flex-shrink-0 w-8 text-right">
            {(photo.zoom ?? 1).toFixed(1)}×
          </span>
        </div>
      )}
    </div>
  );
}
