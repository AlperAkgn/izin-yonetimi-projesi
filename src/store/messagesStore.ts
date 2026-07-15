import { Conversation, Message, MOCK_CONVERSATIONS } from '@/services/messages';
import { create } from 'zustand';

const INITIAL_MESSAGES: Record<string, Message[]> = {
  c1: [
    { id: 'm1', conversationId: 'c1', senderId: 'other', text: 'Merhaba, yıllık izin talebin hakkında konuşabilir miyiz?', createdAt: '2026-07-15T14:20:00Z' },
    { id: 'm2', conversationId: 'c1', senderId: 'me', text: 'Tabii, buyurun.', createdAt: '2026-07-15T14:25:00Z' },
    { id: 'm3', conversationId: 'c1', senderId: 'other', text: 'İzin talebini aldım, bakıyorum.', createdAt: '2026-07-15T14:32:00Z' },
  ],
  c2: [
    { id: 'm4', conversationId: 'c2', senderId: 'other', text: 'Toplantı notlarını attım.', createdAt: '2026-07-15T11:05:00Z' },
  ],
  c3: [
    { id: 'm5', conversationId: 'c3', senderId: 'me', text: 'Dosyayı gönderdim.', createdAt: '2026-07-14T16:00:00Z' },
    { id: 'm6', conversationId: 'c3', senderId: 'other', text: 'Teşekkürler!', createdAt: '2026-07-14T16:02:00Z' },
  ],
};

function nowLabel() {
  return new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

type MessagesState = {
  conversations: Conversation[];
  messagesByConv: Record<string, Message[]>;
  getMessages: (convId: string) => Message[];
  sendMessage: (convId: string, msg: Message) => void;
  // Verilen kişiyle var olan sohbeti bulur; yoksa yeni oluşturur, id döner.
  startConversationWith: (employeeId: string, employeeName: string) => string;
};

export const useMessagesStore = create<MessagesState>((set, get) => ({
  conversations: MOCK_CONVERSATIONS,
  messagesByConv: INITIAL_MESSAGES,

  getMessages: (convId) => get().messagesByConv[convId] ?? [],

  sendMessage: (convId, msg) =>
    set((state) => {
      const existing = state.messagesByConv[convId] ?? [];
      const preview = msg.text.trim().length > 0 ? msg.text.trim() : '📎 Dosya';
      return {
        messagesByConv: { ...state.messagesByConv, [convId]: [...existing, msg] },
        conversations: state.conversations.map((c) =>
          c.id === convId ? { ...c, lastMessage: preview, lastAt: nowLabel(), unread: 0 } : c
        ),
      };
    }),

  startConversationWith: (employeeId, employeeName) => {
    const convId = `emp-${employeeId}`;
    const exists = get().conversations.some((c) => c.id === convId);
    if (!exists) {
      set((state) => ({
        conversations: [
          { id: convId, name: employeeName, lastMessage: 'Yeni sohbet', lastAt: nowLabel(), unread: 0 },
          ...state.conversations,
        ],
        messagesByConv: { ...state.messagesByConv, [convId]: [] },
      }));
    }
    return convId;
  },
}));