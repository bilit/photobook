import type { TemplateType } from '../types';

interface Props {
  value: TemplateType;
  onChange: (t: TemplateType) => void;
}

const templates: { id: TemplateType; label: string; icon: string; desc: string }[] = [
  { id: 'focal', label: 'Focal', icon: '⬛', desc: 'Priority 1 photo is large, others around it' },
  { id: 'grid', label: 'Grid', icon: '⊞', desc: 'All photos equal size in a grid' },
];

export default function TemplateSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-2">
      {templates.map((t) => (
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
    </div>
  );
}
