import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui/screen';
import { Card } from '@/components/ui/card';
import { useDesign } from '@/hooks/use-design';
import { Space, Radius } from '@/constants/design';
import { getErrorMessage } from '@/services/api';
import { fetchDashboard } from '@/services/dashboard';
import { leaveTypeEmoji } from '@/constants/leave';
import { useAuthStore } from '@/store/authStore';
import { useLeaveRequestsStore } from '@/store/leaveRequestsStore';

import type { AdminDashboard, HrDashboard } from '@/services/dashboard';

const ROLE_LABEL: Record<string, string> = {
  EMPLOYEE: 'Personel',
  HR: 'İnsan Kaynakları',
  ADMIN: 'Sistem Yöneticisi',
};

const LEAVE_TYPE_LABEL: Record<string, string> = {
  ANNUAL: 'Yıllık',
  SICK: 'Sağlık',
  OTHER: 'Mazeret',
  UNPAID: 'Ücretsiz',
  EMERGENCY: 'Acil',
};

// ---- İstatistik kartı ----
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

// Küçük yatay istatistik (kart içinde)
function StatInline({ label, value }: { label: string; value: string }) {
  const { colors } = useDesign();
  return (
    <View style={styles.inlineItem}>
      <ThemedText style={[styles.inlineValue, { color: colors.text }]}>{value}</ThemedText>
      <ThemedText style={[styles.inlineLabel, { color: colors.textMuted }]}>{label}</ThemedText>
    </View>
  );
}

