import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { PhotoGroup } from '../types';
import PhotoGroupCard from './PhotoGroupCard';

interface SortableGroupProps {
  group: PhotoGroup;
  pageNumber: number;
  onUpdate: (group: PhotoGroup) => void;
  onDelete: (id: string) => void;
}

function SortableGroup({ group, pageNumber, onUpdate, onDelete }: SortableGroupProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div
        className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 z-10"
        {...attributes}
        {...listeners}
      >
        ⠿
      </div>
      <div className="pl-6">
        <PhotoGroupCard
          group={group}
          pageNumber={pageNumber}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}

interface Props {
  groups: PhotoGroup[];
  onUpdateGroup: (group: PhotoGroup) => void;
  onDeleteGroup: (id: string) => void;
  onReorderGroups: (groups: PhotoGroup[]) => void;
  onAddPage: () => void;
}

export default function BookEditor({ groups, onUpdateGroup, onDeleteGroup, onReorderGroups, onAddPage }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = groups.findIndex((g) => g.id === active.id);
      const newIndex = groups.findIndex((g) => g.id === over.id);
      onReorderGroups(arrayMove(groups, oldIndex, newIndex));
    }
  };

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <div className="text-6xl mb-4">📖</div>
        <h2 className="text-xl font-semibold text-gray-600 mb-2">Your photobook is empty</h2>
        <p className="text-sm mb-6">Import photos from Google Photos to create your first page.</p>
        <button
          onClick={onAddPage}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-lg transition-colors"
        >
          + Import Photos
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-800">
          Pages <span className="text-gray-400 font-normal text-base">({groups.length})</span>
        </h2>
        <button
          onClick={onAddPage}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          + Add Page
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={groups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {groups.map((group, i) => (
              <SortableGroup
                key={group.id}
                group={group}
                pageNumber={i + 1}
                onUpdate={onUpdateGroup}
                onDelete={onDeleteGroup}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
