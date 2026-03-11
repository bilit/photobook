import { useRef, useState } from 'react';
import type { PhotoGroup, PhotoItem, TemplateZone, CustomTemplate } from '../types';

// Scale the used zones (those with photos) to fill the full page area
function fillPageZones(zones: TemplateZone[], photoCount: number): TemplateZone[] {
  const used = zones.slice(0, photoCount);
  if (used.length === 0) return zones;
  const minX = Math.min(...used.map((z) => z.x));
  const minY = Math.min(...used.map((z) => z.y));
  const maxX = Math.max(...used.map((z) => z.x + z.width));
  const maxY = Math.max(...used.map((z) => z.y + z.height));
  const rangeX = maxX - minX;
  const rangeY = maxY - minY;
  if (rangeX === 0 || rangeY === 0) return used;
  return used.map((z) => ({
    ...z,
    x: ((z.x - minX) / rangeX) * 100,
    y: ((z.y - minY) / rangeY) * 100,
    width: (z.width / rangeX) * 100,
    height: (z.height / rangeY) * 100,
  }));
}

interface Props {
  group: PhotoGroup;
  customTemplates: CustomTemplate[];
  onUpdatePhoto?: (photoId: string, cropX: number, cropY: number, zoom?: number) => void;
  onUpdatePhotoFields?: (photoId: string, fields: Partial<PhotoItem>) => void;
}

