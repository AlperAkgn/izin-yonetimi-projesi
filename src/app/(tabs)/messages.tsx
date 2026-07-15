import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui/screen';
import { Radius, Space } from '@/constants/design';
import { useDesign } from '@/hooks/use-design';
import { Conversation } from '@/services/messages';
import { useMessagesStore } from '@/store/messagesStore';

function Avatar({ name }: { name: string }) {
  const { colors } = useDesign();
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
      <ThemedText style={[styles.avatarText, { color: colors.primary }]}>{initials}</ThemedText>
    </View>
  );
}

function ConversationRow({ item, isLast }: { item: Conversation; isLast: boolean }) {
  const { colors } = useDesign();
  return (
    <Pressable
      onPress={() => router.push(`/chat/${item.id}`)}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.surfaceRaised : 'transparent',
          borderBottomColor: colors.border,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        },
      ]}>
      <Avatar name={item.name} />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <ThemedText style={styles.rowName} numberOfLines={1}>
            {item.name}
          </ThemedText>
          <ThemedText style={[styles.rowTime, { color: colors.textFaint }]}>{item.lastAt}</ThemedText>
        </View>
        <View style={styles.rowBottom}>
          <ThemedText style={[styles.rowPreview, { color: colors.textMuted }]} numberOfLines={1}>
            {item.lastMessage}
          </ThemedText>
          {item.unread > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <ThemedText style={styles.badgeText}>{item.unread}</ThemedText>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default function MessagesScreen() {
  const { colors } = useDesign();
  const conversations = useMessagesStore((s) => s.conversations);

  return (
    <Screen scroll={false}>
      <View style={styles.headerRow}>
        <ThemedText type="title">Mesajlar</ThemedText>
        <Pressable
          onPress={() => router.push('/new-chat')}
          style={[styles.newButton, { backgroundColor: colors.primary }]}>
          <Feather name="edit" size={18} color="#fff" />
        </Pressable>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(c) => c.id}
        renderItem={({ item, index }) => (
          <ConversationRow item={item} isLast={index === conversations.length - 1} />
        )}
        contentContainerStyle={styles.list}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Space.sm,
    marginBottom: Space.md,
  },
  newButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingBottom: Space.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingVertical: Space.md,
    paddingHorizontal: Space.xs,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontWeight: '700', fontSize: 15 },
  rowBody: { flex: 1, gap: 3 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowName: { fontWeight: '600', fontSize: 15, flex: 1 },
  rowTime: { fontSize: 12, marginLeft: Space.sm },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowPreview: { fontSize: 14, flex: 1 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: Radius.pill,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Space.sm,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});