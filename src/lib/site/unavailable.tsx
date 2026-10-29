/** Isti prikaz na javnom sajtu i panelu kad je salon ugašen (npr. neplaćena usluga). */
export function SalonUnavailable() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="text-neutral-700">Sajt nije dostupan.</p>
    </div>
  );
}
