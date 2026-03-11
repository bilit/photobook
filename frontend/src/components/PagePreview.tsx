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
  selectedPhotoId?: string | null;
  onSelectPhoto?: (photoId: string) => void;
}

/** A small stepper badge with − value + buttons. */
function StepBadge({
  label,
  value,
  min,
  max,
  onDecrement,
  onIncrement,
}: {
  label?: string;
  value: number;
  min: number;
  max: number;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  const btnClass = 'text-white leading-none px-1 py-0.5 hover:bg-white hover:bg-opacity-25 transition-colors select-none';
  return (
    <div
      className="flex items-center bg-black bg-opacity-60 rounded text-xs font-bold overflow-hidden"
      data-overlay
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        className={`${btnClass} rounded-l ${value <= min ? 'opacity-30 cursor-default' : 'cursor-pointer'}`}
        onClick={(e) => { e.stopPropagation(); if (value > min) onDecrement(); }}
      >−</button>
      <span className="text-white px-0.5">{label}{value}</span>
      <button
        className={`${btnClass} rounded-r ${value >= max ? 'opacity-30 cursor-default' : 'cursor-pointer'}`}
        onClick={(e) => { e.stopPropagation(); if (value < max) onIncrement(); }}
      >+</button>
    </div>
  );
}

/** A photo slot that supports drag-to-pan, scroll-to-zoom, and (in grid mode) editable order/span overlays. */
function DraggablePhoto({
  photo,
  onUpdatePhoto,
  gridMode,
  onUpdatePhotoFields,
  isSelected,
  onSelectPhoto,
}: {
  photo: PhotoItem;
  onUpdatePhoto?: (photoId: string, cropX: number, cropY: number, zoom?: number) => void;
  gridMode?: boolean;
  onUpdatePhotoFields?: (photoId: string, fields: Partial<PhotoItem>) => void;
  isSelected?: boolean;
  onSelectPhoto?: (photoId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    startX: number;
    startY: number;
    startCropX: number;
    startCropY: number;
  } | null>(null);

  const cropX = photo.cropX ?? 50;
  const cropY = photo.cropY ?? 50;
  const zoom = photo.zoom ?? 1;
  const colSpan = photo.colSpan ?? 1;
  const rowSpan = photo.rowSpan ?? 1;

  const step = (field: 'priority' | 'colSpan' | 'rowSpan', delta: number) => {
    if (!onUpdatePhotoFields) return;
    const current = field === 'priority' ? photo.priority : field === 'colSpan' ? colSpan : rowSpan;
    const max = field === 'priority' ? 99 : field === 'colSpan' ? 3 : 4;
    const next = Math.max(1, Math.min(max, current + delta));
    onUpdatePhotoFields(photo.id, { [field]: next });
  };

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

    const handleMouseUp = (ev: MouseEvent) => {
      if (dragState.current) {
        const dx = ev.clientX - dragState.current.startX;
        const dy = ev.clientY - dragState.current.startY;
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
          onSelectPhoto?.(photo.id);
        }
      }
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

  const badgeBase = 'bg-black bg-opacity-60 text-white text-xs font-bold rounded px-1 leading-none py-0.5 select-none';

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

      {/* Selected ring */}
      {isSelected && (
        <div className="absolute inset-0 ring-2 ring-inset ring-blue-400 pointer-events-none z-20" />
      )}

      {/* Priority badge — top-left */}
      <div className="absolute top-1 left-1 z-10">
        {gridMode && onUpdatePhotoFields ? (
          <StepBadge
            value={photo.priority}
            min={1}
            max={99}
            onDecrement={() => step('priority', -1)}
            onIncrement={() => step('priority', 1)}
          />
        ) : (
          <div className={badgeBase}>{photo.priority}</div>
        )}
      </div>

      {/* Zoom indicator — top-right in grid mode, bottom-right otherwise */}
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
      {gridMode && onUpdatePhotoFields && (
        <>
          <div className="absolute bottom-1 left-1 z-10">
            <StepBadge
              label="↔"
              value={colSpan}
              min={1}
              max={3}
              onDecrement={() => step('colSpan', -1)}
              onIncrement={() => step('colSpan', 1)}
            />
          </div>
          <div className="absolute bottom-1 right-1 z-10">
            <StepBadge
              label="↕"
              value={rowSpan}
              min={1}
              max={4}
              onDecrement={() => step('rowSpan', -1)}
              onIncrement={() => step('rowSpan', 1)}
            />
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
  selectedPhotoId,
  onSelectPhoto,
}: {
  photos: PhotoItem[];
  fillPage?: boolean;
  onUpdatePhoto?: (photoId: string, cropX: number, cropY: number) => void;
  selectedPhotoId?: string | null;
  onSelectPhoto?: (photoId: string) => void;
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
          <DraggablePhoto
            photo={photo}
            onUpdatePhoto={onUpdatePhoto}
            isSelected={selectedPhotoId === photo.id}
            onSelectPhoto={onSelectPhoto}
          />
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
  selectedPhotoId,
  onSelectPhoto,
}: {
  photos: PhotoItem[];
  fillPage?: boolean;
  onUpdatePhoto?: (photoId: string, cropX: number, cropY: number, zoom?: number) => void;
  onUpdatePhotoFields?: (photoId: string, fields: Partial<PhotoItem>) => void;
  selectedPhotoId?: string | null;
  onSelectPhoto?: (photoId: string) => void;
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
            isSelected={selectedPhotoId === photo.id}
            onSelectPhoto={onSelectPhoto}
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
  selectedPhotoId,
  onSelectPhoto,
}: {
  photos: PhotoItem[];
  zones: TemplateZone[];
  fillPage?: boolean;
  onUpdatePhoto?: (photoId: string, cropX: number, cropY: number) => void;
  selectedPhotoId?: string | null;
  onSelectPhoto?: (photoId: string) => void;
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
              <DraggablePhoto
                photo={photo}
                onUpdatePhoto={onUpdatePhoto}
                isSelected={selectedPhotoId === photo.id}
                onSelectPhoto={onSelectPhoto}
              />
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

export default function PagePreview({ group, customTemplates, onUpdatePhoto, onUpdatePhotoFields, selectedPhotoId, onSelectPhoto }: Props) {
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
        selectedPhotoId={selectedPhotoId}
        onSelectPhoto={onSelectPhoto}
      />
    );
    if (group.template === 'focal') return (
      <FocalPreview
        photos={group.photos}
        fillPage={fillPage}
        onUpdatePhoto={onUpdatePhoto}
        selectedPhotoId={selectedPhotoId}
        onSelectPhoto={onSelectPhoto}
      />
    );
    // Custom template
    const zones =
      group.templateZones ??
      customTemplates.find((t) => t.id === group.template)?.zones ??
      [];
    if (zones.length > 0) return (
      <CustomPreview
        photos={group.photos}
        zones={zones}
        fillPage={fillPage}
        onUpdatePhoto={onUpdatePhoto}
        selectedPhotoId={selectedPhotoId}
        onSelectPhoto={onSelectPhoto}
      />
    );
    return (
      <FocalPreview
        photos={group.photos}
        fillPage={fillPage}
        onUpdatePhoto={onUpdatePhoto}
        selectedPhotoId={selectedPhotoId}
        onSelectPhoto={onSelectPhoto}
      />
    );
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
