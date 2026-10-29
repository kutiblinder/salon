export interface GalleryItem {
  id: string;
  mediaId: string;
  altText: string | null;
  caption: string | null;
  sortOrder: number;
  locationId: string | null;
  locationName: string | null;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
}

export const GALLERY_MAX_ITEMS = 40;
export const GALLERY_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const GALLERY_MAX_TOTAL_BYTES = 80 * 1024 * 1024;
export const GALLERY_MAX_EDGE = 1600;
