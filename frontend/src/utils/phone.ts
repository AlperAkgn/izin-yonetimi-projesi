// Telefon numarasını normalize eder: başında 0 yoksa ekler.
// "532..." → "0532...", "0532..." → "0532..." (değişmez)
export function normalizePhone(raw: string): string {
  // Sadece rakamları al (boşluk, tire vb. kullanıcı yazarken kalabilir ama normalize ederken temizle)
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits.startsWith('0')) return digits;
  return '0' + digits;
}