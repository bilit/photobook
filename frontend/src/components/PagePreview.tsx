import type { PhotoGroup, PhotoItem, TemplateZone, CustomTemplate } from '../types';

interface Props {
  group: PhotoGroup;
  customTemplates: CustomTemplate[];
}

function FocalPreview({ photos }: { photos: PhotoItem[] }) {
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

  return (
    <div className="w-full h-full grid gap-0.5" style={getGridStyle()}>
      {sorted.map((photo, i) => (
        <div
          key={photo.id}
          className="overflow-hidden rounded bg-gray-200 relative"
          style={getPhotoStyle(i)}
        >
          <img src={photo.thumbnailUrl} alt={photo.filename} className="w-full h-full object-cover" />
          <div className="absolute top-1 left-1 bg-white bg-opacity-80 text-xs font-bold text-gray-700 rounded px-1">
            {photo.priority}
          </div>
        </div>
      ))}
    </div>
  );
}

function GridPreview({ photos }: { photos: PhotoItem[] }) {
  const sorted = [...photos].sort((a, b) => a.priority - b.priority);
  const n = sorted.length;
  const cols = Math.ceil(Math.sqrt(n));

  return (
    <div
      className="w-full h-full grid gap-0.5"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridAutoRows: '1fr' }}
    >
      {sorted.map((photo) => (
        <div key={photo.id} className="overflow-hidden rounded bg-gray-200 relative">
          <img src={photo.thumbnailUrl} alt={photo.filename} className="w-full h-full object-cover" />
          <div className="absolute top-1 left-1 bg-white bg-opacity-80 text-xs font-bold text-gray-700 rounded px-1">
            {photo.priority}
          </div>
        </div>
      ))}
    </div>
  );
}

function CustomPreview({ photos, zones }: { photos: PhotoItem[]; zones: TemplateZone[] }) {
  const sorted = [...photos].sort((a, b) => a.priority - b.priority);
  const sortedZones = [...zones].sort((a, b) => a.priority - b.priority);

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
                <img src={photo.thumbnailUrl} alt={photo.filename} className="w-full h-full object-cover" />
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
        style={{ aspectRatio: '210/297' }}
      >
        <p className="text-gray-300 text-xs">No photos</p>
      </div>
    );
  }

  const renderLayout = () => {
    if (group.template === 'grid') return <GridPreview photos={group.photos} />;
    if (group.template === 'focal') return <FocalPreview photos={group.photos} />;
    // Custom template
    const zones =
      group.templateZones ??
      customTemplates.find((t) => t.id === group.template)?.zones ??
      [];
    if (zones.length > 0) return <CustomPreview photos={group.photos} zones={zones} />;
    return <FocalPreview photos={group.photos} />;
  };

  return (
    <div
      className="w-full bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm"
      style={{ aspectRatio: '210/297' }}
    >
      {group.name && (
        <div className="px-2 py-1 border-b border-gray-100 text-xs font-semibold text-gray-600 text-center truncate">
          {group.name}
        </div>
      )}
      <div className="p-1" style={{ height: group.name ? 'calc(100% - 28px)' : '100%' }}>
        {renderLayout()}
      </div>
    </div>
  );
}
