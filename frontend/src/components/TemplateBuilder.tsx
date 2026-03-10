import { useState, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { TemplateZone, CustomTemplate } from '../types';
import { saveTemplate } from '../templateStore';

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

type Interaction =
  | { type: 'draw'; startX: number; startY: number }
  | { type: 'move'; zoneId: string; startX: number; startY: number; origX: number; origY: number }
  | { type: 'resize'; zoneId: string; handle: ResizeHandle; startX: number; startY: number; origZone: TemplateZone };

interface Props {
  onSave: (template: CustomTemplate) => void;
  onClose: () => void;
  initialTemplate?: CustomTemplate;
}

const RESIZE_HANDLES: { handle: ResizeHandle; cursor: string; style: React.CSSProperties }[] = [
  { handle: 'nw', cursor: 'nw-resize', style: { top: -5, left: -5 } },
  { handle: 'n',  cursor: 'n-resize',  style: { top: -5, left: '50%', transform: 'translateX(-50%)' } },
  { handle: 'ne', cursor: 'ne-resize', style: { top: -5, right: -5 } },
  { handle: 'e',  cursor: 'e-resize',  style: { top: '50%', right: -5, transform: 'translateY(-50%)' } },
  { handle: 'se', cursor: 'se-resize', style: { bottom: -5, right: -5 } },
  { handle: 's',  cursor: 's-resize',  style: { bottom: -5, left: '50%', transform: 'translateX(-50%)' } },
  { handle: 'sw', cursor: 'sw-resize', style: { bottom: -5, left: -5 } },
  { handle: 'w',  cursor: 'w-resize',  style: { top: '50%', left: -5, transform: 'translateY(-50%)' } },
];

export default function TemplateBuilder({ onSave, onClose, initialTemplate }: Props) {
  const [zones, setZones] = useState<TemplateZone[]>(initialTemplate?.zones ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState(initialTemplate?.name ?? 'My Template');
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [currentDraw, setCurrentDraw] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const getPercent = (e: React.MouseEvent): { x: number; y: number } => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
    };
  };

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target !== canvasRef.current) return;
    e.preventDefault();
    const { x, y } = getPercent(e);
    setSelectedId(null);
    setInteraction({ type: 'draw', startX: x, startY: y });
  };

  const handleZoneMouseDown = (e: React.MouseEvent, zoneId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const { x, y } = getPercent(e);
    const zone = zones.find((z) => z.id === zoneId);
    if (!zone) return;
    setSelectedId(zoneId);
    setInteraction({ type: 'move', zoneId, startX: x, startY: y, origX: zone.x, origY: zone.y });
  };

  const handleResizeMouseDown = (e: React.MouseEvent, zoneId: string, handle: ResizeHandle) => {
    e.preventDefault();
    e.stopPropagation();
    const { x, y } = getPercent(e);
    const zone = zones.find((z) => z.id === zoneId);
    if (!zone) return;
    setInteraction({ type: 'resize', zoneId, handle, startX: x, startY: y, origZone: { ...zone } });
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!interaction) return;
    e.preventDefault();
    const { x, y } = getPercent(e);

    if (interaction.type === 'draw') {
      const rx = Math.min(x, interaction.startX);
      const ry = Math.min(y, interaction.startY);
      const rw = Math.abs(x - interaction.startX);
      const rh = Math.abs(y - interaction.startY);
      setCurrentDraw({ x: rx, y: ry, w: rw, h: rh });
    } else if (interaction.type === 'move') {
      const dx = x - interaction.startX;
      const dy = y - interaction.startY;
      setZones((prev) =>
        prev.map((z) => {
          if (z.id !== interaction.zoneId) return z;
          return {
            ...z,
            x: clamp(interaction.origX + dx, 0, 100 - z.width),
            y: clamp(interaction.origY + dy, 0, 100 - z.height),
          };
        })
      );
    } else if (interaction.type === 'resize') {
      const { handle, origZone } = interaction;
      const dx = x - interaction.startX;
      const dy = y - interaction.startY;
      setZones((prev) =>
        prev.map((z) => {
          if (z.id !== interaction.zoneId) return z;
          let { x: zx, y: zy, width: zw, height: zh } = origZone;
          if (handle.includes('e')) zw = clamp(origZone.width + dx, 5, 100 - origZone.x);
          if (handle.includes('s')) zh = clamp(origZone.height + dy, 5, 100 - origZone.y);
          if (handle.includes('w')) {
            const newX = clamp(origZone.x + dx, 0, origZone.x + origZone.width - 5);
            zw = origZone.width + origZone.x - newX;
            zx = newX;
          }
          if (handle.includes('n')) {
            const newY = clamp(origZone.y + dy, 0, origZone.y + origZone.height - 5);
            zh = origZone.height + origZone.y - newY;
            zy = newY;
          }
          return { ...z, x: zx, y: zy, width: zw, height: zh };
        })
      );
    }
  }, [interaction]);

  const handleMouseUp = useCallback(() => {
    if (interaction?.type === 'draw' && currentDraw) {
      if (currentDraw.w > 3 && currentDraw.h > 3) {
        const nextPriority = zones.length + 1;
        const newZone: TemplateZone = {
          id: uuidv4(),
          x: currentDraw.x,
          y: currentDraw.y,
          width: currentDraw.w,
          height: currentDraw.h,
          priority: nextPriority,
        };
        setZones((prev) => [...prev, newZone]);
        setSelectedId(newZone.id);
      }
      setCurrentDraw(null);
    }
    setInteraction(null);
  }, [interaction, currentDraw, zones]);

  const deleteZone = (id: string) => {
    setZones((prev) => prev.filter((z) => z.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const changePriority = (id: string, priority: number) => {
    setZones((prev) => prev.map((z) => (z.id === id ? { ...z, priority } : z)));
  };

  const handleSave = () => {
    if (zones.length === 0) {
      alert('Please draw at least one zone on the canvas.');
      return;
    }
    const template = saveTemplate(templateName, zones);
    onSave(template);
    onClose();
  };

  const selectedZone = zones.find((z) => z.id === selectedId);
  const sortedZones = [...zones].sort((a, b) => a.priority - b.priority);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div
        className="bg-white rounded-xl shadow-2xl flex flex-col"
        style={{ width: '92vw', maxWidth: 1100, height: '92vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Template Builder</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Click and drag on the page to draw photo zones. Drag to move, drag handles to resize.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-light">
            ×
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Canvas area */}
          <div className="flex-1 bg-gray-100 flex items-center justify-center p-6 overflow-hidden">
            {/* A4 canvas */}
            <div
              ref={canvasRef}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="bg-white shadow-xl relative select-none flex-shrink-0"
              style={{
                aspectRatio: '210 / 297',
                height: '100%',
                maxHeight: '100%',
                cursor: 'crosshair',
                userSelect: 'none',
              }}
            >
              {/* Grid overlay */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)',
                  backgroundSize: '10% 10%',
                }}
              />

              {/* Zones */}
              {zones.map((zone) => {
                const isSelected = zone.id === selectedId;
                return (
                  <div
                    key={zone.id}
                    onMouseDown={(e) => handleZoneMouseDown(e, zone.id)}
                    style={{
                      position: 'absolute',
                      left: `${zone.x}%`,
                      top: `${zone.y}%`,
                      width: `${zone.width}%`,
                      height: `${zone.height}%`,
                      background: isSelected ? 'rgba(59,130,246,0.22)' : 'rgba(59,130,246,0.10)',
                      border: `2px solid ${isSelected ? '#2563eb' : '#93c5fd'}`,
                      borderRadius: 3,
                      cursor: 'move',
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* Priority label */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="bg-blue-600 text-white text-xs font-bold rounded px-1.5 py-0.5 shadow">
                        P{zone.priority}
                      </span>
                    </div>

                    {/* Resize handles (only when selected) */}
                    {isSelected &&
                      RESIZE_HANDLES.map(({ handle, cursor, style: hStyle }) => (
                        <div
                          key={handle}
                          onMouseDown={(e) => handleResizeMouseDown(e, zone.id, handle)}
                          style={{
                            position: 'absolute',
                            width: 10,
                            height: 10,
                            background: '#2563eb',
                            border: '2px solid white',
                            borderRadius: 2,
                            cursor,
                            ...hStyle,
                          }}
                        />
                      ))}
                  </div>
                );
              })}

              {/* Drawing preview */}
              {currentDraw && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${currentDraw.x}%`,
                    top: `${currentDraw.y}%`,
                    width: `${currentDraw.w}%`,
                    height: `${currentDraw.h}%`,
                    background: 'rgba(59,130,246,0.12)',
                    border: '2px dashed #3b82f6',
                    borderRadius: 3,
                    pointerEvents: 'none',
                  }}
                />
              )}
            </div>
          </div>

          {/* Side panel */}
          <div className="w-64 border-l border-gray-200 flex flex-col p-4 gap-4 overflow-y-auto flex-shrink-0">
            {/* Template name */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Template Name
              </label>
              <input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                placeholder="My Template"
              />
            </div>

            {/* Zone list */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Zones ({zones.length})
                </label>
                {zones.length > 0 && (
                  <button
                    onClick={() => { setZones([]); setSelectedId(null); }}
                    className="text-xs text-red-400 hover:text-red-600 font-medium"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {zones.length === 0 ? (
                <p className="text-xs text-gray-400 italic">
                  Draw zones on the canvas by clicking and dragging.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {sortedZones.map((zone) => (
                    <div
                      key={zone.id}
                      onClick={() => setSelectedId(zone.id)}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                        selectedId === zone.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">
                        {zone.priority}
                      </div>
                      <span className="flex-1 text-xs text-gray-600">
                        {zone.width.toFixed(0)}% × {zone.height.toFixed(0)}%
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteZone(zone.id); }}
                        className="text-gray-300 hover:text-red-500 text-sm font-bold transition-colors"
                        title="Delete zone"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected zone properties */}
            {selectedZone && (
              <div className="border-t border-gray-100 pt-4">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Zone Properties
                </label>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">
                      Priority <span className="text-gray-400">(1 = first photo)</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={selectedZone.priority}
                      onChange={(e) =>
                        changePriority(
                          selectedZone.id,
                          Math.max(1, parseInt(e.target.value) || 1)
                        )
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                    <div>X: {selectedZone.x.toFixed(1)}%</div>
                    <div>Y: {selectedZone.y.toFixed(1)}%</div>
                    <div>W: {selectedZone.width.toFixed(1)}%</div>
                    <div>H: {selectedZone.height.toFixed(1)}%</div>
                  </div>
                  <button
                    onClick={() => deleteZone(selectedZone.id)}
                    className="w-full text-sm text-red-500 hover:text-red-700 py-1.5 border border-red-200 rounded-lg hover:border-red-400 transition-colors"
                  >
                    Delete Zone
                  </button>
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="text-xs text-gray-400 space-y-1 border-t border-gray-100 pt-3">
              <p>• Drag on canvas to draw a zone</p>
              <p>• Drag a zone to move it</p>
              <p>• Drag handles to resize</p>
              <p>• Priority 1 = largest/first photo</p>
            </div>

            {/* Save */}
            <button
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm flex-shrink-0"
            >
              Save Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
