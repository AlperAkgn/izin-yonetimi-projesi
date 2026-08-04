import { create } from 'zustand';

import { getErrorMessage } from '@/services/api';
import * as messageApi from '@/services/messages';
import { StompClient } from '@/services/stomp';
import { useAuthStore } from '@/store/authStore';

import type { Conversation, Message, MessageDto, PickedFile } from '@/services/messages';

/**
 * MESAJLAŞMA STORE'U
 * - Sohbet listesi/geçmişi REST'ten gelir, canlı mesajlar STOMP WebSocket'ten.
 * - Sunucu gönderilen mesajı gönderene de yayınladığı için kendi mesajımız da
 *   aynı kanaldan düşer; optimistic ekleme yapılmaz, çift kayıt oluşmaz.
 * - Sohbet kimliği = karşı tarafın kullanıcı id'si.
 */

let client: StompClient | null = null;

type SendResult = { ok: boolean; message?: string };

type MessagesState = {
  conversations: Conversation[];
  messagesByConv: Record<string, Message[]>;
  loadingConversations: boolean;
  /** WebSocket bağlantısı canlı mı? (gönderim bunu gerektirir) */
  connected: boolean;
  /** Ekranda açık olan sohbet — gelen mesaj için rozet artırılmaz */
  activeConversationId: string | null;
  error: string | null;

  connect: () => void;
  disconnect: () => void;
  fetchConversations: () => Promise<void>;
  /** Geçmişi getirir; sunucu bu çağrıda mesajları okundu işaretler */
  openConversation: (partnerId: string) => Promise<void>;
  setActiveConversation: (partnerId: string | null) => void;
  sendMessage: (partnerId: string, text: string, file?: PickedFile) => Promise<SendResult>;
  /** Var olan sohbeti bulur, yoksa listeye ekler; sohbet id'sini döner */
  startConversationWith: (partnerId: string, name: string, role?: string) => string;
};

function sortConversations(list: Conversation[]): Conversation[] {
  return [...list].sort((a, b) => b.lastTs - a.lastTs);
}

export const useMessagesStore = create<MessagesState>((set, get) => {
  const handleIncoming = (dto: MessageDto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    const message = messageApi.mapMessage(dto, user.id);
    const convId = message.conversationId;
    const isMine = message.senderId === 'me';
    const isActive = get().activeConversationId === convId;

    set((state) => {
      const existing = state.messagesByConv[convId] ?? [];
      if (existing.some((m) => m.id === message.id)) return state; // echo tekrarı

      const preview =
        message.text.trim().length > 0 ? message.text.trim() : message.attachment ? '📎 Dosya' : '';

      let found = false;
      const conversations = state.conversations.map((c) => {
        if (c.id !== convId) return c;
        found = true;
        return {
          ...c,
          lastMessage: preview,
          lastAt: messageApi.timeLabel(message.createdAt),
          lastTs: new Date(message.createdAt).getTime(),
          unread: !isMine && !isActive ? c.unread + 1 : c.unread,
        };
      });

      return {
        messagesByConv: { ...state.messagesByConv, [convId]: [...existing, message] },
        conversations: sortConversations(conversations),
        // Sohbet listede yoksa (yeni kişi yazdı) isimleri sunucudan alacağız
        loadingConversations: found ? state.loadingConversations : true,
      };
    });

    const conversationKnown = get().conversations.some((c) => c.id === convId);
    if (!conversationKnown) {
      void get().fetchConversations();
    } else if (isActive && !isMine) {
      // Açık sohbete düşen mesajı sunucuda da okundu işaretle (GET bunu yapar)
      void messageApi.fetchConversationMessages(user.id, convId).catch(() => undefined);
    }
  };

  return {
    conversations: [],
    messagesByConv: {},
    loadingConversations: false,
    connected: false,
    activeConversationId: null,
    error: null,

    connect: () => {
      const { user, token } = useAuthStore.getState();
      if (!user || !token) return;

      client?.stop();
      client = new StompClient({
        token,
        userId: user.id,
        onMessage: handleIncoming,
        onConnectedChange: (connected) => set({ connected }),
        onError: (message) => set({ error: message }),
      });
      client.start();
    },

    disconnect: () => {
      client?.stop();
      client = null;
      set({
        connected: false,
        conversations: [],
        messagesByConv: {},
        activeConversationId: null,
      });
    },

    fetchConversations: async () => {
      set({ loadingConversations: true });
      try {
        const remote = await messageApi.fetchConversations();
        set((state) => {
          // Henüz mesajı olmayan yerel "yeni sohbet" girdilerini koru
          const locals = state.conversations.filter(
            (c) => !remote.some((r) => r.id === c.id) && (state.messagesByConv[c.id]?.length ?? 0) === 0,
          );
          return { conversations: sortConversations([...remote, ...locals]) };
        });
      } catch (error) {
        set({ error: getErrorMessage(error) });
      } finally {
        set({ loadingConversations: false });
      }
    },

    openConversation: async (partnerId) => {
      const user = useAuthStore.getState().user;
      if (!user) return;
      try {
        const messages = await messageApi.fetchConversationMessages(user.id, partnerId);
        set((state) => ({
          messagesByConv: { ...state.messagesByConv, [partnerId]: messages },
          conversations: state.conversations.map((c) =>
            c.id === partnerId ? { ...c, unread: 0 } : c,
          ),
        }));
      } catch (error) {
        set({ error: getErrorMessage(error) });
      }
    },

    setActiveConversation: (partnerId) => set({ activeConversationId: partnerId }),

    sendMessage: async (partnerId, text, file) => {
      const user = useAuthStore.getState().user;
      if (!user) return { ok: false, message: 'Oturum bulunamadı.' };

      let attachmentId: number | undefined;
      if (file) {
        try {
          attachmentId = (await messageApi.uploadAttachment(file)).id;
        } catch (error) {
          return { ok: false, message: getErrorMessage(error) };
        }
      }

      const sent = client?.sendChat({
        senderId: Number(user.id),
        receiverId: Number(partnerId),
        content: text,
        attachmentId,
      });

      if (!sent) {
        return {
          ok: false,
          message: 'Mesaj sunucusuna bağlantı kurulamadı. Birazdan tekrar dene.',
        };
      }
      return { ok: true };
    },

    startConversationWith: (partnerId, name, role = '') => {
      const exists = get().conversations.some((c) => c.id === partnerId);
      if (!exists) {
        set((state) => ({
          conversations: [
            {
              id: partnerId,
              name,
              role,
              lastMessage: 'Yeni sohbet',
              lastAt: '',
              lastTs: Date.now(),
              unread: 0,
            },
            ...state.conversations,
          ],
          messagesByConv: { ...state.messagesByConv, [partnerId]: state.messagesByConv[partnerId] ?? [] },
        }));
      }
      return partnerId;
    },
  };
});
