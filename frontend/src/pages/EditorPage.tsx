import { useState, useEffect, useRef } from 'react';

const BOOK_KEY = 'photobook_data';
const GROUP_KEY = 'photobook_selected_group';
const LEFT_KEY = 'photobook_left_open';
const RIGHT_KEY = 'photobook_right_open';

function loadBook(): import('../types').PhotoBook {
  try {
    const raw = localStorage.getItem(BOOK_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2), title: 'My Photobook', groups: [], importedPhotos: [] };
}
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { v4 as uuidv4 } from 'uuid';
import Navbar from '../components/Navbar';
import AlbumImporter from '../components/AlbumImporter';
import FileUploader from '../components/FileUploader';
import PhotoGroupCard from '../components/PhotoGroupCard';
import PagePreview from '../components/PagePreview';
import type { PhotoBook, PhotoGroup, PhotoItem, CustomTemplate } from '../types';
import { generatePdf } from '../api/client';
import { loadTemplates } from '../templateStore';

interface Props {
  user: { id: string; displayName: string; email: string };
}

function SortablePageItem({
  group,
  index,
  isSelected,
  onSelect,
}: {
  group: PhotoGroup;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1">
      <div
        className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 p-1 flex-shrink-0 text-sm select-none"
        {...attributes}
        {...listeners}
      >
        ⠿
      </div>
      <button
        onClick={onSelect}
        className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors min-w-0 ${
          isSelected
            ? 'bg-blue-50 border border-blue-200 text-blue-700'
            : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
        }`}
      >
        <span className="font-mono text-xs text-gray-400 flex-shrink-0 w-5 text-right">{index + 1}</span>
        <span className="flex-1 truncate text-xs">{group.name || `Page ${index + 1}`}</span>
        <span className="text-gray-400 text-xs flex-shrink-0">{group.photos.length}</span>
      </button>
    </div>
  );
}

export default function EditorPage({ user }: Props) {
  const [book, setBook] = useState<PhotoBook>(loadBook);
  const [showImporter, setShowImporter] = useState(false);
  const [importTab, setImportTab] = useState<'google' | 'upload'>('google');
  const [generating, setGenerating] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>(() => loadTemplates());
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    () => localStorage.getItem(GROUP_KEY)
  );
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [leftOpen, setLeftOpen] = useState(() => localStorage.getItem(LEFT_KEY) !== 'false');
  const [rightOpen, setRightOpen] = useState(() => localStorage.getItem(RIGHT_KEY) !== 'false');

  // Persist book — debounced to avoid hammering storage on every keystroke/drag
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try { localStorage.setItem(BOOK_KEY, JSON.stringify(book)); } catch {}
    }, 500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [book]);

  // Persist sidebar state and selected group
  useEffect(() => { try { localStorage.setItem(LEFT_KEY, String(leftOpen)); } catch {} }, [leftOpen]);
  useEffect(() => { try { localStorage.setItem(RIGHT_KEY, String(rightOpen)); } catch {} }, [rightOpen]);
  useEffect(() => {
    try {
      if (selectedGroupId) localStorage.setItem(GROUP_KEY, selectedGroupId);
      else localStorage.removeItem(GROUP_KEY);
    } catch {}
  }, [selectedGroupId]);

  // Auto-select first page when groups change
  useEffect(() => {
    if (!selectedGroupId && book.groups.length > 0) {
      setSelectedGroupId(book.groups[0].id);
    } else if (selectedGroupId && !book.groups.find((g) => g.id === selectedGroupId)) {
      setSelectedGroupId(book.groups[0]?.id ?? null);
    }
  }, [book.groups, selectedGroupId]);

  // Auto-select first photo when switching pages
  useEffect(() => {
    const group = book.groups.find((g) => g.id === selectedGroupId);
    if (group) {
      const sorted = [...group.photos].sort((a, b) => a.priority - b.priority);
      setSelectedPhotoId(sorted[0]?.id ?? null);
    } else {
      setSelectedPhotoId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId]);

  const selectedGroup = book.groups.find((g) => g.id === selectedGroupId) ?? null;
  const selectedIndex = book.groups.findIndex((g) => g.id === selectedGroupId);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = book.groups.findIndex((g) => g.id === active.id);
      const newIndex = book.groups.findIndex((g) => g.id === over.id);
      setBook((b) => ({ ...b, groups: arrayMove(b.groups, oldIndex, newIndex) }));
    }
  };

  const addToLibrary = (photos: PhotoItem[]) => {
    if (photos.length === 0) return;
    setBook((b) => {
      const existingIds = new Set(b.importedPhotos.map((p) => p.id));
      const newPhotos = photos.filter((p) => !existingIds.has(p.id));
      return { ...b, importedPhotos: [...b.importedPhotos, ...newPhotos] };
    });
  };

  const addPage = () => {
    const newGroup: PhotoGroup = {
      id: uuidv4(),
      name: `Page ${book.groups.length + 1}`,
      template: 'focal',
      photos: [],
    };
    setBook((b) => ({ ...b, groups: [...b.groups, newGroup] }));
    setSelectedGroupId(newGroup.id);
  };

  const updateGroup = (updatedGroup: PhotoGroup) => {
    setBook((b) => ({
      ...b,
      groups: b.groups.map((g) => (g.id === updatedGroup.id ? updatedGroup : g)),
    }));
  };

  const deleteGroup = (groupId: string) => {
    setBook((b) => ({ ...b, groups: b.groups.filter((g) => g.id !== groupId) }));
  };

  const refreshTemplates = () => {
    setCustomTemplates(loadTemplates());
  };

  const updatePhotoCrop = (photoId: string, cropX: number, cropY: number, zoom?: number) => {
    if (!selectedGroupId) return;
    setBook((b) => ({
      ...b,
      groups: b.groups.map((g) =>
        g.id === selectedGroupId
          ? {
              ...g,
              photos: g.photos.map((p) =>
                p.id === photoId ? { ...p, cropX, cropY, ...(zoom !== undefined ? { zoom } : {}) } : p
              ),
            }
          : g
      ),
    }));
  };

  const updatePhotoFields = (photoId: string, fields: Partial<PhotoItem>) => {
    if (!selectedGroupId) return;
    setBook((b) => ({
      ...b,
      groups: b.groups.map((g) =>
        g.id === selectedGroupId
          ? { ...g, photos: g.photos.map((p) => (p.id === photoId ? { ...p, ...fields } : p)) }
          : g
      ),
    }));
  };

  const handleGeneratePdf = async () => {
    if (book.groups.length === 0) return;
    setGenerating(true);
    try {
      const blob = await generatePdf(book);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${book.title || 'photobook'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar
        user={user}
        bookTitle={book.title}
        onTitleChange={(t) => setBook((b) => ({ ...b, title: t }))}
        onGeneratePdf={handleGeneratePdf}
        generating={generating}
        pageCount={book.groups.length}
      />

      {showImporter ? (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => setShowImporter(false)}
              className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              ← Back to editor
            </button>
            <h2 className="text-xl font-bold">Import Photos to Library</h2>
          </div>
          <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
            <button
              onClick={() => setImportTab('google')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                importTab === 'google' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Google Photos
            </button>
            <button
              onClick={() => setImportTab('upload')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                importTab === 'upload' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Upload Files
            </button>
          </div>
          {importTab === 'google' ? (
            <AlbumImporter onAddToLibrary={addToLibrary} onDone={() => setShowImporter(false)} />
          ) : (
            <FileUploader onAddToLibrary={addToLibrary} onDone={() => setShowImporter(false)} />
          )}
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">

          {/* ── Left sidebar: pages list ── */}
          <div
            className={`flex-shrink-0 bg-white border-r border-gray-200 flex flex-col transition-all duration-200 overflow-hidden ${
              leftOpen ? 'w-52' : 'w-10'
            }`}
          >
            {leftOpen ? (
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pages</span>
                  <button
                    onClick={() => setLeftOpen(false)}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors"
                    title="Collapse"
                  >
                    ◀
                  </button>
                </div>

                {/* Import buttons */}
                <div className="p-2 border-b border-gray-100 space-y-1.5">
                  <button
                    onClick={() => { setImportTab('google'); setShowImporter(true); }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors text-xs"
                  >
                    + Google Photos
                  </button>
                  <button
                    onClick={() => { setImportTab('upload'); setShowImporter(true); }}
                    className="w-full bg-white hover:bg-gray-50 text-gray-700 font-semibold py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-gray-300 text-xs"
                  >
                    + Upload Files
                  </button>
                  {book.importedPhotos.length > 0 && (
                    <p className="text-xs text-center text-gray-400">
                      {book.importedPhotos.length} in library
                    </p>
                  )}
                </div>

                {/* Page list */}
                <div className="flex-1 overflow-y-auto p-2">
                  {book.groups.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center mt-4">No pages yet</p>
                  ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={book.groups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-1">
                          {book.groups.map((group, i) => (
                            <SortablePageItem
                              key={group.id}
                              group={group}
                              index={i}
                              isSelected={group.id === selectedGroupId}
                              onSelect={() => setSelectedGroupId(group.id)}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>

                {/* Add page */}
                <div className="p-2 border-t border-gray-100">
                  <button
                    onClick={addPage}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-1.5 px-2 rounded-lg text-xs transition-colors"
                  >
                    + Add Page
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => setLeftOpen(true)}
                className="w-full h-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                title="Open pages"
              >
                ▶
              </button>
            )}
          </div>

          {/* ── Center: large preview ── */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-gray-100 overflow-hidden">
            {book.groups.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-4">
                <div className="text-6xl">📖</div>
                <p className="text-sm text-gray-500">
                  {book.importedPhotos.length > 0
                    ? 'Add a page to get started.'
                    : 'Import photos, then add pages.'}
                </p>
                <button
                  onClick={addPage}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-lg transition-colors"
                >
                  + Add Page
                </button>
              </div>
            ) : selectedGroup ? (
              <>
                {/* Page label */}
                <div className="flex-shrink-0 px-4 py-2 bg-white border-b border-gray-200 flex items-center gap-3">
                  <span className="text-sm font-mono text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">
                    {selectedIndex + 1}
                  </span>
                  <span className="text-sm font-semibold text-gray-700 truncate">
                    {selectedGroup.name || `Page ${selectedIndex + 1}`}
                  </span>
                  <span className="text-xs text-gray-400 ml-auto">
                    {selectedGroup.photos.length} photo{selectedGroup.photos.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Preview */}
                <div className={`flex-1 min-h-0 flex items-center justify-center ${!leftOpen && !rightOpen ? 'p-2' : 'p-4'}`}>
                  <div
                    style={{
                      aspectRatio: '11/8.5',
                      maxHeight: '100%',
                      maxWidth: `min(100%, calc((100vh - ${!leftOpen && !rightOpen ? 120 : 140}px) * 11 / 8.5))`,
                      width: '100%',
                    }}
                  >
                    <PagePreview
                      group={selectedGroup}
                      customTemplates={customTemplates}
                      onUpdatePhoto={updatePhotoCrop}
                      onUpdatePhotoFields={updatePhotoFields}
                      selectedPhotoId={selectedPhotoId}
                      onSelectPhoto={setSelectedPhotoId}
                    />
                  </div>
                </div>

                <p className="flex-shrink-0 text-xs text-gray-400 text-center">
                  Click to select · Drag to reposition{selectedGroup.template === 'grid' ? ' · Use ±badges to edit order/span' : ''}
                </p>

                {/* Single zoom slider for selected photo */}
                {(() => {
                  const photo = selectedGroup.photos.find((p) => p.id === selectedPhotoId);
                  if (!photo) return null;
                  return (
                    <div className="flex-shrink-0 px-4 pb-3 pt-1 flex items-center gap-2 justify-center">
                      <span className="text-xs text-gray-400 font-mono flex-shrink-0">
                        Photo {photo.priority} zoom
                      </span>
                      <button
                        className="text-gray-400 hover:text-gray-600 text-sm leading-none w-5 text-center flex-shrink-0"
                        onClick={() => {
                          const newZoom = Math.max(0.5, Math.round(((photo.zoom ?? 1) - 0.1) * 10) / 10);
                          updatePhotoCrop(photo.id, photo.cropX ?? 50, photo.cropY ?? 50, newZoom);
                        }}
                      >−</button>
                      <input
                        type="range"
                        min={0.5}
                        max={4}
                        step={0.1}
                        value={photo.zoom ?? 1}
                        onChange={(e) => updatePhotoCrop(photo.id, photo.cropX ?? 50, photo.cropY ?? 50, parseFloat(e.target.value))}
                        className="w-32 h-1 accent-blue-500 cursor-pointer flex-shrink-0"
                      />
                      <button
                        className="text-gray-400 hover:text-gray-600 text-sm leading-none w-5 text-center flex-shrink-0"
                        onClick={() => {
                          const newZoom = Math.min(4, Math.round(((photo.zoom ?? 1) + 0.1) * 10) / 10);
                          updatePhotoCrop(photo.id, photo.cropX ?? 50, photo.cropY ?? 50, newZoom);
                        }}
                      >+</button>
                      <span className="text-xs text-gray-400 font-mono flex-shrink-0 w-7">
                        {(photo.zoom ?? 1).toFixed(1)}×
                      </span>
                    </div>
                  );
                })()}
              </>
            ) : null}
          </div>

          {/* ── Right sidebar: controls ── */}
          <div
            className={`flex-shrink-0 bg-white border-l border-gray-200 flex flex-col transition-all duration-200 overflow-hidden ${
              rightOpen ? 'w-80' : 'w-10'
            }`}
          >
            {rightOpen ? (
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 flex-shrink-0">
                  <button
                    onClick={() => setRightOpen(false)}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors"
                    title="Collapse"
                  >
                    ▶
                  </button>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Controls</span>
                </div>

                {/* Controls for selected page */}
                <div className="flex-1 overflow-y-auto">
                  {selectedGroup ? (
                    <PhotoGroupCard
                      key={selectedGroup.id}
                      group={selectedGroup}
                      pageNumber={selectedIndex + 1}
                      onUpdate={updateGroup}
                      onDelete={(id) => { deleteGroup(id); }}
                      importedPhotos={book.importedPhotos}
                      customTemplates={customTemplates}
                      onTemplatesChange={refreshTemplates}
                      showPreview={false}
                    />
                  ) : (
                    <div className="p-4 text-xs text-gray-400 text-center mt-4">
                      Select a page to edit
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button
                onClick={() => setRightOpen(true)}
                className="w-full h-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                title="Open controls"
              >
                ◀
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
