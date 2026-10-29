export const AUDIT_PAGE_SIZE = 100;

export interface AuditLogItem {
  id: string;
  at: Date;
  action: string;
  objectType: string;
  objectId: string | null;
  oldValue: unknown;
  newValue: unknown;
  actorName: string | null;
  actorEmail: string | null;
}

export const ACTION_LABELS: Record<string, string> = {
  'admin.enter_organization': 'Ulazak u salon',
  'admin.leave_organization': 'Izlazak iz salona',
  'organization.create': 'Novi salon',
  'organization.delete': 'Obrisan salon',
  'appointment.create': 'Novi termin',
  'appointment.status': 'Promena statusa termina',
  'content.update': 'Izmena sadržaja',
  'domains.add': 'Dodat domen',
  'domains.delete': 'Obrisan domen',
  'domains.unverify': 'Domen nije više proveren',
  'domains.verify': 'Domen proveren',
  'gallery.create': 'Dodata slika',
  'locations.create': 'Novi objekat',
  'locations.update': 'Izmena objekta',
  'locations.delete': 'Obrisan objekat',
  'gallery.delete': 'Obrisana slika',
  'gallery.update': 'Izmena slike',
  'prices.update': 'Izmena cena',
  'schedule.exception.delete': 'Obrisan izuzetak smene',
  'schedule.exception.upsert': 'Izuzetak smene',
  'schedule.template.create': 'Novi šablon smene',
  'schedule.template.delete': 'Obrisan šablon smene',
  'schedule.template.update': 'Izmena šablona smene',
  'schedule.time_off.create': 'Novo odsustvo',
  'schedule.time_off.delete': 'Obrisano odsustvo',
  'schedule.weekly.set': 'Nedeljni raspored',
  'services.create': 'Nova usluga',
  'staff.create': 'Novi zaposleni',
  'staff.login.create': 'Nalog zaposlenog',
  'staff.update': 'Izmena zaposlenog',
  'staff.delete': 'Obrisan zaposleni',
  'user.create': 'Novi nalog',
};

export const OBJECT_TYPE_LABELS: Record<string, string> = {
  appointment: 'termin',
  domain: 'domen',
  gallery_item: 'slika',
  location: 'objekat',
  membership: 'članstvo',
  organization: 'salon',
  schedule_exception: 'izuzetak smene',
  service: 'usluga',
  shift_template: 'šablon smene',
  staff: 'zaposleni',
  time_off: 'odsustvo',
  user: 'nalog',
  weekly_schedule: 'raspored',
};
