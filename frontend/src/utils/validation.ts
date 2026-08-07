/**
 * Form doğrulayıcıları — ekranlara kopyalanmasın diye tek yerde.
 * Telefon kuralı için `utils/phone.ts` → `isValidPhone`.
 */

// Kasıtlı olarak gevşek: amaç yazım hatasını yakalamak, RFC 5322'yi uygulamak
// değil. Adresin gerçekten çalıştığını zaten geçici şifre e-postası kanıtlıyor.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(raw: string): boolean {
  return EMAIL_REGEX.test(raw.trim());
}
