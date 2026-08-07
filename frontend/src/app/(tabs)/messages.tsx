import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { ChatPane } from '@/components/messages/chat-pane';
import { ThemedText } from '@/components/themed-text';
import { Avatar, splitFullName } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { SearchInput } from '@/components/ui/search-input';
import { Radius, Shadow, Space } from '@/constants/design';
import { LIST_PANE_WIDTH, NARROW_MAX_WIDTH, PAGE_MAX_WIDTH } from '@/constants/layout';
import { useDesign } from '@/hooks/use-design';
import { useWideLayout } from '@/hooks/use-columns';
import { useMessagesStore } from '@/store/messagesStore';

import type { Conversation } from '@/services/messages';

/** Hem geniş ekrandaki seçici listede hem dar ekrandaki listede aynı satır */
function ConversationRow({
  item,
  index,
  active,
  onPress,
}: {
  item: Conversation;
  index: number;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useDesign();
  const [firstName, lastName] = splitFullName(item.name);

  return (
    <Animated.View
      // Gecikme sınırlı: index * 40 ile uzun listede son satırlar geç beliriyor
      entering={FadeInDown.delay(Math.min(index, 6) * 40)
        .duration(260)
        .springify()
        .damping(18)}>
      <ListRow onPress={onPress} active={active} accessibilityLabel={`${item.name} sohbeti`}>
        <Avatar firstName={firstName} lastName={lastName} size={44} />

        <View style={styles.rowBody}>
          <View style={styles.rowLine}>
            <ThemedText style={styles.rowName} numberOfLines={1}>
              {item.name}
            </ThemedText>
            {item.lastAt !== '' && (
              <ThemedText style={[styles.rowTime, { color: colors.textFaint }]}>
                {item.lastAt}
              </ThemedText>
            )}
          </View>

          {item.role !== '' && (
            <ThemedText style={[styles.rowRole, { color: colors.textFaint }]} numberOfLines={1}>
              {item.role}
            </ThemedText>
          )}

          <View style={styles.rowLine}>
            <ThemedText
              style={[
                styles.rowPreview,
                // Okunmamış varken önizleme öne çıksın
                { color: item.unread > 0 ? colors.text : colors.textMuted },
              ]}
              numberOfLines={1}>
              {item.lastMessage}
            </ThemedText>
            {item.unread > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <ThemedText style={styles.badgeText}>{item.unread}</ThemedText>
              </View>
            )}
          </View>
        </View>
      </ListRow>
    </Animated.View>
  );
}

