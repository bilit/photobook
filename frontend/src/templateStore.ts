import { v4 as uuidv4 } from 'uuid';
import type { CustomTemplate, TemplateZone } from './types';

const STORAGE_KEY = 'photobook_custom_templates';

export function loadTemplates(): CustomTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTemplate(name: string, zones: TemplateZone[]): CustomTemplate {
  const templates = loadTemplates();
  const newTemplate: CustomTemplate = {
    id: uuidv4(),
    name: name.trim() || 'My Template',
    zones,
  };
  templates.push(newTemplate);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  return newTemplate;
}

export function updateTemplate(template: CustomTemplate): void {
  const templates = loadTemplates().map((t) =>
    t.id === template.id ? template : t
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function deleteTemplate(id: string): void {
  const templates = loadTemplates().filter((t) => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}
