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
}

function FocalPreview({ photos, fillPage }: { photos: PhotoItem[]; fillPage?: boolean }) {
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
          <img src={photo.thumbnailUrl} alt={photo.filename} className="w-full h-full object-contain" />
          <div className="absolute top-1 left-1 bg-white bg-opacity-80 text-xs font-bold text-gray-700 rounded px-1">
            {photo.priority}
          </div>
        </div>
      ))}
    </div>
  );
}

function GridPreview({ photos, fillPage }: { photos: PhotoItem[]; fillPage?: boolean }) {
  const sorted = [...photos].sort((a, b) => a.priority - b.priority);
  const n = sorted.length;
  const cols = Math.ceil(Math.sqrt(n));
  const gap = fillPage ? '0' : '2px';

  return (
    <div
      className="w-full h-full grid"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridAutoRows: '1fr', gap }}
    >
      {sorted.map((photo) => (
        <div key={photo.id} className={`overflow-hidden bg-gray-100 relative ${fillPage ? '' : 'rounded'}`}>
          <img src={photo.thumbnailUrl} alt={photo.filename} className="w-full h-full object-contain" />
          <div className="absolute top-1 left-1 bg-white bg-opacity-80 text-xs font-bold text-gray-700 rounded px-1">
            {photo.priority}
          </div>
        </div>
      ))}
    </div>
  );
}

function CustomPreview({ photos, zones, fillPage }: { photos: PhotoItem[]; zones: TemplateZone[]; fillPage?: boolean }) {
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
              <>
                <img src={photo.thumbnailUrl} alt={photo.filename} className="w-full h-full object-contain" />
                <div className="absolute top-1 left-1 bg-white bg-opacity-80 text-xs font-bold text-gray-700 rounded px-1">
                  {photo.priority}
                </div>
              </>
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

export default function PagePreview({ group, customTemplates }: Props) {
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

  const isBuiltIn = group.template === 'focal' || group.template === 'grid';
  const fillPage = group.fillPage;
  // For built-in templates with fillPage, remove padding for edge-to-edge bleed
  const paddingClass = isBuiltIn && fillPage ? 'p-0' : 'p-1';

  const renderLayout = () => {
    if (group.template === 'grid') return <GridPreview photos={group.photos} fillPage={fillPage} />;
    if (group.template === 'focal') return <FocalPreview photos={group.photos} fillPage={fillPage} />;
    // Custom template
    const zones =
      group.templateZones ??
      customTemplates.find((t) => t.id === group.template)?.zones ??
      [];
    if (zones.length > 0) return <CustomPreview photos={group.photos} zones={zones} fillPage={fillPage} />;
    return <FocalPreview photos={group.photos} fillPage={fillPage} />;
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
