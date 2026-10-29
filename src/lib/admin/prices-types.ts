export interface AdminLocation {
  id: string;
  name: string;
}

export interface ServiceListItem {
  id: string;
  name: string;
  isActive: boolean;
  locationCount: number;
  minPrice: string | null;
}

export interface ServiceOffer {
  locationId: string;
  price: string;
  durationMin: number;
  bufferMin: number;
}

export interface ServiceDetail {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  offers: ServiceOffer[];
}
