import { StyleSheet, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui/screen';
import { Card } from '@/components/ui/card';
import { useDesign } from '@/hooks/use-design';
import { Space, Radius } from '@/constants/design';
import { useAuthStore } from '@/store/authStore';
import { useBranchesStore } from '@/store/branchesStore';
import { useUsersStore, getBranchUsers } from '@/store/usersStore';

const ROLE_LABEL: Record<string, string> = {
  EMPLOYEE: 'Personel',
  HR: 'İnsan Kaynakları',
  ADMIN: 'Sistem Yöneticisi',
};

// ---- Gerçek istatistik kartı ----
function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const { colors } = useDesign();
  return (
    <View style={styles.statItem}>
      <Card>
        <ThemedText style={[styles.statLabel, { color: colors.textMuted }]}>{label}</ThemedText>
        <ThemedText style={[styles.statValue, { color: colors.text }]}>{value}</ThemedText>
        {hint && <ThemedText style={[styles.statHint, { color: colors.textFaint }]}>{hint}</ThemedText>}
      </Card>
    </View>
  );
}

// ---- Veri bekleyen placeholder kartı ----
function PendingCard({ title, description }: { title: string; description: string }) {
  const { colors } = useDesign();
  return (
    <Card>
      <View style={styles.pendingHeader}>
        <ThemedText style={styles.cardHeading}>{title}</ThemedText>
        <View style={[styles.pendingBadge, { backgroundColor: colors.surfaceRaised }]}>
          <Feather name="clock" size={11} color={colors.textFaint} />
          <ThemedText style={[styles.pendingBadgeText, { color: colors.textFaint }]}>Veri bekleniyor</ThemedText>
        </View>
      </View>
      <ThemedText style={[styles.pendingDesc, { color: colors.textMuted }]}>{description}</ThemedText>
    </Card>
  );
}

// ---- Şube başına personel (gerçek) ----
function BranchDistribution() {
  const { colors } = useDesign();
  const branches = useBranchesStore((s) => s.branches);
  const branchDeletedAt = useBranchesStore((s) => s.deletedAt);
  const users = useUsersStore((s) => s.users);
  const usersDeletedAt = useUsersStore((s) => s.deletedAt);

  const active = branches.filter((b) => !(b.id in branchDeletedAt));
  const allRows = active
    .map((b) => ({ name: b.name, count: getBranchUsers(users, usersDeletedAt, b.id).length }))
    .sort((a, b) => b.count - a.count);

  const TOP_N = 6;
  const rows = allRows.slice(0, TOP_N);
  const remaining = allRows.length - rows.length;
  const max = Math.max(1, ...allRows.map((r) => r.count));

  return (
    <Card>
      <View style={styles.distHeader}>
        <ThemedText style={styles.cardHeading}>Şube Karşılaştırması</ThemedText>
        {allRows.length > 0 && (
          <ThemedText style={[styles.distCount, { color: colors.textFaint }]}>{allRows.length} şube</ThemedText>
        )}
      </View>
      {rows.length === 0 ? (
        <ThemedText style={[styles.empty, { color: colors.textMuted }]}>Henüz şube yok</ThemedText>
      ) : (
        <>
          {rows.map((r) => (
            <View key={r.name} style={styles.barBlock}>
              <View style={styles.barTop}>
                <ThemedText style={styles.barLabel} numberOfLines={1}>{r.name}</ThemedText>
                <ThemedText style={[styles.barCount, { color: colors.textMuted }]}>{r.count}</ThemedText>
              </View>
              <View style={[styles.barTrack, { backgroundColor: colors.surfaceRaised }]}>
                <View style={[styles.barFill, { backgroundColor: colors.primary, width: `${(r.count / max) * 100}%` }]} />
              </View>
            </View>
          ))}
          {remaining > 0 && (
            <ThemedText style={[styles.distMore, { color: colors.textFaint }]}>
              ve {remaining} şube daha — tümü Şubeler bölümünde
            </ThemedText>
          )}
        </>
      )}
    </Card>
  );
}

