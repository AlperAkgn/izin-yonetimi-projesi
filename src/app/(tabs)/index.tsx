import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Space } from '@/constants/design';
import { useDesign } from '@/hooks/use-design';
import { useAuthStore } from '@/store/authStore';

type Stat = { label: string; value: string };

const STATS_BY_ROLE: Record<string, Stat[]> = {
  EMPLOYEE: [
    { label: 'Kalan izin bakiyem', value: '14 gün' },
    { label: 'Bekleyen talebim', value: '1' },
    { label: 'Bu yıl kullanılan', value: '6 gün' },
  ],
  HR: [
    { label: 'Şubede bugün izinli', value: '3 kişi' },
    { label: 'Onay bekleyen', value: '5' },
    { label: 'Bu ay onaylanan', value: '18' },
  ],
  ADMIN: [
    { label: 'Toplam şube', value: '4' },
    { label: 'Aktif kullanıcı', value: '42' },
    { label: 'Anlık bağlantı', value: '11' },
  ],
};

const ROLE_LABEL: Record<string, string> = {
  EMPLOYEE: 'Personel',
  HR: 'İnsan Kaynakları',
  ADMIN: 'Sistem Yöneticisi',
};

function StatCard({ label, value, accent }: Stat & { accent: string }) {
  const { colors } = useDesign();
  return (
    <Card>
      <ThemedText style={[styles.statLabel, { color: colors.textMuted }]}>{label}</ThemedText>
      <ThemedText style={[styles.statValue, { color: accent }]}>{value}</ThemedText>
    </Card>
  );
}

export default function DashboardScreen() {
  const { colors } = useDesign();
  const user = useAuthStore((s) => s.user);
  const stats = user ? STATS_BY_ROLE[user.role] ?? [] : [];

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText style={[styles.greeting, { color: colors.textMuted }]}>
          Merhaba,
        </ThemedText>
        <ThemedText type="title">{user?.name}</ThemedText>
        <View style={[styles.rolePill, { backgroundColor: colors.primarySoft }]}>
          <ThemedText style={[styles.roleText, { color: colors.primary }]}>
            {user ? ROLE_LABEL[user.role] : ''}
          </ThemedText>
        </View>
      </View>

      <View style={styles.statsWrapper}>
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} accent={colors.text} />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: Space.sm,
    marginBottom: Space.lg,
    gap: Space.xs,
  },
  greeting: {
    fontSize: 15,
  },
  rolePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: Space.md,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: Space.xs,
  },
  roleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statsWrapper: {
    gap: Space.md,
  },
  statLabel: {
    fontSize: 14,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
  },
});