/**
 * ÇALIŞAN LİSTESİ — BACKEND NOTU
 * Mock. Gerçekte: GET /users (aynı şube veya yetkiye göre filtrelenmiş).
 * Arama backend'de de yapılabilir (?q=) ama küçük listede frontend filtresi yeterli.
 */
export type Employee = { id: string; name: string; role: string };

export const MOCK_EMPLOYEES: Employee[] = [
  { id: 'e1', name: 'Ilgar İsik', role: 'İnsan Kaynakları' },
  { id: 'e2', name: 'Mehmet Demir', role: 'Personel' },
  { id: 'e3', name: 'Zeynep Kaya', role: 'Personel' },
  { id: 'e4', name: 'Atahan Şahin', role: 'Personel' },
  { id: 'e5', name: 'Buse Aydın', role: 'İnsan Kaynakları' },
  { id: 'e6', name: 'Can Öztürk', role: 'Personel' },
  { id: 'e7', name: 'Elif Arslan', role: 'Personel' },
  { id: 'e8', name: 'Burak Çelik', role: 'Sistem Yöneticisi' },
];