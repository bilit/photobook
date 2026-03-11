import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Navbar from '../components/Navbar';
import AlbumImporter from '../components/AlbumImporter';
import FileUploader from '../components/FileUploader';
import BookEditor from '../components/BookEditor';
import type { PhotoBook, PhotoGroup, PhotoItem, CustomTemplate } from '../types';
import { generatePdf } from '../api/client';
import { loadTemplates } from '../templateStore';

interface Props {
  user: { id: string; displayName: string; email: string };
}

export default function EditorPage({ user }: Props) {
  const [book, setBook] = useState<PhotoBook>({
    id: uuidv4(),
    title: 'My Photobook',
    groups: [],
    importedPhotos: [],
  });
  const [showImporter, setShowImporter] = useState(false);
  const [importTab, setImportTab] = useState<'google' | 'upload'>('google');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>(() => loadTemplates());

  // Add photos to the global pool (dedup by id)
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

  const reorderGroups = (newGroups: PhotoGroup[]) => {
    setBook((b) => ({ ...b, groups: newGroups }));
  };

  const refreshTemplates = () => {
    setCustomTemplates(loadTemplates());
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
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
        sidebarOpen={sidebarOpen}
      />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-40 z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`
          bg-white border-r border-gray-200 flex flex-col
          fixed md:relative inset-y-0 left-0 z-30
          w-72 sm:w-80 transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <div className="p-4 border-b border-gray-200 space-y-2">
            <button
              onClick={() => { setImportTab('google'); setShowImporter(true); setSidebarOpen(false); }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <span>+</span> Import from Google Photos
            </button>
            <button
              onClick={() => { setImportTab('upload'); setShowImporter(true); setSidebarOpen(false); }}
              className="w-full bg-white hover:bg-gray-50 text-gray-700 font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors border border-gray-300"
            >
              <span>+</span> Upload from Device
            </button>
            {book.importedPhotos.length > 0 && (
              <p className="text-xs text-center text-gray-400">
                {book.importedPhotos.length} photo{book.importedPhotos.length !== 1 ? 's' : ''} in library
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {book.groups.length === 0 ? (
              <div className="text-center text-gray-400 mt-8">
                <div className="text-4xl mb-3">🖼️</div>
                <p className="text-sm">
                  {book.importedPhotos.length > 0
                    ? 'Click "+ Add Page" to create pages\nand assign photos from your library.'
                    : 'Import photos, then add pages.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  {book.groups.length} page{book.groups.length !== 1 ? 's' : ''}
                </p>
                {book.groups.map((group, i) => (
                  <div
                    key={group.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer text-sm"
                  >
                    <span className="text-gray-400 font-mono text-xs w-5 text-right">{i + 1}</span>
                    <span className="flex-1 truncate text-gray-700">{group.name || `Page ${i + 1}`}</span>
                    <span className="text-gray-400 text-xs">{group.photos.length} photos</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          {showImporter ? (
            <div>
              <div className="flex items-center gap-4 mb-6">
                <button
                  onClick={() => setShowImporter(false)}
                  className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  ← Back to editor
                </button>
                <h2 className="text-xl font-bold">Import Photos to Library</h2>
              </div>

              {/* Source tabs */}
              <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
                <button
                  onClick={() => setImportTab('google')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    importTab === 'google'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Google Photos
                </button>
                <button
                  onClick={() => setImportTab('upload')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    importTab === 'upload'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
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
            <BookEditor
              groups={book.groups}
              importedPhotos={book.importedPhotos}
              customTemplates={customTemplates}
              onTemplatesChange={refreshTemplates}
              onUpdateGroup={updateGroup}
              onDeleteGroup={deleteGroup}
              onReorderGroups={reorderGroups}
              onAddPage={addPage}
            />
          )}
        </div>
      </div>
    </div>
  );
}