/** A photo slot that supports drag-to-pan, scroll-to-zoom, and (in grid mode) editable order/span overlays. */
function DraggablePhoto({
  photo,
  onUpdatePhoto,
  gridMode,
  onUpdatePhotoFields,
}: {
  photo: PhotoItem;
  onUpdatePhoto?: (photoId: string, cropX: number, cropY: number, zoom?: number) => void;
  gridMode?: boolean;
  onUpdatePhotoFields?: (photoId: string, fields: Partial<PhotoItem>) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    startX: number;
    startY: number;
    startCropX: number;
    startCropY: number;
  } | null>(null);

  const [editingField, setEditingField] = useState<'priority' | 'colSpan' | 'rowSpan' | null>(null);
  const [fieldDraft, setFieldDraft] = useState('');

  const cropX = photo.cropX ?? 50;
  const cropY = photo.cropY ?? 50;
  const zoom = photo.zoom ?? 1;
  const colSpan = photo.colSpan ?? 1;
  const rowSpan = photo.rowSpan ?? 1;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!onUpdatePhoto) return;
    // Don't start drag when clicking on overlay controls
    if ((e.target as HTMLElement).closest('[data-overlay]')) return;
    e.preventDefault();
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      startCropX: cropX,
      startCropY: cropY,
    };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragState.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dx = ev.clientX - dragState.current.startX;
      const dy = ev.clientY - dragState.current.startY;
      // Dragging right = pan left = decrease cropX
      const newCropX = Math.max(0, Math.min(100, dragState.current.startCropX - (dx / rect.width) * 100));
      const newCropY = Math.max(0, Math.min(100, dragState.current.startCropY - (dy / rect.height) * 100));
      onUpdatePhoto(photo.id, newCropX, newCropY);
    };

    const handleMouseUp = () => {
      dragState.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!onUpdatePhoto) return;
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(0.5, Math.min(4, zoom + delta));
    onUpdatePhoto(photo.id, cropX, cropY, Math.round(newZoom * 10) / 10);
  };

  const startEditing = (e: React.MouseEvent, field: 'priority' | 'colSpan' | 'rowSpan') => {
    e.stopPropagation();
    if (!onUpdatePhotoFields) return;
    const val = field === 'priority' ? photo.priority : field === 'colSpan' ? colSpan : rowSpan;
    setEditingField(field);
    setFieldDraft(String(val));
  };

  const commitEdit = (field: typeof editingField) => {
    if (!field || !onUpdatePhotoFields) return;
    const val = parseInt(fieldDraft);
    if (!isNaN(val) && val >= 1) {
      const max = field === 'priority' ? 99 : field === 'colSpan' ? 3 : 4;
      onUpdatePhotoFields(photo.id, { [field]: Math.min(val, max) });
    }
    setEditingField(null);
  };

  const badgeBase = 'bg-black bg-opacity-60 text-white text-xs font-bold rounded px-1 leading-none py-0.5 select-none';
  const editableBadge = `${badgeBase} cursor-pointer hover:bg-white hover:bg-opacity-90 hover:text-gray-800 transition-colors`;
  const inputClass = 'w-7 h-5 text-xs text-center bg-white border border-blue-400 rounded outline-none font-bold text-gray-800';

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden"
      onMouseDown={handleMouseDown}
      onWheel={handleWheel}
      style={{ cursor: onUpdatePhoto ? (dragState.current ? 'grabbing' : 'grab') : 'default' }}
    >
      <img
        src={photo.thumbnailUrl}
        alt={photo.filename}
        className="w-full h-full object-cover"
        style={{
          objectPosition: `${cropX}% ${cropY}%`,
          transform: `scale(${zoom})`,
          transformOrigin: `${cropX}% ${cropY}%`,
        }}
        draggable={false}
      />

      {/* Priority badge — top-left; editable in grid mode */}
      <div className="absolute top-1 left-1 z-10" data-overlay>
        {gridMode && editingField === 'priority' ? (
          <input
            autoFocus
            type="number"
            min={1}
            max={99}
            value={fieldDraft}
            onChange={(e) => setFieldDraft(e.target.value)}
            className={inputClass}
            onBlur={() => commitEdit('priority')}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') commitEdit('priority');
              if (e.key === 'Escape') setEditingField(null);
            }}
            onMouseDown={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            className={gridMode && onUpdatePhotoFields ? editableBadge : badgeBase}
            onClick={gridMode ? (e) => startEditing(e, 'priority') : undefined}
            title={gridMode ? 'Order in grid (click to edit)' : undefined}
          >
            {photo.priority}
          </div>
        )}
      </div>

      {/* Zoom indicator as magnifying glass — top-right in grid mode, bottom-right otherwise */}
      {zoom !== 1 && (
        <div
          className={`absolute ${gridMode ? 'top-1 right-1' : 'bottom-1 right-1'} bg-black bg-opacity-60 text-white text-xs rounded px-1 py-0.5 flex items-center gap-0.5 pointer-events-none`}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="flex-shrink-0">
            <circle cx="4" cy="4" r="3" stroke="white" strokeWidth="1.5"/>
            <line x1="6.5" y1="6.5" x2="9" y2="9" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span>{zoom.toFixed(1)}×</span>
        </div>
      )}

      {/* Grid-only controls: colSpan (bottom-left) and rowSpan (bottom-right) */}
      {gridMode && (
        <>
          {/* Horizontal span — bottom-left */}
          <div className="absolute bottom-1 left-1 z-10" data-overlay>
            {editingField === 'colSpan' ? (
              <input
                autoFocus
                type="number"
                min={1}
                max={3}
                value={fieldDraft}
                onChange={(e) => setFieldDraft(e.target.value)}
                className={inputClass}
                onBlur={() => commitEdit('colSpan')}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') commitEdit('colSpan');
                  if (e.key === 'Escape') setEditingField(null);
                }}
                onMouseDown={(e) => e.stopPropagation()}
              />
            ) : (
              <div
                className={onUpdatePhotoFields ? editableBadge : badgeBase}
                onClick={(e) => startEditing(e, 'colSpan')}
                title="Horizontal columns (click to edit)"
              >
                ↔{colSpan}
              </div>
            )}
          </div>

          {/* Vertical span — bottom-right */}
          <div className="absolute bottom-1 right-1 z-10" data-overlay>
            {editingField === 'rowSpan' ? (
              <input
                autoFocus
                type="number"
                min={1}
                max={4}
                value={fieldDraft}
                onChange={(e) => setFieldDraft(e.target.value)}
                className={inputClass}
                onBlur={() => commitEdit('rowSpan')}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') commitEdit('rowSpan');
                  if (e.key === 'Escape') setEditingField(null);
                }}
                onMouseDown={(e) => e.stopPropagation()}
              />
            ) : (
              <div
                className={onUpdatePhotoFields ? editableBadge : badgeBase}
                onClick={(e) => startEditing(e, 'rowSpan')}
                title="Vertical rows (click to edit)"
              >
                ↕{rowSpan}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function FocalPreview({
  photos,
  fillPage,
  onUpdatePhoto,
}: {
  photos: PhotoItem[];
  fillPage?: boolean;
  onUpdatePhoto?: (photoId: string, cropX: number, cropY: number) => void;
}) {
  const sorted = [...photos].sort((a, b) => a.priority - b.priority);
  const n = sorted.length;

  const getGridStyle = (): React.CSSProperties => {
    if (n === 1) return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' };
    if (n === 2) return { gridTemplateColumns: '3fr 2fr', gridTemplateRows: '1fr' };
    if (n === 3) return { gridTemplateColumns: '3fr 2fr', gridTemplateRows: '1fr 1fr' };
    if (n === 4) return { gridTemplateColumns: '3fr 2fr', gridTemplateRows: '1fr 1fr 1fr' };
    if (n === 5) return { gridTemplateColumns: '3fr 2fr', gridTemplateRows: '2fr 1fr 1fr' };
    if (n === 6) return { gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: '2fr 1fr' };
    // 7+: 3-col grid, first photo spans 2 cols
    const extraRows = Math.ceil((n - 1) / 3);
    return {
      gridTemplateColumns: 'repeat(3, 1fr)',
      gridTemplateRows: `2fr ${Array(extraRows).fill('1fr').join(' ')}`,
    };
  };

  const getPhotoStyle = (i: number): React.CSSProperties => {
    if (n === 2) {
      if (i === 0) return { gridArea: '1 / 1 / 2 / 2' };
      if (i === 1) return { gridArea: '1 / 2 / 2 / 3' };
    }
    if (n === 3) {
      if (i === 0) return { gridArea: '1 / 1 / 3 / 2' };
      if (i === 1) return { gridArea: '1 / 2 / 2 / 3' };
      if (i === 2) return { gridArea: '2 / 2 / 3 / 3' };
    }
    if (n === 4) {
      if (i === 0) return { gridArea: '1 / 1 / 3 / 2' };
      if (i === 1) return { gridArea: '1 / 2 / 2 / 3' };
      if (i === 2) return { gridArea: '2 / 2 / 3 / 3' };
      if (i === 3) return { gridArea: '3 / 1 / 4 / 3' };
    }
    if (n === 5) {
      if (i === 0) return { gridArea: '1 / 1 / 2 / 3' };
      if (i === 1) return { gridArea: '2 / 1 / 3 / 2' };
      if (i === 2) return { gridArea: '2 / 2 / 3 / 3' };
      if (i === 3) return { gridArea: '3 / 1 / 4 / 2' };
      if (i === 4) return { gridArea: '3 / 2 / 4 / 3' };
    }
    if (n === 6) {
      if (i === 0) return { gridArea: '1 / 1 / 2 / 3' };
      if (i === 1) return { gridArea: '1 / 3 / 2 / 4' };
    }
    // 7+: first photo spans 2 columns
    if (n >= 7 && i === 0) return { gridColumn: '1 / 3' };
    return {};
  };

  const gap = fillPage ? '0' : '2px';

  return (
    <div className="w-full h-full grid" style={{ ...getGridStyle(), gap }}>
      {sorted.map((photo, i) => (
        <div
          key={photo.id}
          className={`overflow-hidden bg-gray-100 relative ${fillPage ? '' : 'rounded'}`}
          style={getPhotoStyle(i)}
        >
          <DraggablePhoto photo={photo} onUpdatePhoto={onUpdatePhoto} />
        </div>
      ))}
    </div>
  );
}

function GridPreview({
  photos,
  fillPage,
  onUpdatePhoto,
  onUpdatePhotoFields,
}: {
  photos: PhotoItem[];
  fillPage?: boolean;
  onUpdatePhoto?: (photoId: string, cropX: number, cropY: number, zoom?: number) => void;
  onUpdatePhotoFields?: (photoId: string, fields: Partial<PhotoItem>) => void;
}) {
  const sorted = [...photos].sort((a, b) => a.priority - b.priority);
  const gap = fillPage ? '0' : '2px';

  return (
    <div
      className="w-full h-full grid"
      style={{
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(4, 1fr)',
        gridAutoFlow: 'dense',
        gap,
      }}
    >
      {sorted.map((photo) => (
        <div
          key={photo.id}
          className={`overflow-hidden bg-gray-100 relative ${fillPage ? '' : 'rounded'}`}
          style={{
            gridColumn: `span ${Math.min(photo.colSpan ?? 1, 3)}`,
            gridRow: `span ${Math.min(photo.rowSpan ?? 1, 4)}`,
          }}
        >
          <DraggablePhoto
            photo={photo}
            onUpdatePhoto={onUpdatePhoto}
            gridMode
            onUpdatePhotoFields={onUpdatePhotoFields}
          />
        </div>
      ))}
    </div>
  );
}

function CustomPreview({
  photos,
  zones,
  fillPage,
  onUpdatePhoto,
}: {
  photos: PhotoItem[];
  zones: TemplateZone[];
  fillPage?: boolean;
  onUpdatePhoto?: (photoId: string, cropX: number, cropY: number) => void;
}) {
  const sorted = [...photos].sort((a, b) => a.priority - b.priority);
  const rawZones = [...zones].sort((a, b) => a.priority - b.priority);
  const sortedZones = fillPage && sorted.length < rawZones.length
    ? fillPageZones(rawZones, sorted.length)
    : rawZones;

  return (
    <div className="w-full h-full relative bg-gray-100 rounded">
      {sortedZones.map((zone, i) => {
        const photo = sorted[i];
        return (
          <div
            key={zone.id}
            style={{
              position: 'absolute',
              left: `${zone.x}%`,
              top: `${zone.y}%`,
              width: `${zone.width}%`,
              height: `${zone.height}%`,
              overflow: 'hidden',
            }}
            className="rounded bg-gray-300"
          >
            {photo ? (
              <DraggablePhoto photo={photo} onUpdatePhoto={onUpdatePhoto} />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-gray-400 text-xs">P{zone.priority}</span>
              </div>
            )}
          </div>
        );
      })}
      {sorted.length > sortedZones.length && (
        <div className="absolute bottom-1 right-1 bg-black bg-opacity-50 text-white text-xs rounded px-1">
          +{sorted.length - sortedZones.length}
        </div>
      )}
    </div>
  );
}

export default function PagePreview({ group, customTemplates, onUpdatePhoto, onUpdatePhotoFields }: Props) {
  if (group.photos.length === 0) {
    return (
      <div
        className="w-full flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200"
        style={{ aspectRatio: '11/8.5' }}
      >
        <p className="text-gray-300 text-xs">No photos</p>
      </div>
    );
  }

  const fillPage = group.fillPage;
  const paddingClass = fillPage ? 'p-0' : 'p-1';

  const renderLayout = () => {
    if (group.template === 'grid') return (
      <GridPreview
        photos={group.photos}
        fillPage={fillPage}
        onUpdatePhoto={onUpdatePhoto}
        onUpdatePhotoFields={onUpdatePhotoFields}
      />
    );
    if (group.template === 'focal') return <FocalPreview photos={group.photos} fillPage={fillPage} onUpdatePhoto={onUpdatePhoto} />;
    // Custom template
    const zones =
      group.templateZones ??
      customTemplates.find((t) => t.id === group.template)?.zones ??
      [];
    if (zones.length > 0) return <CustomPreview photos={group.photos} zones={zones} fillPage={fillPage} onUpdatePhoto={onUpdatePhoto} />;
    return <FocalPreview photos={group.photos} fillPage={fillPage} onUpdatePhoto={onUpdatePhoto} />;
  };

  return (
    <div
      className="w-full bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm"
      style={{ aspectRatio: '11/8.5' }}
    >
      {group.name && (
        <div className="px-2 py-1 border-b border-gray-100 text-xs font-semibold text-gray-600 text-center truncate">
          {group.name}
        </div>
      )}
      <div className={paddingClass} style={{ height: group.name ? 'calc(100% - 28px)' : '100%' }}>
        {renderLayout()}
      </div>
    </div>
  );
}
