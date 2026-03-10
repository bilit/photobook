export type TemplateType = 'focal' | 'grid' | string; // string allows custom template IDs

export interface TemplateZone {
  id: string;
  x: number;       // percentage 0-100 (left edge)
  y: number;       // percentage 0-100 (top edge)
  width: number;   // percentage 0-100
  height: number;  // percentage 0-100
  priority: number; // 1 = highest priority photo goes here
}

export interface CustomTemplate {
  id: string;
  name: string;
  zones: TemplateZone[];
}

export interface PhotoItem {
  id: string;
  url: string;
  thumbnailUrl: string;
  filename: string;
  width: number;
  height: number;
  priority: number;
}

export interface PhotoGroup {
  id: string;
  name: string;
  template: TemplateType;
  templateZones?: TemplateZone[]; // populated when template is a custom template ID
  photos: PhotoItem[];
}

export interface PhotoBook {
  id: string;
  title: string;
  groups: PhotoGroup[];
  importedPhotos: PhotoItem[]; // global photo pool
}

export interface AuthStatus {
  loggedIn: boolean;
  user?: {
    id: string;
    displayName: string;
    email: string;
  };
}
