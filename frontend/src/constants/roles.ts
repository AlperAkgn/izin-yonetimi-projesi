/**
 * Backend rol kodları → arayüzde gösterilen Türkçe etiket.
 * Tek kaynak: kişi listeleri, sohbet listesi ve panel başlığı aynı metni kullanır.
 */
export const ROLE_LABEL: Record<string, string> = {
  EMPLOYEE: 'Personel',
  HR: 'İnsan Kaynakları',
  ADMIN: 'Sistem Yöneticisi',
};

/** Bilinmeyen rol kodu geldiğinde kodun kendisi gösterilir (boşluk bırakılmaz) */
export function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role;
}
