import { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { BackButton } from '@/components/ui/back-button';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDesign } from '@/hooks/use-design';
import { Space } from '@/constants/design';
import { showToast } from '@/store/toastStore';
import { useBranchesStore, PURGE_AFTER_MS } from '@/store/branchesStore';
import { useUsersStore } from '@/store/usersStore';

/** Silinen şube 30 gün içinde geri alınabilir; kalan süre gösterilir */
function remaining(deletedAtIso: string) {
  const deletedAtMs = new Date(deletedAtIso).getTime();
  const ms = Math.max(0, deletedAtMs + PURGE_AFTER_MS - Date.now());
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  return days > 0 ? `${days} gün ${hours} sa` : `${hours} sa`;
}

export default function DeletedScreen() {
  const { colors } = useDesign();

  const deleted = useBranchesStore((s) => s.deleted);
  const fetchDeleted = useBranchesStore((s) => s.fetchDeleted);
  const restoreBranch = useBranchesStore((s) => s.restoreBranch);

  const deletedUsers = useUsersStore((s) => s.deletedUsers);
  const fetchDeletedUsers = useUsersStore((s) => s.fetchDeleted);
  const restoreUser = useUsersStore((s) => s.restoreUser);

  // Ekran her odaklandığında iki liste de sunucudan tazelenir
  useFocusEffect(
    useCallback(() => {
      void fetchDeleted();
      void fetchDeletedUsers();
    }, [fetchDeleted, fetchDeletedUsers]),
  );

  const handleRestoreBranch = (id: string, name: string) => {
    void restoreBranch(id).then((result) => {
      if (!result.ok) {
        showToast({ message: result.message ?? 'Şube geri alınamadı.', tone: 'danger' });
      } else {
        showToast({ message: `"${name}" şubesi geri alındı.`, tone: 'success' });
      }
    });
  };

  const handleRestoreUser = (id: string, name: string) => {
    void restoreUser(id).then((result) => {
      if (!result.ok) {
        showToast({ message: result.message ?? 'Kullanıcı geri alınamadı.', tone: 'danger' });
      } else {
        showToast({ message: `${name} geri alındı ve yeniden aktif.`, tone: 'success' });
      }
    });
  };

  const nothing = deleted.length === 0 && deletedUsers.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Silinenler',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerLeft: () => <BackButton />,
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentWrap}>
          {nothing && (
            <View style={styles.emptyState}>
              <ThemedText style={[styles.emptyText, { color: colors.textMuted }]}>
                Silinen öğe yok
              </ThemedText>
            </View>
          )}

          {deleted.length > 0 && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Silinen Şubeler</ThemedText>
              {deleted.map((b) => (
                <Card key={b.id}>
                  <View style={styles.row}>
                    <View style={styles.rowBody}>
                      <ThemedText style={[styles.name, styles.strike, { color: colors.textMuted }]}>
                        {b.name}
                      </ThemedText>
                      {b.deletedAt && (
                        <ThemedText style={[styles.timer, { color: colors.danger }]}>
                          Kalıcı silinmeye kalan: {remaining(b.deletedAt)}
                        </ThemedText>
                      )}
                    </View>
                  </View>
                  <Button label="Geri Al" onPress={() => handleRestoreBranch(b.id, b.name)} variant="ghost" />
                </Card>
              ))}
            </View>
          )}

          {deletedUsers.length > 0 && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Silinen Kullanıcılar</ThemedText>
              {deletedUsers.map((u) => (
                <Card key={u.id}>
                  <View style={styles.row}>
                    <View style={styles.rowBody}>
                      <ThemedText style={[styles.name, styles.strike, { color: colors.textMuted }]}>
                        {u.firstName} {u.lastName}
                      </ThemedText>
                      <ThemedText style={[styles.meta, { color: colors.textFaint }]} numberOfLines={1}>
                        {u.role}
                        {u.branchName ? ` · ${u.branchName}` : ''} · {u.email}
                      </ThemedText>
                      <ThemedText style={[styles.timer, { color: colors.textMuted }]}>
                        Geri alınana kadar saklanır
                      </ThemedText>
                    </View>
                  </View>
                  <Button
                    label="Geri Al"
                    onPress={() => handleRestoreUser(u.id, `${u.firstName} ${u.lastName}`)}
                    variant="ghost"
                  />
                </Card>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: Space.xl },
  contentWrap: { maxWidth: 900, width: '100%', alignSelf: 'center', gap: Space.lg },
  section: { gap: Space.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: Space.xs },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBody: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '600' },
  strike: { textDecorationLine: 'line-through' },
  meta: { fontSize: 12 },
  timer: { fontSize: 12 },
  emptyState: { alignItems: 'center', paddingVertical: Space.xxl },
  emptyText: { fontSize: 15, fontStyle: 'italic' },
});
