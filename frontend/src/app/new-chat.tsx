import Feather from '@expo/vector-icons/Feather';
import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Avatar, splitFullName } from '@/components/ui/avatar';
import { BackButton } from '@/components/ui/back-button';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { SearchInput } from '@/components/ui/search-input';
import { Space } from '@/constants/design';
import { NARROW_MAX_WIDTH } from '@/constants/layout';
import { useDesign } from '@/hooks/use-design';
import { useWideLayout } from '@/hooks/use-columns';
import { getErrorMessage } from '@/services/api';
import { fetchContacts } from '@/services/employees';
import { useMessagesStore } from '@/store/messagesStore';

import type { Employee } from '@/services/employees';

export default function NewChatScreen() {
  const { colors } = useDesign();
  const wide = useWideLayout();
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
    return contacts.filter((e) =>
      `${e.name} ${e.role}`.toLocaleLowerCase('tr-TR').includes(q),
    );
  }, [contacts, query]);

  /**
   * Geniş ekranda sohbetin kendi sayfası yok — Mesajlar'a dönüp seçilen kişiyi
   * sağ panelde açtırıyoruz. Dar ekranda bugünkü akış: doğrudan sohbet sayfası.
   */
  const openChat = (emp: Employee) => {
    const convId = startConversationWith(emp.id, emp.name, emp.role);
    if (wide) router.replace({ pathname: '/messages', params: { focus: convId } });
    else router.replace(`/chat/${convId}`);
  };

  return (
    <Screen scroll={false}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Yeni Sohbet',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerLeft: () => <BackButton />,
        }}
      />

      <View style={styles.headerWrap}>
        <ThemedText style={[styles.subtitle, { color: colors.textMuted }]}>
          Sohbet başlatmak için bir kişi seç.
        </ThemedText>

        <SearchInput
          value={query}
          onChangeText={setQuery}
          placeholder="Çalışan ara..."
          autoFocus
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        keyboardShouldPersistTaps="handled"
        style={styles.grow}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          loading ? null : error !== '' ? (
            <EmptyState icon="alert-circle" title="Kişiler yüklenemedi" description={error} />
          ) : (
            <EmptyState
              icon="search"
              title="Eşleşen çalışan yok"
              description="Arama koşulunu değiştirip tekrar dene."
            />
          )
        }
        renderItem={({ item, index }) => {
          const [firstName, lastName] = splitFullName(item.name);
          return (
            <Animated.View
              entering={FadeInDown.delay(Math.min(index, 6) * 40)
                .duration(260)
                .springify()
                .damping(18)}>
              <ContactRow
                firstName={firstName}
                lastName={lastName}
                name={item.name}
                role={item.role}
                onPress={() => openChat(item)}
              />
            </Animated.View>
          );
        }}
      />
    </Screen>
  );
}

/** Kişi satırı — Mesajlar listesindeki kartla aynı kabuk */
function ContactRow({
  firstName,
  lastName,
  name,
  role,
  onPress,
}: {
  firstName: string;
  lastName: string;
  name: string;
  role: string;
  onPress: () => void;
}) {
  const { colors } = useDesign();

  return (
    <ListRow onPress={onPress} accessibilityLabel={`${name} ile sohbet başlat`}>
      <Avatar firstName={firstName} lastName={lastName} size={44} />
      <View style={styles.rowBody}>
        <ThemedText style={styles.rowName} numberOfLines={1}>
          {name}
        </ThemedText>
        <ThemedText style={[styles.rowRole, { color: colors.textMuted }]} numberOfLines={1}>
          {role}
        </ThemedText>
      </View>
      <Feather name="chevron-right" size={16} color={colors.textFaint} />
    </ListRow>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },

  // Screen scroll=false genişlik sınırlamıyor (kaydırma çubuğu en sağda kalsın
  // diye); başlık ve liste içeriği burada ortalanıyor.
  headerWrap: {
    width: '100%',
    maxWidth: NARROW_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: Space.xl,
    paddingTop: Space.lg,
    gap: Space.sm,
  },
  subtitle: { fontSize: 14 },
  listContent: {
    width: '100%',
    maxWidth: NARROW_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: Space.xl,
    paddingTop: Space.md,
    paddingBottom: Space.xxl,
    gap: Space.md,
  },

  // Satır kabuğunu ListRow çiziyor
  rowBody: { flex: 1, gap: 2 },
  rowName: { fontSize: 15, fontWeight: '700' },
  rowRole: { fontSize: 12 },
});
