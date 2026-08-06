/**
 * Uygulama genelinde tarih biçimi DD.MM.YYYY (izin kayıtları bu metni saklar).
 * Hesaplama gerektiren yerlerde metni Date'e çevirip geri yazıyoruz.
 */

/** Hafta sonları hariç, iki tarih arasındaki (uçlar dahil) gün sayısı */
export function countNetWeekdays(start: Date, end: Date): number {
  if (end < start) return 0;
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/** "2026-08-12T00:00:00Z" → "12.08.2026" (saat dilimi kaymasına düşmeden) */
export function isoToDisplayDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${day}.${month}.${year}`;
}

/** Date → "DD.MM.YYYY" */
export function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

/**
 * "DD.MM.YYYY" → Date. Biçim tutmuyorsa veya takvimde olmayan bir gün ise
 * (örn. 31.02.2026) null döner — çağıran taraf bugüne düşmek yerine hatayı görsün.
 */
export function parseDate(value: string): Date | null {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);

  const date = new Date(year, month - 1, day);
  // Date taşan günleri sessizce ileri sarar (31.02 → 03.03); geri okuyup doğruluyoruz.
  if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
    return null;
  }
  return date;
}
