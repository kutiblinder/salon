-- Neaktivan salon: sajt se vidi kao poruka, zakazivanje je ugašeno (za razliku od nacrta).
ALTER TYPE publish_status ADD VALUE IF NOT EXISTS 'inactive';