export default function MessagesScreen() {
  const { colors } = useDesign();
  /** Geniş ekranda solda liste / sağda sohbet; altında bugünkü telefon akışı */
  const split = useWideLayout();
  // Yeni Sohbet ekranı geniş ekranda buraya "hangi sohbet açılsın" bilgisiyle döner
  const { focus } = useLocalSearchParams<{ focus?: string }>();

  const conversations = useMessagesStore((s) => s.conversations);
  const fetchConversations = useMessagesStore((s) => s.fetchConversations);
  const loading = useMessagesStore((s) => s.loadingConversations);

  const [query, setQuery] = useState('');
  /** Sağ panelde açık sohbet — yalnızca geniş ekranda kullanılır */
  const [focusedId, setFocusedId] = useState<string | null>(null);

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (typeof focus === 'string' && focus !== '') setFocusedId(focus);
  }, [focus]);

  const visibleList = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    if (q === '') return conversations;
    return conversations.filter((c) =>
      `${c.name} ${c.role} ${c.lastMessage}`.toLocaleLowerCase('tr-TR').includes(q),
    );
  }, [conversations, query]);

  const unreadTotal = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unread, 0),
    [conversations],
  );

  /**
   * Sağ panelde açık sohbet. Arama listeyi daraltınca seçim kendiliğinden
   * listenin ilk kaydına kayar — panel hiç boş kalmaz.
   */
  const focusedItem = useMemo(
    () => visibleList.find((c) => c.id === focusedId) ?? visibleList[0] ?? null,
    [visibleList, focusedId],
  );

  // Element olarak tutuluyor (fonksiyon değil): ListHeaderComponent'e fonksiyon
  // verilirse her render'da yeni bileşen tipi üretilip alanın odağı düşer.
  const searchBox = (
    <SearchInput
      value={query}
      onChangeText={setQuery}
      placeholder="Sohbet ara..."
      style={styles.search}
    />
  );

  const emptyState =
    query.trim().length > 0 ? (
      <EmptyState
        icon="search"
        title="Sonuç bulunamadı"
        description="Aradığın isim veya mesaj sohbetlerinde geçmiyor."
      />
    ) : (
      <EmptyState
        icon="message-circle"
        title="Henüz sohbet yok"
        description="Sağ üstteki kalem simgesiyle yeni bir sohbet başlatabilirsin."
      />
    );

  const listProps = {
    data: visibleList,
    keyExtractor: (c: Conversation) => c.id,
    keyboardShouldPersistTaps: 'handled' as const,
    refreshControl: (
      <RefreshControl refreshing={loading} onRefresh={() => void fetchConversations()} />
    ),
    ListEmptyComponent: loading ? null : emptyState,
  };

  // ── Geniş ekran: solda seçici liste, sağda sohbet ──────────────
  const wideLayout = (
    <View style={styles.page}>
      <View style={styles.pageHeader}>
        <View style={styles.grow}>
          <ThemedText type="title">Mesajlar</ThemedText>
          <ThemedText style={[styles.pageSubtitle, { color: colors.textMuted }]}>
            Soldan bir sohbet seç, sağdaki panelden yaz.
          </ThemedText>
        </View>
        {unreadTotal > 0 && (
          <View style={[styles.unreadPill, { backgroundColor: colors.primarySoft }]}>
            <Feather name="mail" size={13} color={colors.primary} />
            <ThemedText style={[styles.unreadPillText, { color: colors.primary }]}>
              {unreadTotal} okunmamış
            </ThemedText>
          </View>
        )}
      </View>

      <View style={styles.split}>
        <View style={styles.listPane}>
          {searchBox}
          <FlatList
            {...listProps}
            renderItem={({ item, index }) => (
              <ConversationRow
                item={item}
                index={index}
                active={focusedItem?.id === item.id}
                onPress={() => setFocusedId(item.id)}
              />
            )}
            style={styles.grow}
            contentContainerStyle={styles.paneListContent}
          />
        </View>

        <View
          style={[
            styles.chatPane,
            { backgroundColor: colors.surface, borderColor: colors.border },
            Shadow.card,
          ]}>
          {focusedItem ? (
            // key: sohbet değişince panel baştan kurulur — kaydırma son mesaja
            // döner, yarım kalan taslak öbür sohbete taşınmaz
            <Animated.View
              key={focusedItem.id}
              entering={FadeIn.duration(180)}
              style={styles.grow}>
              <ChatPane conversationId={focusedItem.id} embedded />
            </Animated.View>
          ) : (
            <View style={styles.chatEmpty}>{emptyState}</View>
          )}
        </View>
      </View>
    </View>
  );

  // ── Dar ekran: bugünkü akış — liste, sohbet ayrı sayfada ───────
  const narrowLayout = (
    <>
      <View style={styles.headerWrap}>
        <ThemedText type="title">Mesajlar</ThemedText>
        <ThemedText style={[styles.pageSubtitle, { color: colors.textMuted }]}>
          {conversations.length === 0
            ? 'Sağ üstteki kalem simgesiyle yeni bir sohbet başlat.'
            : `${conversations.length} sohbet${unreadTotal > 0 ? ` · ${unreadTotal} okunmamış` : ''}`}
        </ThemedText>
      </View>

      <FlatList
        {...listProps}
        renderItem={({ item, index }) => (
          <ConversationRow
            item={item}
            index={index}
            active={false}
            onPress={() => router.push(`/chat/${item.id}`)}
          />
        )}
        style={styles.grow}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={searchBox}
      />
    </>
  );

  return <Screen scroll={false}>{split ? wideLayout : narrowLayout}</Screen>;
}

const styles = StyleSheet.create({
  grow: { flex: 1 },

  /* ── Geniş ekran düzeni (>=1000px) ───────────────────────────
     İzin Onay ekranıyla aynı iskelet: sayfa iki yakaya açılır, üst
     sınır yalnız ultra geniş monitörler için. */
  page: {
    flex: 1,
    width: '100%',
    maxWidth: PAGE_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: Space.xl,
    paddingTop: Space.xl,
    paddingBottom: Space.xl,
    gap: Space.lg,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xl,
  },
  pageSubtitle: { fontSize: 14 },
  unreadPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.pill,
    paddingHorizontal: Space.md,
    paddingVertical: 6,
  },
  unreadPillText: { fontSize: 13, fontWeight: '700' },

  split: {
    flex: 1,
    flexDirection: 'row',
    gap: Space.lg,
  },
  listPane: {
    width: LIST_PANE_WIDTH,
    gap: Space.sm,
  },
  paneListContent: {
    paddingBottom: Space.lg,
    gap: Space.sm,
  },
  chatPane: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.lg,
    // Panel başlığı ve yazma çubuğu yuvarlak köşeye kırpılsın
    overflow: 'hidden',
  },
  chatEmpty: {
    flex: 1,
    justifyContent: 'center',
  },

  /* ── Dar ekran ───────────────────────────────────────────────
     Screen scroll=false yolunda genişliği sınırlamıyor (FlatList'in
     kaydırma çubuğu ekranın en sağında kalsın diye); başlığı ve liste
     içeriğini burada ortalıyoruz. */
  headerWrap: {
    width: '100%',
    maxWidth: NARROW_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: Space.xl,
    paddingTop: Space.xl,
    paddingBottom: Space.sm,
    gap: Space.xs,
  },
  listContent: {
    width: '100%',
    maxWidth: NARROW_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: Space.xl,
    paddingBottom: Space.xxl,
    paddingTop: Space.xs,
    gap: Space.md,
  },

  search: { marginBottom: Space.xs },

  // Sohbet satırı içeriği (kabuğu ListRow çiziyor)
  rowBody: { flex: 1, gap: 2 },
  rowLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Space.sm,
  },
  rowName: { fontSize: 15, fontWeight: '700', flex: 1 },
  rowTime: { fontSize: 12 },
  rowRole: { fontSize: 11 },
  rowPreview: { fontSize: 13, flex: 1 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: Radius.pill,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
