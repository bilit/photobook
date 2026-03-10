import { useState } from 'react';
import type { PhotoGroup, PhotoItem, TemplateType, CustomTemplate } from '../types';
import PhotoThumbnail from './PhotoThumbnail';
import PagePreview from './PagePreview';
import TemplateSelector from './TemplateSelector';
import PhotoLibrary from './PhotoLibrary';
import TemplateBuilder from './TemplateBuilder';
import { deleteTemplate } from '../templateStore';

interface Props {
  group: PhotoGroup;
  pageNumber: number;
  onUpdate: (group: PhotoGroup) => void;
  onDelete: (id: string) => void;
  importedPhotos: PhotoItem[];
  customTemplates: CustomTemplate[];
  onTemplatesChange: () => void;
}

export default function PhotoGroupCard({
  group,
  pageNumber,
  onUpdate,
  onDelete,
  importedPhotos,
  customTemplates,
  onTemplatesChange,
}: Props) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(group.name);
  const [collapsed, setCollapsed] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);

  const update = (patch: Partial<PhotoGroup>) => {
    onUpdate({ ...group, ...patch });
  };

  const commitName = () => {
    update({ name: nameDraft.trim() || `Page ${pageNumber}` });
    setEditingName(false);
  };

  const changePriority = (photoId: string, priority: number) => {
    const photos = group.photos.map((p) => (p.id === photoId ? { ...p, priority } : p));
    update({ photos });
  };

  const removePhoto = (photoId: string) => {
    const photos = group.photos.filter((p) => p.id !== photoId);
    update({ photos });
  };

  const handleAssignPhotos = (selected: PhotoItem[]) => {
    // Re-assign priorities in order, preserving existing priority order for photos already on the page
    const existingPriorities = new Map(group.photos.map((p) => [p.id, p.priority]));
    const photos = selected.map((p, i) => ({
      ...p,
      priority: existingPriorities.has(p.id) ? existingPriorities.get(p.id)! : i + 1,
    }));
    // Normalize priorities so they are sequential starting from 1
    const sorted = [...photos].sort((a, b) => a.priority - b.priority);
    const normalized = sorted.map((p, i) => ({ ...p, priority: i + 1 }));
    update({ photos: normalized });
  };

  const handleTemplateChange = (t: TemplateType) => {
    const custom = customTemplates.find((ct) => ct.id === t);
    if (custom) {
      update({ template: t, templateZones: custom.zones });
    } else {
      update({ template: t, templateZones: undefined });
    }
  };

  const handleDeleteTemplate = (id: string) => {
    deleteTemplate(id);
    onTemplatesChange();
    if (group.template === id) {
      update({ template: 'focal', templateZones: undefined });
    }
  };

  const sortedPhotos = [...group.photos].sort((a, b) => a.priority - b.priority);

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
          <span className="text-sm font-mono text-gray-400 w-8 text-center bg-gray-200 rounded px-1.5 py-0.5">
            {pageNumber}
          </span>

          {editingName ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitName();
                if (e.key === 'Escape') setEditingName(false);
              }}
              className="flex-1 font-semibold text-gray-800 border-b-2 border-blue-500 outline-none bg-transparent text-sm"
            />
          ) : (
            <button
              onClick={() => { setNameDraft(group.name); setEditingName(true); }}
              className="flex-1 font-semibold text-gray-800 hover:text-blue-600 text-sm text-left transition-colors"
            >
              {group.name || `Page ${pageNumber}`}
            </button>
          )}

          <span className="text-xs text-gray-400">
            {group.photos.length} photo{group.photos.length !== 1 ? 's' : ''}
          </span>

          <button
            onClick={() => setCollapsed((c) => !c)}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '▼' : '▲'}
          </button>

          <button
            onClick={() => onDelete(group.id)}
            className="text-red-400 hover:text-red-600 transition-colors p-1 text-sm"
            title="Delete page"
          >
            🗑
          </button>
        </div>

        {!collapsed && (
          <div className="p-4 flex gap-4">
            {/* Left: controls + photo grid */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-3 mb-3 flex-wrap">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-2">Template</span>
                <TemplateSelector
                  value={group.template}
                  onChange={handleTemplateChange}
                  customTemplates={customTemplates}
                  onCreateTemplate={() => setShowBuilder(true)}
                  onDeleteTemplate={handleDeleteTemplate}
                />
              </div>

              <div className="flex items-center gap-3 mb-3">
                <button
                  onClick={() => setShowLibrary(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  + Add Photos
                </button>
                {group.photos.length > 0 && (
                  <span className="text-xs text-gray-400">
                    Click the number badge to change priority (1 = largest)
                  </span>
                )}
              </div>

              {sortedPhotos.length === 0 ? (
                <div className="flex items-center justify-center py-8 border-2 border-dashed border-gray-200 rounded-lg text-gray-300 text-sm">
                  No photos — click "Add Photos" to assign from library
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                  {sortedPhotos.map((photo: PhotoItem) => (
                    <PhotoThumbnail
                      key={photo.id}
                      photo={photo}
                      onPriorityChange={changePriority}
                      onRemove={removePhoto}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Right: live preview */}
            <div className="w-40 flex-shrink-0">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 text-center">Preview</p>
              <PagePreview group={group} customTemplates={customTemplates} />
            </div>
          </div>
        )}
      </div>

      {showLibrary && (
        <PhotoLibrary
          importedPhotos={importedPhotos}
          pagePhotos={group.photos}
          onAssign={handleAssignPhotos}
          onClose={() => setShowLibrary(false)}
        />
      )}

      {showBuilder && (
        <TemplateBuilder
          onSave={() => onTemplatesChange()}
          onClose={() => setShowBuilder(false)}
        />
      )}
    </>
  );
}
