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
  createdAt?: string; // ISO 8601 timestamp from Google Photos
  cropX?: number;   // 0-100, default 50 (center)
  cropY?: number;   // 0-100, default 50 (center)
  zoom?: number;    // 1.0 = default fill, >1 = zoomed in, <1 = zoomed out
  colSpan?: number; // grid column span (1-5), default 1
  rowSpan?: number; // grid row span (1-5), default 1
  gridColStart?: number; // explicit CSS grid-column-start (1-5)
  gridRowStart?: number; // explicit CSS grid-row-start (1-5)
}

export interface PhotoGroup {
  id: string;
  name: string;
  template: TemplateType;
  templateZones?: TemplateZone[]; // populated when template is a custom template ID
  fillPage?: boolean; // scale zones to fill page when fewer photos than zones
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
