import type { TemplateType, CustomTemplate } from '../types';

interface Props {
  value: TemplateType;
  onChange: (t: TemplateType) => void;
  customTemplates: CustomTemplate[];
  onCreateTemplate: () => void;
  onDeleteTemplate: (id: string) => void;
  onEditTemplate: (template: CustomTemplate) => void;
}

const BUILT_IN = [
  { id: 'focal' as const, label: 'Focal', icon: '⬛', desc: 'Priority 1 photo is large, others around it' },
  { id: 'grid' as const, label: 'Grid', icon: '⊞', desc: 'All photos equal size in a grid' },
];

export default function TemplateSelector({
  value,
  onChange,
  customTemplates,
  onCreateTemplate,
  onDeleteTemplate,
  onEditTemplate,
}: Props) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {BUILT_IN.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          title={t.desc}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
            value === t.id
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
          }`}
        >
          <span>{t.icon}</span>
          {t.label}
        </button>
      ))}

      {customTemplates.map((t) => (
        <div key={t.id} className="relative group">
          <button
            onClick={() => onChange(t.id)}
            title={t.name}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
              value === t.id
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:text-purple-600'
            }`}
          >
            <span>⊡</span>
            {t.name}
          </button>
          {/* Edit button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditTemplate(t);
            }}
            className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-blue-500 text-white rounded-full text-xs hidden group-hover:flex items-center justify-center leading-none shadow"
            title="Edit template"
          >
            ✎
          </button>
          {/* Delete button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Delete template "' + t.name + '"?')) onDeleteTemplate(t.id);
            }}
            className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full text-xs hidden group-hover:flex items-center justify-center leading-none shadow"
            title="Delete template"
          >
            x
          </button>
        </div>
      ))}

      <button
        onClick={onCreateTemplate}
        title="Create a custom template"
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-all"
      >
        + New
      </button>
    </div>
  );
}