// ---- ADMIN paneli ----
function AdminPanel() {
  const branches = useBranchesStore((s) => s.branches);
  const branchDeletedAt = useBranchesStore((s) => s.deletedAt);
  const users = useUsersStore((s) => s.users);
  const usersDeletedAt = useUsersStore((s) => s.deletedAt);

  const activeBranches = branches.filter((b) => !(b.id in branchDeletedAt)).length;
  const activeUsers = users.filter((u) => !(u.id in usersDeletedAt)).length;
  const deletedCount = Object.keys(branchDeletedAt).length + Object.keys(usersDeletedAt).length;

  return (
    <>
      <View style={styles.statsGrid}>
        <StatCard label="Aktif şube" value={String(activeBranches)} />
        <StatCard label="Toplam personel" value={String(activeUsers)} />
      </View>

      {/* Şartname: organizasyon geneli şube karşılaştırmaları — GERÇEK */}
      <BranchDistribution />

      {/* Şartname: soft-delete pasif veri hacmi — GERÇEK */}
      <Card>
        <ThemedText style={styles.cardHeading}>Pasif Veri Hacmi (Soft-Delete)</ThemedText>
        <View style={styles.softDeleteRow}>
          <StatInline label="Silinen şube" value={String(Object.keys(branchDeletedAt).length)} />
          <StatInline label="Silinen kullanıcı" value={String(Object.keys(usersDeletedAt).length)} />
          <StatInline label="Toplam" value={String(deletedCount)} />
        </View>
      </Card>

      {/* Şartname: anlık WebSocket kullanım istatistiği — BACKEND'e bağlı */}
      <PendingCard
        title="Anlık Sistem Kullanımı"
        description="Aktif WebSocket bağlantı sayısı ve anlık online kullanıcı istatistikleri, gerçek zamanlı altyapı bağlandığında burada gösterilecek."
      />
    </>
  );
}

// Küçük yatay istatistik (soft-delete kartı içinde)
function StatInline({ label, value }: { label: string; value: string }) {
  const { colors } = useDesign();
  return (
    <View style={styles.inlineItem}>
      <ThemedText style={[styles.inlineValue, { color: colors.text }]}>{value}</ThemedText>
      <ThemedText style={[styles.inlineLabel, { color: colors.textMuted }]}>{label}</ThemedText>
    </View>
  );
}

// ---- HR paneli ----
function HRPanel({ branchId }: { branchId: string | null }) {
  const { colors } = useDesign();
  const branches = useBranchesStore((s) => s.branches);
  const users = useUsersStore((s) => s.users);
  const usersDeletedAt = useUsersStore((s) => s.deletedAt);

  const branch = branches.find((b) => b.id === branchId);
  if (!branch) {
    return <Card><ThemedText style={{ color: colors.textMuted }}>Şube bilgisi bulunamadı</ThemedText></Card>;
  }

  const branchUsers = getBranchUsers(users, usersDeletedAt, branch.id);
  const hrCount = branchUsers.filter((u) => u.role === 'HR').length;
  const empCount = branchUsers.filter((u) => u.role === 'EMPLOYEE').length;

  return (
    <>
      {/* Şubenin kendi verisi — GERÇEK */}
      <View style={styles.statsGrid}>
        <StatCard label="Şubedeki personel" value={String(empCount)} />
        <StatCard label="Şubedeki İK" value={String(hrCount)} />
      </View>

      {/* Şartname: anlık izinli personel + bekleyen talepler — izin verisine bağlı */}
      <PendingCard
        title="İzin Durumu"
        description={`${branch.name} şubesinde bugün izinli personel sayısı ve işlem bekleyen talepler, izin modülü bağlandığında burada gösterilecek.`}
      />

      {/* Şartname: izin tipi kullanım dağılımı — izin verisine bağlı */}
      <PendingCard
        title="İzin Tipi Dağılımı"
        description="Yıllık, sağlık ve mazeret izinlerinin kullanım dağılım grafiği, izin modülü bağlandığında burada gösterilecek."
      />

      {/* Şartname: kritik bakiye personel listesi — bakiye backend'de */}
      <PendingCard
        title="Kritik İzin Bakiyesi"
        description="İzin bakiyesi kurum içi limitin altına düşen personel listesi, izin bakiyesi verisi bağlandığında burada gösterilecek."
      />
    </>
  );
}

