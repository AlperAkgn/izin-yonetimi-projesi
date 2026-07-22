import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { useDesign } from '@/hooks/use-design';
import { Radius, Space } from '@/constants/design';
import { showConfirm } from '@/utils/alert';
import { useBranchesStore } from '@/store/branchesStore';
import { useUsersStore, getBranchUsers, AppUser } from '@/store/usersStore';

const ROLE_LABEL: Record<string, string> = { EMPLOYEE: 'Personel', HR: 'İnsan Kaynakları' };

function PersonRow({ user, onRemove }: { user: AppUser; onRemove: () => void }) {
  const { colors } = useDesign();
  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();
  return (
    <Card>
      <View style={styles.personRow}>
        <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
          <ThemedText style={[styles.avatarText, { color: colors.primary }]}>{initials}</ThemedText>
        </View>
        <View style={styles.personBody}>
          <ThemedText style={styles.personName}>{user.firstName} {user.lastName}</ThemedText>
          <ThemedText style={[styles.personDetail, { color: colors.textMuted }]} numberOfLines={1}>
            {user.email}
          </ThemedText>
        </View>
        <Pressable onPress={onRemove} style={styles.removeButton}>
          <Feather name="user-minus" size={18} color={colors.danger} />
        </Pressable>
      </View>
    </Card>
  );
}

export default function BranchDetailScreen() {
  const { colors } = useDesign();
  const { id } = useLocalSearchParams<{ id: string }>();
  const branches = useBranchesStore((s) => s.branches);
  const users = useUsersStore((s) => s.users);
  const removeFromBranch = useUsersStore((s) => s.removeFromBranch);

  const branch = branches.find((b) => b.id === id);
  const branchUsers = getBranchUsers(users, id);
  const hrUsers = branchUsers.filter((u) => u.role === 'HR');
  const employeeUsers = branchUsers.filter((u) => u.role === 'EMPLOYEE');

  const handleRemove = (user: AppUser) => {
    showConfirm(
      'Personeli Çıkar',
      `${user.firstName} ${user.lastName}, ${branch?.name} şubesinden çıkarılacak. Kullanıcı silinmez, sadece şube ataması kaldırılır. Emin misin?`,
      'Çıkar',
      () => removeFromBranch(user.id)
    );
  };

  const sections = [
    { title: `İnsan Kaynakları (${hrUsers.length})`, data: hrUsers },
    { title: `Personel (${employeeUsers.length})`, data: employeeUsers },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: branch?.name ?? 'Şube',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
        }}
      />

      <FlatList
        data={sections}
        keyExtractor={(s) => s.title}
        contentContainerStyle={styles.list}
        renderItem={({ item: section }) => (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
            {section.data.length === 0 ? (
              <ThemedText style={[styles.empty, { color: colors.textMuted }]}>
                Bu kategoride kimse yok
              </ThemedText>
            ) : (
              section.data.map((u) => (
                <PersonRow key={u.id} user={u} onRemove={() => handleRemove(u)} />
              ))
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: Space.xl, gap: Space.lg, maxWidth: 1200, width: '100%', alignSelf: 'center' },
  section: { gap: Space.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: Space.xs },
  empty: { fontSize: 13, fontStyle: 'italic' },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  avatar: { width: 44, height: 44, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '700', fontSize: 15 },
  personBody: { flex: 1, gap: 2 },
  personName: { fontSize: 15, fontWeight: '600' },
  personDetail: { fontSize: 12 },
  removeButton: { padding: Space.sm },
});