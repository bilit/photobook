import { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { PhotoItem, PhotoGroup } from '../types';

// ── Helpers ────────────────────────────────────────────────────────────────

function getDateKey(photo: PhotoItem): string {
  if (!photo.createdAt) return 'unknown';
  const d = new Date(photo.createdAt);
  if (isNaN(d.getTime())) return 'unknown';
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function formatDateKey(dateKey: string): string {
  if (dateKey === 'unknown') return 'Unknown Date';
  const [year, month, day] = dateKey.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** Distribute `count` items across `pagesCount` pages, round-robin style */
function evenAssignments(count: number, pagesCount: number): number[] {
  if (pagesCount <= 1) return Array(count).fill(0);
  return Array.from({ length: count }, (_, i) => Math.floor((i * pagesCount) / count));
}

// ── Types ──────────────────────────────────────────────────────────────────

interface MergeGroup {
  /** One or more date keys combined into this logical group */
  dateKeys: string[];
  pagesCount: number;
  /** pageIndex assignment per photo (parallel to combined photos array) */
  assignments: number[];
}

// ── Sub-component: photo card with optional prev/next arrows ───────────────

function PhotoCard({
  photo,
  pagesCount,
  onMoveLeft,
  onMoveRight,
}: {
  photo: PhotoItem;
  pagesCount: number;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
}) {
  return (
    <div className="relative group flex-shrink-0">
      <img
        src={photo.thumbnailUrl || photo.url}
        alt={photo.filename}
        className="w-14 h-14 object-cover rounded-lg border border-gray-200"
      />
      {pagesCount > 1 && (onMoveLeft || onMoveRight) && (
        <div className="absolute inset-0 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity rounded-lg overflow-hidden">
          {onMoveLeft ? (
            <button
              onClick={onMoveLeft}
              className="bg-black/60 hover:bg-black/80 text-white h-full px-1 flex items-center text-xs transition-colors"
              title="Move to previous page"
            >
              ←
            </button>
          ) : (
            <div />
          )}
          {onMoveRight ? (
            <button
              onClick={onMoveRight}
              className="bg-black/60 hover:bg-black/80 text-white h-full px-1 flex items-center text-xs transition-colors"
              title="Move to next page"
            >
              →
            </button>
          ) : (
            <div />
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

interface Props {
  importedPhotos: PhotoItem[];
  onApply: (groups: PhotoGroup[]) => void;
  onClose: () => void;
}

export default function PagesByDateModal({ importedPhotos, onApply, onClose }: Props) {
  // Sort all photos chronologically
  const sortedPhotos = useMemo(
    () =>
      [...importedPhotos].sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return da - db;
      }),
    [importedPhotos]
  );

  // Map of dateKey → photos
  const photosByDate = useMemo(() => {
    const map = new Map<string, PhotoItem[]>();
    for (const photo of sortedPhotos) {
      const key = getDateKey(photo);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(photo);
    }
    return map;
  }, [sortedPhotos]);

  const sortedDateKeys = useMemo(
    () =>
      Array.from(photosByDate.keys()).sort((a, b) => {
        if (a === 'unknown') return 1;
        if (b === 'unknown') return -1;
        return a.localeCompare(b);
      }),
    [photosByDate]
  );

  // Whether to append or replace existing pages
  const [replaceExisting, setReplaceExisting] = useState(false);

  // Merge groups state — one entry per logical date group
  const [mergeGroups, setMergeGroups] = useState<MergeGroup[]>(() =>
    sortedDateKeys.map((dateKey) => {
      const photos = photosByDate.get(dateKey) ?? [];
      return { dateKeys: [dateKey], pagesCount: 1, assignments: evenAssignments(photos.length, 1) };
    })
  );

  // Helper: get combined photos for a merge group (stable order)
  const getGroupPhotos = (group: MergeGroup): PhotoItem[] =>
    group.dateKeys.flatMap((dk) => photosByDate.get(dk) ?? []);

  // ── Mutations ────────────────────────────────────────────────────────────

  const setPageCount = (groupIdx: number, delta: number) => {
    setMergeGroups((prev) =>
      prev.map((g, i) => {
        if (i !== groupIdx) return g;
        const photos = getGroupPhotos(g);
        const newCount = Math.max(1, Math.min(g.pagesCount + delta, Math.max(1, photos.length)));
        return { ...g, pagesCount: newCount, assignments: evenAssignments(photos.length, newCount) };
      })
    );
  };

  const movePhoto = (groupIdx: number, photoIdx: number, direction: -1 | 1) => {
    setMergeGroups((prev) =>
      prev.map((g, i) => {
        if (i !== groupIdx) return g;
        const newAssignments = [...g.assignments];
        const cur = newAssignments[photoIdx] ?? 0;
        newAssignments[photoIdx] = Math.max(0, Math.min(g.pagesCount - 1, cur + direction));
        return { ...g, assignments: newAssignments };
      })
    );
  };

  const mergeWithNext = (groupIdx: number) => {
    setMergeGroups((prev) => {
      if (groupIdx >= prev.length - 1) return prev;
      const cur = prev[groupIdx];
      const next = prev[groupIdx + 1];
      const combinedPhotoCount = getGroupPhotos(cur).length + getGroupPhotos(next).length;
      const combined: MergeGroup = {
        dateKeys: [...cur.dateKeys, ...next.dateKeys],
        pagesCount: cur.pagesCount,
        assignments: evenAssignments(combinedPhotoCount, cur.pagesCount),
      };
      const newGroups = [...prev];
      newGroups.splice(groupIdx, 2, combined);
      return newGroups;
    });
  };

  const splitGroup = (groupIdx: number) => {
    setMergeGroups((prev) => {
      const group = prev[groupIdx];
      if (group.dateKeys.length < 2) return prev;

      const firstKeys = group.dateKeys.slice(0, -1);
      const lastKey = group.dateKeys[group.dateKeys.length - 1];
      const firstCount = firstKeys.flatMap((dk) => photosByDate.get(dk) ?? []).length;
      const lastCount = (photosByDate.get(lastKey) ?? []).length;

      const firstGroup: MergeGroup = {
        dateKeys: firstKeys,
        pagesCount: group.pagesCount,
        assignments: evenAssignments(firstCount, group.pagesCount),
      };
      const lastGroup: MergeGroup = {
        dateKeys: [lastKey],
        pagesCount: 1,
        assignments: evenAssignments(lastCount, 1),
      };

      const newGroups = [...prev];
      newGroups.splice(groupIdx, 1, firstGroup, lastGroup);
      return newGroups;
    });
  };

  // ── Apply ────────────────────────────────────────────────────────────────

  const handleApply = () => {
    const newGroups: PhotoGroup[] = [];

    for (const group of mergeGroups) {
      const photos = getGroupPhotos(group);
      if (photos.length === 0) continue;

      // Build page buckets
      const buckets: PhotoItem[][] = Array.from({ length: group.pagesCount }, () => []);
      photos.forEach((photo, i) => {
        const pageIdx = Math.max(0, Math.min(group.pagesCount - 1, group.assignments[i] ?? 0));
        buckets[pageIdx].push(photo);
      });

      // Build human-readable date label
      const first = group.dateKeys[0];
      const last = group.dateKeys[group.dateKeys.length - 1];
      const dateLabel =
        first === last
          ? formatDateKey(first)
          : `${formatDateKey(first)} – ${formatDateKey(last)}`;

      buckets.forEach((pagePhotos, pageIdx) => {
        newGroups.push({
          id: uuidv4(),
          name:
            group.pagesCount > 1
              ? `${dateLabel} (${pageIdx + 1}/${group.pagesCount})`
              : dateLabel,
          template: 'grid',
          photos: pagePhotos.map((p, idx) => ({ ...p, priority: idx + 1 })),
        });
      });
    }

    onApply({ groups: newGroups, replace: replaceExisting } as any);
  };

  const totalPages = mergeGroups.reduce((s, g) => s + g.pagesCount, 0);
  const noPhotos = importedPhotos.length === 0;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Create Pages by Date</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {sortedDateKeys.length} date{sortedDateKeys.length !== 1 ? 's' : ''} · {importedPhotos.length} photo{importedPhotos.length !== 1 ? 's' : ''} · {totalPages} page{totalPages !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none p-1">
            ✕
          </button>
        </div>

        {/* Date groups */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {noPhotos ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">🖼️</p>
              <p className="font-medium">No photos in library</p>
              <p className="text-sm mt-1">Import photos first, then organise them by date.</p>
            </div>
          ) : (
            mergeGroups.map((group, groupIdx) => {
              const photos = getGroupPhotos(group);
              const isLastGroup = groupIdx === mergeGroups.length - 1;
              const canSplit = group.dateKeys.length > 1;

              // Build page buckets for the current state
              const pageBuckets: PhotoItem[][] = Array.from({ length: group.pagesCount }, () => []);
              photos.forEach((photo, i) => {
                const pageIdx = Math.max(0, Math.min(group.pagesCount - 1, group.assignments[i] ?? 0));
                pageBuckets[pageIdx].push(photo);
              });

              const dateLabel = group.dateKeys
                .map(formatDateKey)
                .join(' + ');

              return (
                <div
                  key={group.dateKeys.join('|')}
                  className="border border-gray-200 rounded-xl overflow-hidden"
                >
                  {/* Date header row */}
                  <div className="bg-gray-50 px-4 py-3 flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-gray-800 text-sm">{dateLabel}</span>
                      <span className="text-gray-400 text-xs ml-2">
                        {photos.length} photo{photos.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Pages +/− */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-500">Pages:</span>
                      <div className="flex items-center bg-white border border-gray-300 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setPageCount(groupIdx, -1)}
                          disabled={group.pagesCount <= 1}
                          className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors text-sm"
                        >
                          −
                        </button>
                        <span className="w-7 text-center text-sm font-mono font-medium">
                          {group.pagesCount}
                        </span>
                        <button
                          onClick={() => setPageCount(groupIdx, 1)}
                          disabled={group.pagesCount >= Math.max(1, photos.length)}
                          className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors text-sm"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Group controls */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {canSplit && (
                        <button
                          onClick={() => splitGroup(groupIdx)}
                          className="text-xs text-orange-500 hover:text-orange-700 px-2 py-1 rounded hover:bg-orange-50 transition-colors"
                        >
                          Ungroup
                        </button>
                      )}
                      {!isLastGroup && (
                        <button
                          onClick={() => mergeWithNext(groupIdx)}
                          className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                        >
                          + Group with next
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Photos / page layout */}
                  <div className="p-4">
                    {group.pagesCount === 1 ? (
                      /* Single page — flat photo strip */
                      <div className="flex flex-wrap gap-2">
                        {photos.map((photo) => (
                          <PhotoCard
                            key={photo.id}
                            photo={photo}
                            pagesCount={1}
                          />
                        ))}
                      </div>
                    ) : (
                      /* Multiple pages — column layout with move arrows */
                      <div className="flex gap-3">
                        {pageBuckets.map((pagePhotos, pageIdx) => (
                          <div key={pageIdx} className="flex-1 min-w-0">
                            <div className="text-xs text-center text-gray-400 mb-2 font-medium">
                              Page {pageIdx + 1}
                            </div>
                            <div className="border border-dashed border-gray-200 rounded-lg p-2 min-h-[4rem] flex flex-wrap gap-1.5 bg-gray-50">
                              {pagePhotos.length === 0 ? (
                                <span className="text-xs text-gray-300 m-auto">Empty</span>
                              ) : (
                                pagePhotos.map((photo) => {
                                  const localIdx = photos.findIndex((p) => p.id === photo.id);
                                  return (
                                    <PhotoCard
                                      key={photo.id}
                                      photo={photo}
                                      pagesCount={group.pagesCount}
                                      onMoveLeft={pageIdx > 0 ? () => movePhoto(groupIdx, localIdx, -1) : undefined}
                                      onMoveRight={pageIdx < group.pagesCount - 1 ? () => movePhoto(groupIdx, localIdx, 1) : undefined}
                                    />
                                  );
                                })
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-4 flex-shrink-0">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
              className="accent-blue-600"
            />
            Replace existing pages
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={noPhotos}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-40 transition-colors"
            >
              Create {totalPages} Page{totalPages !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