// ---- Şube başına personel (admin) ----
function BranchDistribution({ data }: { data: AdminDashboard['workplaceComparison'] }) {
  const { colors } = useDesign();

  const allRows = [...data].sort((a, b) => b.employeeCount - a.employeeCount);
  const TOP_N = 6;
  const rows = allRows.slice(0, TOP_N);
  const remaining = allRows.length - rows.length;
  const max = Math.max(1, ...allRows.map((r) => r.employeeCount));

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
            <View key={r.workplaceId} style={styles.barBlock}>
              <View style={styles.barTop}>
                <ThemedText style={styles.barLabel} numberOfLines={1}>{r.workplaceName}</ThemedText>
                <ThemedText style={[styles.barCount, { color: colors.textMuted }]}>{r.employeeCount}</ThemedText>
              </View>
              <View style={[styles.barTrack, { backgroundColor: colors.surfaceRaised }]}>
                <View
                  style={[
                    styles.barFill,
                    { backgroundColor: colors.primary, width: `${(r.employeeCount / max) * 100}%` },
                  ]}
                />
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
function AdminPanel({ data }: { data: AdminDashboard }) {
  const { colors } = useDesign();
  const usage = data.systemUsage;

  return (
    <>
      <View style={styles.statsGrid}>
        <StatCard label="Aktif şube" value={String(data.activeWorkplaceCount)} />
        <StatCard label="Toplam personel" value={String(data.totalEmployeeCount)} />
      </View>

      {/* Şartname: organizasyon geneli şube karşılaştırmaları */}
      <BranchDistribution data={data.workplaceComparison} />

      {/* Şartname: anlık WebSocket kullanım istatistiği */}
      <Card>
        <ThemedText style={styles.cardHeading}>Anlık Sistem Kullanımı</ThemedText>
        {usage.status === 'AVAILABLE' ? (
          <View style={styles.softDeleteRow}>
            <StatInline label="Aktif bağlantı" value={String(usage.activeConnectionCount ?? 0)} />
            <StatInline label="Online kullanıcı" value={String(usage.activeUserCount ?? 0)} />
          </View>
        ) : (
          <ThemedText style={[styles.empty, { color: colors.textMuted }]}>
            Anlık kullanım verisi şu anda alınamıyor
          </ThemedText>
        )}
      </Card>

      {/* Şartname: soft-delete pasif veri hacmi */}
      <Card>
        <ThemedText style={styles.cardHeading}>Pasif Veri Hacmi (Soft-Delete)</ThemedText>
        <View style={styles.softDeleteRow}>
          <StatInline label="Silinen şube" value={String(data.softDeletedDataVolume.workplaces)} />
          <StatInline label="Silinen kullanıcı" value={String(data.softDeletedDataVolume.users)} />
          <StatInline label="Silinen izin" value={String(data.softDeletedDataVolume.leaveRequests)} />
          <StatInline label="Toplam" value={String(data.softDeletedDataVolume.totalCount)} />
        </View>
      </Card>
    </>
  );
}

// ---- HR paneli ----
function HRPanel({ data }: { data: HrDashboard }) {
  const { colors } = useDesign();
  const distribution = data.leaveTypeDistribution;
  const critical = data.criticalLeaveBalances;

  return (
    <>
      <View style={styles.statsGrid}>
        <StatCard label="Şubedeki personel" value={String(data.employeeCount)} />
        <StatCard label="Şubedeki İK" value={String(data.hrCount)} />
      </View>

      {/* Şartname: anlık izinli personel + bekleyen talepler */}
      <View style={styles.statsGrid}>
        <StatCard
          label="Bugün izinli"
          value={String(data.leaveStatus.onLeaveTodayCount)}
          hint={data.workplace.name}
        />
        <StatCard
          label="Bekleyen talep"
          value={String(data.leaveStatus.pendingRequestCount)}
          hint="İzin Onay ekranında"
        />
      </View>

      {/* Şartname: izin tipi kullanım dağılımı (bu yıl, onaylılar) */}
      <Card>
        <ThemedText style={styles.cardHeading}>İzin Tipi Dağılımı</ThemedText>
        {distribution.length === 0 ? (
          <ThemedText style={[styles.empty, { color: colors.textMuted }]}>
            Bu yıl onaylanmış izin kaydı yok
          </ThemedText>
        ) : (
          distribution.map((item) => {
            const label = LEAVE_TYPE_LABEL[item.leaveType] ?? item.leaveType;
            return (
              <View key={item.leaveType} style={styles.typeRow}>
                <ThemedText style={styles.typeLabel}>
                  {leaveTypeEmoji(label)} {label}
                </ThemedText>
                <ThemedText style={[styles.typeMeta, { color: colors.textMuted }]}>
                  {item.requestCount} talep · {item.chargedLeaveDays} gün
                </ThemedText>
              </View>
            );
          })
        )}
      </Card>

      {/* Şartname: kritik bakiye personel listesi */}
      <Card>
        <ThemedText style={styles.cardHeading}>Kritik İzin Bakiyesi</ThemedText>
        {critical.length === 0 ? (
          <ThemedText style={[styles.empty, { color: colors.textMuted }]}>
            Bakiyesi kritik seviyede personel yok
          </ThemedText>
        ) : (
          critical.map((item) => (
            <View key={item.userId} style={styles.typeRow}>
              <ThemedText style={styles.typeLabel} numberOfLines={1}>{item.name}</ThemedText>
              <ThemedText style={[styles.typeMeta, { color: colors.danger }]}>
                {item.remainingLeaveDays} gün kaldı ({item.usedLeaveDays}/{item.annualLeaveEntitlement})
              </ThemedText>
            </View>
          ))
        )}
      </Card>
    </>
  );
}

// ---- EMPLOYEE paneli ----
function EmployeePanel() {
  const { colors } = useDesign();
  const user = useAuthStore((s) => s.user);
  const mine = useLeaveRequestsStore((s) => s.mine);
  const fetchMine = useLeaveRequestsStore((s) => s.fetchMine);

  // Drawer ekranları açık kaldığı için mount yerine her odaklanmada tazele
  useFocusEffect(
    useCallback(() => {
      void fetchMine();
    }, [fetchMine]),
  );

  const currentYear = new Date().getFullYear();
  const usedDays = mine
    .filter(
      (r) =>
        (r.status === 'APPROVED' || r.status === 'AUTO_APPROVED') &&
        r.startDate.endsWith(String(currentYear)),
    )
    .reduce((sum, r) => sum + r.netDays, 0);
  const pendingCount = mine.filter((r) => r.status === 'PENDING').length;
  const entitlement = user?.entitlement ?? null;

  return (
    <>
      <Card>
        <ThemedText style={[styles.wideLabel, { color: colors.textMuted }]}>
          Yıllık izin hakkı
        </ThemedText>
        <ThemedText style={[styles.wideValue, { color: colors.text }]}>
          {entitlement !== null ? `${entitlement} gün` : '—'}
        </ThemedText>
        <ThemedText style={[styles.wideHint, { color: colors.textFaint }]}>
          Detaylı bakiye İzinlerim'de
        </ThemedText>
      </Card>

      <View style={styles.statsGrid}>
        <StatCard
          label="Kullanılan izin"
          value={`${usedDays} gün`}
          hint={`${currentYear} yılı, onaylılar`}
        />
        <StatCard
          label="Bekleyen talebim"
          value={String(pendingCount)}
          hint={
            entitlement !== null
              ? `Kalan: ${Math.max(entitlement - usedDays, 0)} gün`
              : undefined
          }
        />
      </View>
    </>
  );
}

export default function DashboardScreen() {
  const { colors } = useDesign();
  const user = useAuthStore((s) => s.user);

  const [hr, setHr] = useState<HrDashboard | null>(null);
  const [admin, setAdmin] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const canSeeDashboard = user?.role === 'ADMIN' || user?.role === 'HR';

  const load = useCallback(async () => {
    if (!canSeeDashboard) return;
    try {
      const data = await fetchDashboard();
      setHr(data.hr ?? null);
      setAdmin(data.admin ?? null);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [canSeeDashboard]);

  // Drawer, Panel'i açık tuttuğu için mount'a bağlanamayız: şube/personel
  // silme gibi işlemlerden dönüşte sayaçlar güncel kalsın diye her
  // odaklanmada yeniden çekilir.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <Screen
      refreshControl={
        canSeeDashboard ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
      }>
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

      {error !== '' && (
        <Card>
          <ThemedText style={{ color: colors.danger, fontSize: 13 }}>{error}</ThemedText>
        </Card>
      )}

      {user?.role === 'ADMIN' && admin && <AdminPanel data={admin} />}
      {user?.role === 'HR' && hr && <HRPanel data={hr} />}
      {user?.role === 'EMPLOYEE' && <EmployeePanel />}
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
  softDeleteRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: Space.sm, flexWrap: 'wrap', gap: Space.md },
  inlineItem: { alignItems: 'center', gap: 2 },
  inlineLabel: { fontSize: 12 },
  typeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Space.md,
    marginTop: Space.sm,
  },
  typeLabel: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  typeMeta: { fontSize: 13 },
  wideLabel: { fontSize: 14 },
  wideValue: { fontSize: 30, fontWeight: '700', marginTop: 4, lineHeight: 38 },
  wideHint: { fontSize: 12, marginTop: 4 },
});
