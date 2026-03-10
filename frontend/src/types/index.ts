export type TemplateType = 'focal' | 'grid';

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
  photos: PhotoItem[];
}

export interface PhotoBook {
  id: string;
  title: string;
  groups: PhotoGroup[];
}

export interface Album {
  id: string;
  title: string;
  mediaItemsCount: string;
  coverPhotoBaseUrl: string;
}

export interface AuthStatus {
  loggedIn: boolean;
  user?: {
    id: string;
    displayName: string;
    email: string;
  };
}
