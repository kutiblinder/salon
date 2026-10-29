/** Lokacije na kojima postoji bar jedna aktivna ponuda (cena). */
export function bookableLocations<T extends { id: string }>(
  locations: T[],
  offers: { locationId: string }[],
): T[] {
  const ids = new Set(offers.map((o) => o.locationId));
  return locations.filter((l) => ids.has(l.id));
}
