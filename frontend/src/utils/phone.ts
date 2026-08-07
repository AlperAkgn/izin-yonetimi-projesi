// Telefon numarasını normalize eder: başında 0 yoksa ekler.
// "532..." → "0532...", "0532..." → "0532..." (değişmez)
export function normalizePhone(raw: string): string {
  // Sadece rakamları al (boşluk, tire vb. kullanıcı yazarken kalabilir ama normalize ederken temizle)
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits.startsWith('0')) return digits;
  return '0' + digits;
}

/**
 * Türkiye numarası doğrulaması — uygulamadaki TEK kural.
 *
 * Önceden ekranlara dağılmış iki ayrı regex vardı ve aynı numara bir ekranda
 * geçip diğerinde reddediliyordu:
 *   - Şube/personel ekranları: 0 zorunlu, cep + sabit hat kabul
 *   - İzin talebi ekranları:   0 opsiyonel (+90 da olur), yalnız cep kabul
 *
 * Buradaki kural ikisinin BİRLEŞİMİ — hiçbir ekran için eskisinden katı değil,
 * yani bugüne kadar kabul edilen hiçbir numara reddedilmeye başlamaz.
 *
 * Kabul edilen: 2-5 ile başlayan 10 haneli ulusal numara; başında 0, +90
 * veya 90 bulunabilir. (5xx cep, 2xx-4xx sabit hat.)
 */
export function isValidPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');

  let national = digits;
  if (digits.length === 12 && digits.startsWith('90')) national = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) national = digits.slice(1);

  return /^[2-5]\d{9}$/.test(national);
}