// ---- EMPLOYEE paneli ----
function EmployeePanel({ branchId }: { branchId: string | null }) {
  const { colors } = useDesign();
  const branches = useBranchesStore((s) => s.branches);
  const branch = branches.find((b) => b.id === branchId);

  return (
    <>
      <Card>
        <ThemedText style={[styles.wideLabel, { color: colors.textMuted }]}>
          Yıllık izin hakkı
        </ThemedText>
        <ThemedText style={[styles.wideValue, { color: colors.text }]}>
          {branch ? `${branch.defaultLeaveDays} gün` : '—'}
        </ThemedText>
        <ThemedText style={[styles.wideHint, { color: colors.textFaint }]}>
          Detaylı bakiye İzinlerim'de
        </ThemedText>
      </Card>

      <PendingCard
        title="İzin Özetim"
        description="Kalan izin günlerin ve bekleyen taleplerinin özeti, izin modülü bağlandığında burada gösterilecek."
      />
    </>
  );
}

export default function DashboardScreen() {
  const { colors } = useDesign();
  const user = useAuthStore((s) => s.user);

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText style={[styles.greeting, { color: colors.textMuted }]}>Merhaba,</ThemedText>
        <ThemedText type="title">{user?.name}</ThemedText>
        <View style={styles.headerTags}>
          <View style={[styles.rolePill, { backgroundColor: colors.primarySoft }]}>
            <ThemedText style={[styles.roleText, { color: colors.primary }]}>
              {user ? ROLE_LABEL[user.role] : ''}
            </ThemedText>
          </View>
          {user?.branchName && (
            <ThemedText style={[styles.branch, { color: colors.textMuted }]}>📍 {user.branchName}</ThemedText>
          )}
        </View>
      </View>

      {user?.role === 'ADMIN' && <AdminPanel />}
      {user?.role === 'HR' && <HRPanel branchId={user.branchId} />}
      {user?.role === 'EMPLOYEE' && <EmployeePanel branchId={user.branchId} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: Space.sm, marginBottom: Space.lg, gap: Space.xs },
  greeting: { fontSize: 15 },
  headerTags: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, marginTop: Space.xs, flexWrap: 'wrap' },
  rolePill: { paddingHorizontal: Space.md, paddingVertical: 5, borderRadius: Radius.pill },
  roleText: { fontSize: 13, fontWeight: '600' },
  branch: { fontSize: 13 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: Space.md },
  statItem: { width: '50%', padding: Space.sm },
  statLabel: { fontSize: 13 },
  statValue: { fontSize: 26, fontWeight: '700', marginTop: 2, lineHeight: 33 },
  inlineValue: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
  statHint: { fontSize: 11, marginTop: 2 },
  cardHeading: { fontSize: 16, fontWeight: '700' },
  empty: { fontSize: 13, fontStyle: 'italic' },
  distHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: Space.sm },
  distCount: { fontSize: 12 },
  distMore: { fontSize: 12, marginTop: Space.xs, fontStyle: 'italic' },
  barBlock: { marginBottom: Space.md },
  barTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  barLabel: { fontSize: 14, fontWeight: '600', flex: 1, marginRight: Space.sm },
  barCount: { fontSize: 13, fontWeight: '600' },
  barTrack: { height: 10, borderRadius: Radius.pill, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: Radius.pill },
  softDeleteRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: Space.sm },
  inlineItem: { alignItems: 'center', gap: 2 },
  inlineLabel: { fontSize: 12 },
  pendingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Space.sm },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Space.sm, paddingVertical: 3, borderRadius: Radius.pill },
  pendingBadgeText: { fontSize: 10, fontWeight: '600' },
  pendingDesc: { fontSize: 13, lineHeight: 19 },
  wideLabel: { fontSize: 14 },
  wideValue: { fontSize: 30, fontWeight: '700', marginTop: 4, lineHeight: 38 },
  wideHint: { fontSize: 12, marginTop: 4 },
});