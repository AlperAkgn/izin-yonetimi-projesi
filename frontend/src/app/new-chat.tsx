import Feather from '@expo/vector-icons/Feather';
import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { BackButton } from '@/components/ui/back-button';
import { ThemedText } from '@/components/themed-text';
import { Radius, Space } from '@/constants/design';
import { useDesign } from '@/hooks/use-design';
import { getErrorMessage } from '@/services/api';
import { Employee, fetchContacts } from '@/services/employees';
import { useMessagesStore } from '@/store/messagesStore';

function Avatar({ name }: { name: string }) {
  const { colors } = useDesign();
  const initials = name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
      <ThemedText style={[styles.avatarText, { color: colors.primary }]}>{initials}</ThemedText>
    </View>
  );
}

export default function NewChatScreen() {
  const { colors } = useDesign();
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const startConversationWith = useMessagesStore((s) => s.startConversationWith);

  // Sohbet başlatılabilecek kişiler sunucudan gelir (aktif kullanıcılar)
  useEffect(() => {
    let cancelled = false;
    fetchContacts()
      .then((list) => {
        if (!cancelled) setContacts(list);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    if (q === '') return contacts;
    return contacts.filter((e) => e.name.toLocaleLowerCase('tr-TR').includes(q));
  }, [contacts, query]);

  const openChat = (emp: Employee) => {
    const convId = startConversationWith(emp.id, emp.name, emp.role);
    router.replace(`/chat/${convId}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Yeni Sohbet',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerLeft: () => <BackButton />,
        }}
      />

      <View style={[styles.searchBar, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
        <Feather name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Çalışan ara..."
          placeholderTextColor={colors.textFaint}
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')}>
            <Feather name="x" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <ThemedText style={[styles.empty, { color: error ? colors.danger : colors.textMuted }]}>
            {loading ? 'Kişiler yükleniyor...' : error !== '' ? error : 'Eşleşen çalışan yok'}
          </ThemedText>
        }
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() => openChat(item)}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: pressed ? colors.surfaceRaised : 'transparent',
                borderBottomColor: colors.border,
                borderBottomWidth: index === filtered.length - 1 ? 0 : StyleSheet.hairlineWidth,
              },
            ]}>
            <Avatar name={item.name} />
            <View style={styles.rowBody}>
              <ThemedText style={styles.rowName}>{item.name}</ThemedText>
              <ThemedText style={[styles.rowRole, { color: colors.textMuted }]}>{item.role}</ThemedText>
            </View>
          </Pressable>
        )}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    margin: Space.md,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 16 },
  list: { paddingHorizontal: Space.md, paddingBottom: Space.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingVertical: Space.md,
    paddingHorizontal: Space.xs,
  },
  avatar: { width: 46, height: 46, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '700', fontSize: 15 },
  rowBody: { flex: 1, gap: 2 },
  rowName: { fontWeight: '600', fontSize: 15 },
  rowRole: { fontSize: 13 },
  empty: { textAlign: 'center', marginTop: Space.xxl },
});