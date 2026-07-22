import { ScrollView, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDesign } from '@/hooks/use-design';
import { Radius, Space } from '@/constants/design';
import { useBranchesStore, PURGE_AFTER_MS } from '@/store/branchesStore';
import { useUsersStore } from '@/store/usersStore';

function remaining(deletedAtMs: number) {
  const ms = Math.max(0, deletedAtMs + PURGE_AFTER_MS - Date.now());
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  return `${hours} sa ${minutes} dk`;
}

export default function DeletedScreen() {
  const { colors } = useDesign();

  const branches = useBranchesStore((s) => s.branches);
  const branchDeletedAt = useBranchesStore((s) => s.deletedAt);
  const restoreBranch = useBranchesStore((s) => s.restoreBranch);

  const users = useUsersStore((s) => s.users);
  const userDeletedAt = useUsersStore((s) => s.deletedAt);
  const restoreUser = useUsersStore((s) => s.restoreUser);

  const deletedBranches = branches.filter((b) => b.id in branchDeletedAt);
  const deletedUsers = users.filter((u) => u.id in userDeletedAt);

  const nothing = deletedBranches.length === 0 && deletedUsers.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Silinenler',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
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

          {deletedBranches.length > 0 && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Silinen Şubeler</ThemedText>
              {deletedBranches.map((b) => (
                <Card key={b.id}>
                  <View style={styles.row}>
                    <View style={styles.rowBody}>
                      <ThemedText style={[styles.name, styles.strike, { color: colors.textMuted }]}>
                        {b.name}
                      </ThemedText>
                      <ThemedText style={[styles.timer, { color: colors.danger }]}>
                        Kalıcı silinmeye kalan: {remaining(branchDeletedAt[b.id])}
                      </ThemedText>
                    </View>
                  </View>
                  <Button label="Geri Al" onPress={() => restoreBranch(b.id)} variant="ghost" />
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
                      <ThemedText style={[styles.timer, { color: colors.danger }]}>
                        Kalıcı silinmeye kalan: {remaining(userDeletedAt[u.id])}
                      </ThemedText>
                    </View>
                  </View>
                  <Button label="Geri Al" onPress={() => restoreUser(u.id)} variant="ghost" />
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
  timer: { fontSize: 12 },
  emptyState: { alignItems: 'center', paddingVertical: Space.xxl },
  emptyText: { fontSize: 15, fontStyle: 'italic' },
});