export type ContentFieldType = 'text' | 'textarea';

export interface ContentField {
  page: string;
  key: string;
  label: string;
  hint?: string;
  type: ContentFieldType;
  maxLength: number;
}

/** Dozvoljeni kljucevi sajta. Korak 6 cita iste. */
export const CONTENT_LANGUAGE = 'sr-Latn';

export const CONTENT_FIELDS: readonly ContentField[] = [
  { page: 'home', key: 'hero_title', label: 'Naslov na početnoj', type: 'text', maxLength: 120 },
  { page: 'home', key: 'hero_subtitle', label: 'Podnaslov', type: 'text', maxLength: 200 },
  { page: 'home', key: 'intro', label: 'Uvodni tekst', type: 'textarea', maxLength: 2000 },
  { page: 'about', key: 'title', label: 'Naslov (O nama)', type: 'text', maxLength: 120 },
  { page: 'about', key: 'body', label: 'Tekst o salonu', type: 'textarea', maxLength: 8000 },
  {
    page: 'contact',
    key: 'note',
    label: 'Napomena na kontaktu',
    hint: 'Adresa i telefon objekta su na stranici lokacija, ovde samo dodatni tekst.',
    type: 'textarea',
    maxLength: 1000,
  },
];

export function fieldId(field: Pick<ContentField, 'page' | 'key'>): string {
  return `${field.page}.${field.key}`;
}

export function findContentField(page: string, key: string): ContentField | undefined {
  return CONTENT_FIELDS.find((f) => f.page === page && f.key === key);
}

export interface SalonSettings {
  id: string;
  name: string;
  slug: string;
  status: 'draft' | 'published';
  primaryColor: string | null;
}

export interface ContentBundle {
  salon: SalonSettings;
  values: Record<string, string>;
}
