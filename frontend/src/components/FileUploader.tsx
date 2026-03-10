import { useRef, useState } from 'react';
import { uploadFiles } from '../api/client';
import type { PhotoItem } from '../types';

interface Props {
  onAddPhotos: (photos: PhotoItem[]) => void;
}

export default function FileUploader({ onAddPhotos }: Props) {
  const [uploading, setUploading] = useState(false);
  const [previews, setPreviews] = useState<{ file: File; objectUrl: string; id: string }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [draggingOver, setDraggingOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (newFiles: FileList | File[]) => {
    const imageFiles = Array.from(newFiles).filter((f) => f.type.startsWith('image/'));
    const newPreviews = imageFiles.map((file) => ({
      file,
      objectUrl: URL.createObjectURL(file),
      id: `preview-${Math.random().toString(36).slice(2)}`,
    }));
    setPreviews((prev) => [...prev, ...newPreviews]);
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of newPreviews) next.add(p.id);
      return next;
    });
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggingOver(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const removePreview = (id: string) => {
    setPreviews((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item) URL.revokeObjectURL(item.objectUrl);
      return prev.filter((p) => p.id !== id);
    });
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleAddSelected = async () => {
    const chosen = previews.filter((p) => selected.has(p.id));
    if (chosen.length === 0) return;

    setUploading(true);
    try {
      const items = await uploadFiles(chosen.map((p) => p.file));
      onAddPhotos(items);
      // Clean up object URLs for uploaded previews
      for (const p of chosen) URL.revokeObjectURL(p.objectUrl);
      setPreviews((prev) => prev.filter((p) => !selected.has(p.id)));
      setSelected(new Set());
    } catch {
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDraggingOver(true); }}
        onDragLeave={() => setDraggingOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors mb-6 ${
          draggingOver
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        }`}
      >
        <div className="text-4xl mb-3">📁</div>
        <p className="text-gray-600 font-medium">Drop images here or click to browse</p>
        <p className="text-gray-400 text-sm mt-1">JPG, PNG, WebP — up to 20MB per file</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />
      </div>

      {previews.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">{previews.length} file{previews.length !== 1 ? 's' : ''} ready</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelected(new Set(previews.map((p) => p.id)))}
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
                  onClick={handleAddSelected}
                  disabled={uploading}
                  className="ml-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold py-1.5 px-4 rounded-lg transition-colors"
                >
                  {uploading
                    ? 'Uploading...'
                    : `Add ${selected.size} photo${selected.size !== 1 ? 's' : ''} as new page`}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
            {previews.map((preview) => (
              <div key={preview.id} className="relative group">
                <button
                  onClick={() => toggleSelect(preview.id)}
                  className={`w-full aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                    selected.has(preview.id)
                      ? 'border-blue-500 shadow-lg'
                      : 'border-transparent hover:border-gray-300'
                  }`}
                >
                  <img
                    src={preview.objectUrl}
                    alt={preview.file.name}
                    className="w-full h-full object-cover"
                  />
                  {selected.has(preview.id) && (
                    <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
                      <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">✓</div>
                    </div>
                  )}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); removePreview(preview.id); }}
                  className="absolute top-1 right-1 bg-black bg-opacity-50 text-white rounded-full w-5 h-5 text-xs hidden group-hover:flex items-center justify-center"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
