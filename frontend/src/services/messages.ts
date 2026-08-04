import { Platform } from 'react-native';

import { API_BASE_URL, apiFetch } from '@/services/api';
import { useAuthStore } from '@/store/authStore';

/**
 * ============================================================
 * MESAJLAŞMA SERVİSİ — /api/messages + STOMP WebSocket
 * ============================================================
 * - Sohbet listesi / geçmişi / dosya yükleme REST ile çalışır.
 * - Mesaj GÖNDERİMİ yalnızca WebSocket (STOMP) üzerinden yapılır;
 *   sunucu mesajı hem alıcının hem gönderenin kuyruğuna yayınlar
 *   (services/stomp.ts + store/messagesStore.ts).
 * - Dosya limiti istek başına 5MB; backend de ayrıca doğrular.
 */

export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB — şartname limiti

/** Sohbet kimliği = karşı tarafın kullanıcı id'si */
export type Conversation = {
  id: string;
  name: string;
  role: string;
  lastMessage: string;
  lastAt: string;
  /** Son mesajın zamanı (sıralama için) */
  lastTs: number;
  unread: number;
};

export type Attachment = {
  /** Sunucudaki ek kaydı — henüz gönderilmemiş yerel dosyada yoktur */
  id?: number;
  name: string;
  uri: string;
  mimeType?: string;
  type: 'image' | 'file';
  sizeBytes: number;
};

export type Message = {
  id: string;
  conversationId: string;
  /** 'me' = oturumdaki kullanıcı; diğer her değer karşı taraf */
  senderId: string;
  text: string;
  attachment?: Attachment;
  createdAt: string; // ISO
};

// ---- Backend DTO'ları ----
type AttachmentDto = {
  id: number;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  downloadUrl: string;
};

export type MessageDto = {
  id: number;
  senderId: number;
  receiverId: number;
  content: string;
  timestamp: string;
  isRead: boolean;
  attachments?: AttachmentDto[];
};

type ConversationDto = {
  partnerId: number;
  partnerName: string;
  partnerRole: string;
  lastContent: string;
  lastTimestamp: string;
  lastSenderId: number;
  lastHasAttachment: boolean;
  unreadCount: number;
};

/**
 * İndirilebilir ek bağlantısı. Authorization header'ı taşınamadığı için
 * token query'de gider (backend /api/messages/attachments için buna izin verir).
 */
export function attachmentDownloadUrl(downloadUrl: string): string {
  const token = useAuthStore.getState().token ?? '';
  return `${API_BASE_URL}${downloadUrl}?access_token=${encodeURIComponent(token)}`;
}

function toAttachment(dto: AttachmentDto): Attachment {
  return {
    id: dto.id,
    name: dto.fileName,
    uri: attachmentDownloadUrl(dto.downloadUrl),
    mimeType: dto.contentType,
    type: dto.contentType.startsWith('image/') ? 'image' : 'file',
    sizeBytes: dto.sizeBytes,
  };
}

export function mapMessage(dto: MessageDto, myUserId: string): Message {
  const mine = String(dto.senderId) === myUserId;
  const attachment = dto.attachments?.[0];
  return {
    id: String(dto.id),
    conversationId: mine ? String(dto.receiverId) : String(dto.senderId),
    senderId: mine ? 'me' : String(dto.senderId),
    text: dto.content,
    attachment: attachment ? toAttachment(attachment) : undefined,
    createdAt: dto.timestamp,
  };
}

/** Sohbet listesindeki zaman etiketi: bugün "14:32", dün "Dün", eskisi "12.08" */
export function timeLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / (24 * 60 * 60 * 1000));

  if (dayDiff <= 0) return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  if (dayDiff === 1) return 'Dün';
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
}

export function mapConversation(dto: ConversationDto): Conversation {
  const preview =
    dto.lastContent.trim().length > 0
      ? dto.lastContent
      : dto.lastHasAttachment
        ? '📎 Dosya'
        : '';
  return {
    id: String(dto.partnerId),
    name: dto.partnerName,
    role: dto.partnerRole,
    lastMessage: preview,
    lastAt: timeLabel(dto.lastTimestamp),
    lastTs: new Date(dto.lastTimestamp).getTime(),
    unread: dto.unreadCount,
  };
}

export async function fetchConversations(): Promise<Conversation[]> {
  const list = await apiFetch<ConversationDto[]>('/api/messages/conversations');
  return list.map(mapConversation);
}

/** Geçmişi getirir; backend bu çağrıda karşı taraftan gelenleri okundu işaretler */
export async function fetchConversationMessages(
  myUserId: string,
  partnerId: string,
): Promise<Message[]> {
  const list = await apiFetch<MessageDto[]>(`/api/messages/${myUserId}/${partnerId}`);
  return list.map((dto) => mapMessage(dto, myUserId));
}

export type PickedFile = {
  uri: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
};

/** Dosyayı yükler; dönen ek id'si STOMP mesajına iliştirilir */
export async function uploadAttachment(file: PickedFile): Promise<AttachmentDto> {
  const form = new FormData();

  if (Platform.OS === 'web') {
    const blob = await (await fetch(file.uri)).blob();
    form.append('file', new File([blob], file.name, { type: file.mimeType }));
  } else {
    // React Native'in FormData'sı {uri,name,type} nesnesini dosya olarak yükler
    form.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType,
    } as unknown as Blob);
  }

  return apiFetch<AttachmentDto>('/api/messages/attachments', { method: 'POST', formData: form });
}
