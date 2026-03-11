import { useState, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { TemplateZone, CustomTemplate } from '../types';
import { saveTemplate, updateTemplate } from '../templateStore';

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
  { handle: 'nw', cursor: 'nw-resize', style: { top: -6, left: -6 } },
  { handle: 'n',  cursor: 'n-resize',  style: { top: -6, left: '50%', transform: 'translateX(-50%)' } },
  { handle: 'ne', cursor: 'ne-resize', style: { top: -6, right: -6 } },
  { handle: 'e',  cursor: 'e-resize',  style: { top: '50%', right: -6, transform: 'translateY(-50%)' } },
  { handle: 'se', cursor: 'se-resize', style: { bottom: -6, right: -6 } },
  { handle: 's',  cursor: 's-resize',  style: { bottom: -6, left: '50%', transform: 'translateX(-50%)' } },
  { handle: 'sw', cursor: 'sw-resize', style: { bottom: -6, left: -6 } },
  { handle: 'w',  cursor: 'w-resize',  style: { top: '50%', left: -6, transform: 'translateY(-50%)' } },
];

export default function TemplateBuilder({ onSave, onClose, initialTemplate }: Props) {
  const [zones, setZones] = useState<TemplateZone[]>(initialTemplate?.zones ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState(initialTemplate?.name ?? 'My Template');
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [currentDraw, setCurrentDraw] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [showControls, setShowControls] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);

  const getPercent = (clientX: number, clientY: number): { x: number; y: number } => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
    };
  };

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  // --- Mouse handlers ---

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target !== canvasRef.current) return;
    e.preventDefault();
    const { x, y } = getPercent(e.clientX, e.clientY);
    setSelectedId(null);
    setInteraction({ type: 'draw', startX: x, startY: y });
  };

  const handleZoneMouseDown = (e: React.MouseEvent, zoneId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const { x, y } = getPercent(e.clientX, e.clientY);
    const zone = zones.find((z) => z.id === zoneId);
    if (!zone) return;
    setSelectedId(zoneId);
    setInteraction({ type: 'move', zoneId, startX: x, startY: y, origX: zone.x, origY: zone.y });
  };

  const handleResizeMouseDown = (e: React.MouseEvent, zoneId: string, handle: ResizeHandle) => {
    e.preventDefault();
    e.stopPropagation();
    const { x, y } = getPercent(e.clientX, e.clientY);
    const zone = zones.find((z) => z.id === zoneId);
    if (!zone) return;
    setInteraction({ type: 'resize', zoneId, handle, startX: x, startY: y, origZone: { ...zone } });
  };

  // --- Shared interaction logic ---

  const applyInteraction = useCallback((x: number, y: number, currentInteraction: Interaction) => {
    if (currentInteraction.type === 'draw') {
      const rx = Math.min(x, currentInteraction.startX);
      const ry = Math.min(y, currentInteraction.startY);
      const rw = Math.abs(x - currentInteraction.startX);
      const rh = Math.abs(y - currentInteraction.startY);
      setCurrentDraw({ x: rx, y: ry, w: rw, h: rh });
    } else if (currentInteraction.type === 'move') {
      const dx = x - currentInteraction.startX;
      const dy = y - currentInteraction.startY;
      setZones((prev) =>
        prev.map((z) => {
          if (z.id !== currentInteraction.zoneId) return z;
          return {
            ...z,
            x: clamp(currentInteraction.origX + dx, 0, 100 - z.width),
            y: clamp(currentInteraction.origY + dy, 0, 100 - z.height),
          };
        })
      );
    } else if (currentInteraction.type === 'resize') {
      const { handle, origZone } = currentInteraction;
      const dx = x - currentInteraction.startX;
      const dy = y - currentInteraction.startY;
      setZones((prev) =>
        prev.map((z) => {
          if (z.id !== currentInteraction.zoneId) return z;
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
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!interaction) return;
    e.preventDefault();
    const { x, y } = getPercent(e.clientX, e.clientY);
    applyInteraction(x, y, interaction);
  }, [interaction, applyInteraction]);

  const finalizeInteraction = useCallback((currentInteraction: Interaction | null, draw: typeof currentDraw) => {
    if (currentInteraction?.type === 'draw' && draw) {
      if (draw.w > 3 && draw.h > 3) {
        const nextPriority = zones.length + 1;
        const newZone: TemplateZone = {
          id: uuidv4(),
          x: draw.x,
          y: draw.y,
          width: draw.w,
          height: draw.h,
          priority: nextPriority,
        };
        setZones((prev) => [...prev, newZone]);
        setSelectedId(newZone.id);
      }
      setCurrentDraw(null);
    }
    setInteraction(null);
  }, [zones.length]);

  const handleMouseUp = useCallback(() => {
    finalizeInteraction(interaction, currentDraw);
  }, [interaction, currentDraw, finalizeInteraction]);

  // --- Touch handlers ---

  const handleCanvasTouchStart = (e: React.TouchEvent) => {
    if (e.target !== canvasRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const { x, y } = getPercent(touch.clientX, touch.clientY);
    setSelectedId(null);
    setInteraction({ type: 'draw', startX: x, startY: y });
  };

  const handleZoneTouchStart = (e: React.TouchEvent, zoneId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    const { x, y } = getPercent(touch.clientX, touch.clientY);
    const zone = zones.find((z) => z.id === zoneId);
    if (!zone) return;
    setSelectedId(zoneId);
    setInteraction({ type: 'move', zoneId, startX: x, startY: y, origX: zone.x, origY: zone.y });
  };

  const handleResizeTouchStart = (e: React.TouchEvent, zoneId: string, handle: ResizeHandle) => {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    const { x, y } = getPercent(touch.clientX, touch.clientY);
    const zone = zones.find((z) => z.id === zoneId);
    if (!zone) return;
    setInteraction({ type: 'resize', zoneId, handle, startX: x, startY: y, origZone: { ...zone } });
  };

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!interaction) return;
    e.preventDefault();
    const touch = e.touches[0];
    const { x, y } = getPercent(touch.clientX, touch.clientY);
    applyInteraction(x, y, interaction);
  }, [interaction, applyInteraction]);

  const handleTouchEnd = useCallback(() => {
    finalizeInteraction(interaction, currentDraw);
  }, [interaction, currentDraw, finalizeInteraction]);

  // --- Zone management ---

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
    if (initialTemplate) {
      const updated = { ...initialTemplate, name: templateName.trim() || 'My Template', zones };
      updateTemplate(updated);
      onSave(updated);
    } else {
      const template = saveTemplate(templateName, zones);
      onSave(template);
    }
    onClose();
  };

  const selectedZone = zones.find((z) => z.id === selectedId);
  const sortedZones = [...zones].sort((a, b) => a.priority - b.priority);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black bg-opacity-60">
      <div
        className="bg-white flex flex-col w-full rounded-t-2xl sm:rounded-xl shadow-2xl"
        style={{ height: '95vh', maxWidth: 1100 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex-shrink-0">
          <div className="min-w-0 flex-1 mr-4">
            <h2 className="text-base sm:text-lg font-bold text-gray-800 truncate">
              {initialTemplate ? 'Edit Template' : 'Template Builder'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">
              Click and drag on the page to draw photo zones. Drag to move, drag handles to resize.
            </p>
            <p className="text-xs text-gray-400 mt-0.5 sm:hidden">
              Tap and drag to draw zones
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Mobile controls toggle */}
            <button
              onClick={() => setShowControls((v) => !v)}
              className="sm:hidden text-xs font-medium text-blue-600 border border-blue-200 rounded-lg px-2.5 py-1.5"
            >
              {showControls ? 'Hide controls' : 'Show controls'}
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-light leading-none">
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col sm:flex-row flex-1 overflow-hidden min-h-0">
          {/* Canvas area */}
          <div className="flex-1 bg-gray-100 flex items-center justify-center p-3 sm:p-6 overflow-auto sm:overflow-hidden min-h-0">
            <div
              ref={canvasRef}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleCanvasTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="bg-white shadow-xl relative select-none w-full sm:w-auto sm:h-full flex-shrink-0"
              style={{
                aspectRatio: '11 / 8.5',
                cursor: 'crosshair',
                userSelect: 'none',
                touchAction: 'none',
                maxHeight: '100%',
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
                    onTouchStart={(e) => handleZoneTouchStart(e, zone.id)}
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
                      touchAction: 'none',
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
                          onTouchStart={(e) => handleResizeTouchStart(e, zone.id, handle)}
                          style={{
                            position: 'absolute',
                            width: 12,
                            height: 12,
                            background: '#2563eb',
                            border: '2px solid white',
                            borderRadius: 2,
                            cursor,
                            touchAction: 'none',
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

          {/* Side / bottom panel */}
          <div
            className={`${
              showControls ? 'flex' : 'hidden sm:flex'
            } sm:flex w-full sm:w-64 border-t sm:border-t-0 sm:border-l border-gray-200 flex-col p-4 gap-4 overflow-y-auto flex-shrink-0`}
            style={{ maxHeight: '45vh', minHeight: 0 }}
          >
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
            <div className="flex-1 min-h-0">
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

            {/* Instructions — hidden on very small screens to save space */}
            <div className="text-xs text-gray-400 space-y-1 border-t border-gray-100 pt-3 hidden sm:block">
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
              {initialTemplate ? 'Update Template' : 'Save Template'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
