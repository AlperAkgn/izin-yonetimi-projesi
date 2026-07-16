/**
 * ============================================================
 * MESAJLAŞMA SERVİSİ — BACKEND EKİBİNE NOTLAR
 * ============================================================
 * Şu an tüm veri mock. Gerçek entegrasyonda bu dosyanın içi değişecek,
 * ekranlar (messages.tsx, chat/[id].tsx) DEĞİŞMEYECEK.
 *
 * GEREKSİNİMLER (şartname 3.3):
 * 1. Gerçek zamanlı (real-time) mimari → WebSocket (Socket.io öneriliyor).
 *    - Bağlantı JWT ile authenticate edilmeli (handshake'te token).
 *    - Kullanıcı bağlanınca kendi user-id'li bir "room"a join olmalı,
 *      birebir mesaj o room'a emit edilmeli.
 *
 * 2. Medya + belge gönderimi:
 *    - Maksimum dosya boyutu İSTEK BAŞINA 5MB. Bu limit SADECE frontend'de
 *      değil, BACKEND'de de tekrar kontrol edilmeli (frontend'e güvenme).
 *    - Dosya yükleme akışı için iki seçenek, backend ekibi karar versin:
 *      a) Dosya multipart/form-data ile REST endpoint'e yüklenir, dönen
 *         URL socket mesajında referans olarak gönderilir. (ÖNERİLEN)
 *      b) Dosya base64 olarak socket üzerinden gönderilir. (5MB için riskli,
 *         socket payload limitlerini zorlar — önerilmez.)
 *    - Yüklenen dosyalar ayrı bir tabloda (attachment) tutulmalı,
 *      message ile foreign key ilişkisi kurulmalı.
 *
 * 3. Veri saklama (şartname 3.3 — Data Retention):
 *    - 30 günü dolan mesajlar VE bağlı dosyalar kalıcı silinmeli (cron job).
 *    - DİKKAT / MENTÖRE SORULACAK ÇELİŞKİ: Şartname 4.1 "tüm tablolarda DELETE
 *      yasak, her şey soft-delete" diyor. Ama 3.3 mesajlar için "kalıcı temizlik"
 *      istiyor. Bu ikisi çelişiyor. Mesaj retention'ı bilinçli bir istisna mı,
 *      yoksa soft-delete mi uygulanacak? Kodlamadan önce netleştirilmeli.
 *
 * BEKLENEN SOCKET OLAYLARI (öneri, backend ile mutabık kalınmalı):
 *   - emit "message:send"    { conversationId, text, attachment? }
 *   - on   "message:new"     { id, conversationId, senderId, text, attachment?, createdAt }
 *   - on   "message:sent"    { tempId, id }  // optimistic update onayı
 * ============================================================
 */

export type Attachment = {
  name: string;
  uri: string;
  type: 'image' | 'file';
  sizeBytes: number;
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string; // 'me' = ben, diğerleri karşı taraf
  text: string;
  attachment?: Attachment;
  createdAt: string; // ISO
};

export type Conversation = {
  id: string;
  name: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
};

export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB — şartname limiti

// ---- MOCK VERİ ----
export const MOCK_CONVERSATIONS: Conversation[] = [
  { id: 'c1', name: 'Batuhan Hasdemir (İK)', lastMessage: 'İzin talebini aldım, bakıyorum.', lastAt: '14:32', unread: 2 },
  { id: 'c2', name: 'Alper Akgün', lastMessage: 'Toplantı notlarını attım.', lastAt: '11:05', unread: 0 },
  { id: 'c3', name: 'Melis Turan', lastMessage: 'Teşekkürler!', lastAt: 'Dün', unread: 0 },
];
