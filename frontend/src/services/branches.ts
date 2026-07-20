/**
 * ŞUBE YÖNETİMİ — BACKEND NOTLARI
 * - GET /branches (Admin: hepsi; HR: sadece kendi şubesi)
 * - POST /branches { name, city, address, phone }
 * - POST /branches/:id/hr { firstName, lastName, email, phone } → yeni HR kullanıcısı
 *   oluşturur (şartname 3.4: OTP üretilip ilk girişte şifre değiştirtilecek)
 * - DELETE /branches/:id → SOFT DELETE (şartname 4.1: fiziksel DELETE yasak,
 *   deleted_at işaretlenmeli). Şubeye bağlı kullanıcı/izin kayıtlarının ne olacağı
 *   (aktarım mı, pasifleştirme mi) 
 * - Tüm bu endpoint'ler SADECE Admin rolüne açık olmalı (server-side guard).
 */

export type BranchHR = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export type Branch = {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  employeeCount: number;
  hrList: BranchHR[];
};

export const MOCK_BRANCHES: Branch[] = [
  {
    id: 'b1',
    name: 'İstanbul Merkez',
    city: 'İstanbul',
    address: 'Levent Mah. İş Kuleleri No:1',
    phone: '0212 000 00 00',
    employeeCount: 24,
    hrList: [
      { id: 'hr1', firstName: 'Ayşe', lastName: 'Yılmaz', email: 'ayse@permitflow.com', phone: '0532 000 00 01' },
    ],
  },
  {
    id: 'b2',
    name: 'Ankara Şube',
    city: 'Ankara',
    address: 'Çankaya Cad. No:42',
    phone: '0312 000 00 00',
    employeeCount: 11,
    hrList: [],
  },
];