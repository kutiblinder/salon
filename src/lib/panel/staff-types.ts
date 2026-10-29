export interface StaffListItem {
  id: string;
  name: string;
  title: string | null;
  isActive: boolean;
  locationNames: string[];
  email: string | null;
}

export interface StaffServiceAssignment {
  serviceId: string;
  durationOverrideMin: number | null;
}

export interface StaffDetail {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  isActive: boolean;
  sortOrder: number;
  locationIds: string[];
  services: StaffServiceAssignment[];
  email: string | null;
}

export interface OrgService {
  id: string;
  name: string;
}

export type CreateLoginResult =
  | { kind: 'created'; email: string; password: string }
  | { kind: 'linked'; email: string };
