export const metadata = { title: 'Politika privatnosti' };

export default function PrivacyPage() {
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Politika privatnosti</h1>
      <p>
        Salon prikuplja samo podatke potrebne za zakazivanje termina: ime i prezime, broj telefona i email. Ako
        napraviš nalog, čuva se i lozinka (hash, ne u čitljivom obliku).
      </p>
      <p>
        Podaci ostaju u salonu u kojem si zakazao/la. Drugi saloni na ovoj platformi ih ne vide. Koriste se za
        otkazivanje termina i, ako je uključeno, za obaveštenja emailom.
      </p>
      <p>
        Gost-termin možeš da otkažeš linkom iz poruke, bez naloga. Nalog možeš da zatražiš da se obriše tako što
        pišeš salonu. Termini se čuvaju zbog evidencije rada salona.
      </p>
      <p>Prava po Zakonu o zaštiti podataka o ličnosti ostvaruješ preko salona kod kojeg su podaci evidentirani.</p>
    </main>
  );
}
