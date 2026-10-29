export type SiteSchemaType = 'HairSalon' | 'DaySpa' | 'NailSalon';

export interface SiteSalon {
  id: string;
  name: string;
  slug: string;
  status: 'draft' | 'published' | 'inactive';
  primaryColor: string | null;
  guestConfirmEmail: boolean;
  schemaType: SiteSchemaType;
}

export interface SiteLocation {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  hours: { weekday: number; opens: string; closes: string }[];
}

export interface SiteStaff {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
}

export interface SiteOffer {
  locationId: string;
  locationName: string;
  serviceId: string;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  durationMin: number;
}

export interface SiteGalleryItem {
  mediaId: string;
  altText: string | null;
  caption: string | null;
}

export interface BookingCatalog {
  locations: { id: string; name: string }[];
  offers: SiteOffer[];
  staff: { id: string; name: string; locationId: string; serviceId: string }[];
}
