import Feather from '@expo/vector-icons/Feather';
import { router, useFocusEffect } from 'expo-router';
import { Children, useCallback, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Screen } from '@/components/ui/screen';
import { Card } from '@/components/ui/card';
import { DetailSheet } from '@/components/ui/detail-sheet';
import { Notice } from '@/components/ui/notice';
import { SectionHeader } from '@/components/ui/section-header';
import { useDesign } from '@/hooks/use-design';
import { useWideLayout } from '@/hooks/use-columns';
import { Palette, Space, Radius } from '@/constants/design';
import { getErrorMessage } from '@/services/api';
import { fetchDashboard } from '@/services/dashboard';
import { leaveTypeColor, leaveTypeEmoji, leaveTypeFromApi } from '@/constants/leave';
import { useAuthStore } from '@/store/authStore';
import { useLeaveRequestsStore } from '@/store/leaveRequestsStore';
import { formatDate, isoToDisplayDate } from '@/utils/date';

import type { FeatherName } from '@/components/ui/icon';
import type { AuthUser } from '@/store/authStore';
import type { AdminDashboard, EmployeeLeaveBalance, HrDashboard } from '@/services/dashboard';

const ROLE_LABEL: Record<string, string> = {
  EMPLOYEE: 'Personel',
  HR: 'İnsan Kaynakları',
  ADMIN: 'Sistem Yöneticisi',
};

/** Kritik olmayan personelden kaç kişinin "limite en yakın" listesine gireceği */
const WATCHLIST_SIZE = 3;

// ─────────────────────────────────────────────────────────────────────
// Yerleşim
//
// Tek boşluk ölçüsü kullanılır: Space.md. Screen'in kendi `gap`'i de aynı
// olduğu için satır arası, sütun arası ve bölüm arası mesafeler eşitlenir —
// panelin dağınık görünmesinin asıl sebebi burada üst üste binen üç ayrı
// boşluk mekanizmasıydı (padding + margin + gap).
// ─────────────────────────────────────────────────────────────────────

/**
 * Kart *içeriklerini* alır, kart kabuğunu (kenarlık, dolgu) kendisi çizer.
 * Geniş ekranda iki eşit sütun; kartlar aynı satırda aynı yüksekliğe uzar.
 * Dar ekranda alt alta tam genişlik — telefon görünümü değişmez.
 */
function CardGrid({ children }: { children: ReactNode }) {
  const wide = useWideLayout();
  const items = Children.toArray(children);

  if (!wide) {
    return (
      <>
        {items.map((child, index) => (
          <Card key={index}>{child}</Card>
        ))}
      </>
    );
  }

  return (
    <View style={styles.contentRow}>
      {items.map((child, index) => (
        <View key={index} style={styles.contentCol}>
          <Card style={styles.fill}>{child}</Card>
        </View>
      ))}
    </View>
  );
}

/**
 * Panelin üst şeridindeki sayı kutusu. Renkli ikon rozeti satıra ritim
 * verir; ok işareti kutunun tıklanabilir olduğunu gösterir.
 */
function StatTile({
  icon,
  tone,
  label,
  value,
  hint,
  onPress,
}: {
  icon: FeatherName;
  tone: string;
  label: string;
  value: string;
  hint?: string;
  onPress?: () => void;
}) {
  const { colors } = useDesign();
  const wide = useWideLayout();

  const card = (
    <Card style={styles.tile}>
      <View style={styles.tileHead}>
        <View style={[styles.tileIcon, { backgroundColor: `${tone}22` }]}>
          <Feather name={icon} size={16} color={tone} />
        </View>
        {onPress && <Feather name="chevron-right" size={16} color={colors.textFaint} />}
      </View>
      <ThemedText style={[styles.tileValue, { color: colors.text }]}>{value}</ThemedText>
      <ThemedText style={[styles.tileLabel, { color: colors.textMuted }]}>{label}</ThemedText>
      {hint !== undefined && (
        <ThemedText style={[styles.tileHint, { color: colors.textFaint }]} numberOfLines={1}>
          {hint}
        </ThemedText>
      )}
    </Card>
  );

  // Geniş ekranda tek sıra (dörde bölünür), dar ekranda ikişerli sarar
  const item = wide ? styles.tileItemWide : styles.tileItemNarrow;

  if (!onPress) return <View style={item}>{card}</View>;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [item, pressed ? styles.pressed : undefined]}>
      {card}
    </Pressable>
  );
}

/** Etiket–değer satırı (kart içi özet listesi) */
function MetaRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const { colors } = useDesign();
  return (
    <View style={styles.metaRow}>
      <ThemedText style={[styles.metaLabel, { color: colors.textMuted }]} numberOfLines={1}>
        {label}
      </ThemedText>
      <ThemedText
        style={[styles.metaValue, { color: strong ? colors.text : colors.textMuted }]}>
        {value}
      </ThemedText>
    </View>
  );
}

/** Detay listelerindeki kişi satırı */
function PersonRow({ name, meta, tone }: { name: string; meta?: string; tone?: string }) {
  const { colors } = useDesign();
  const [firstName, ...rest] = name.split(' ');

  return (
    <View style={styles.personRow}>
      <Avatar firstName={firstName ?? ''} lastName={rest.join(' ')} size={36} />
      <View style={styles.grow}>
        <ThemedText style={styles.personName} numberOfLines={1}>{name}</ThemedText>
        {meta !== undefined && (
          <ThemedText style={[styles.personMeta, { color: tone ?? colors.textMuted }]}>
            {meta}
          </ThemedText>
        )}
      </View>
    </View>
  );
}

/** Liste boşken kart/sayfa içi kısa mesaj */
function EmptyLine({ text }: { text: string }) {
  const { colors } = useDesign();
  return <ThemedText style={[styles.empty, { color: colors.textMuted }]}>{text}</ThemedText>;
}

// ─────────────────────────────────────────────────────────────────────
// Kart içerikleri (kabuğu CardGrid çizer)
// ─────────────────────────────────────────────────────────────────────

/** Şube başına personel — satırlar şube detayına gider */
function BranchComparison({ data }: { data: AdminDashboard['workplaceComparison'] }) {
  const { colors } = useDesign();

  const allRows = [...data].sort((a, b) => b.employeeCount - a.employeeCount);
  const TOP_N = 6;
  const rows = allRows.slice(0, TOP_N);
  const remaining = allRows.length - rows.length;
  const max = Math.max(1, ...allRows.map((r) => r.employeeCount));

  return (
    <>
      <SectionHeader
        icon="bar-chart-2"
        title="Şube Karşılaştırması"
        subtitle={allRows.length === 0 ? 'Henüz şube yok' : `${allRows.length} şube · personel sayısı`}
      />
      {rows.length === 0 ? (
        <EmptyLine text="Şube eklendiğinde karşılaştırma burada görünür" />
      ) : (
        <View style={styles.rowList}>
          {rows.map((r) => (
            <Pressable
              key={r.workplaceId}
              onPress={() => router.push(`/branch/${r.workplaceId}`)}
              accessibilityRole="button"
              accessibilityLabel={`${r.workplaceName}: ${r.employeeCount} personel`}
              style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
              <View style={styles.barTop}>
                <ThemedText style={styles.barLabel} numberOfLines={1}>{r.workplaceName}</ThemedText>
                <ThemedText style={[styles.barCount, { color: colors.textMuted }]}>
                  {r.employeeCount}
                </ThemedText>
              </View>
              <View style={[styles.barTrack, { backgroundColor: colors.surfaceRaised }]}>
                <View
                  style={[
                    styles.barFill,
                    { backgroundColor: colors.primary, width: `${(r.employeeCount / max) * 100}%` },
                  ]}
                />
              </View>
            </Pressable>
          ))}
          {remaining > 0 && (
            <ThemedText style={[styles.footnote, { color: colors.textFaint }]}>
              ve {remaining} şube daha — tümü Şubeler bölümünde
            </ThemedText>
          )}
        </View>
      )}
    </>
  );
}

/** Şartname: soft-delete pasif veri hacmi */
function SoftDeleteVolume({ data }: { data: AdminDashboard['softDeletedDataVolume'] }) {
  return (
    <>
      <SectionHeader
        icon="archive"
        title="Pasif Veri Hacmi"
        subtitle="Soft-delete ile saklanan kayıtlar"
      />
      <View style={styles.rowList}>
        <MetaRow label="Silinen şube" value={String(data.workplaces)} />
        <MetaRow label="Silinen kullanıcı" value={String(data.users)} />
        <MetaRow label="Silinen izin" value={String(data.leaveRequests)} />
        <MetaRow label="Toplam" value={String(data.totalCount)} strong />
      </View>
    </>
  );
}

/**
 * Şartname: izin tipi kullanım dağılımı (bu yıl, onaylılar).
 * Grafik iki katmanlı — üstte payları gösteren yığılmış şerit, altında
 * aynı renklerle okunan tür kırılımı.
 */
function LeaveTypeDistribution({ data }: { data: HrDashboard['leaveTypeDistribution'] }) {
  const { colors } = useDesign();
  const year = new Date().getFullYear();

  const rows = data.map((item) => ({ ...item, label: leaveTypeFromApi(item.leaveType) }));
  const totalDays = rows.reduce((sum, r) => sum + r.chargedLeaveDays, 0);
  const totalRequests = rows.reduce((sum, r) => sum + r.requestCount, 0);

  return (
    <>
      <SectionHeader
        icon="pie-chart"
        title="İzin Tipi Dağılımı"
        subtitle={
          totalDays === 0
            ? `${year} · onaylanmış izin yok`
            : `${year} · ${totalDays} gün · ${totalRequests} talep`
        }
      />

      {totalDays === 0 ? (
        <EmptyLine text="Onaylanan talepler buradaki dağılıma girer" />
      ) : (
        <>
          <View style={[styles.stackTrack, { backgroundColor: colors.surfaceRaised }]}>
            {rows.map((r) => (
              <View
                key={r.leaveType}
                style={{ flex: r.chargedLeaveDays, backgroundColor: leaveTypeColor(r.label) }}
              />
            ))}
          </View>

          <View style={styles.rowList}>
            {rows.map((r) => (
              <View key={r.leaveType} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: leaveTypeColor(r.label) }]} />
                <ThemedText style={styles.legendLabel} numberOfLines={1}>
                  {leaveTypeEmoji(r.label)} {r.label}
                </ThemedText>
                <ThemedText style={[styles.legendMeta, { color: colors.textMuted }]}>
                  {r.chargedLeaveDays} gün · {r.requestCount} talep
                </ThemedText>
                <ThemedText style={[styles.legendShare, { color: colors.text }]}>
                  %{Math.round((r.chargedLeaveDays / totalDays) * 100)}
                </ThemedText>
              </View>
            ))}
          </View>
        </>
      )}
    </>
  );
}

/** Tek personelin bakiye şeridi */
function BalanceRow({ item, tone }: { item: EmployeeLeaveBalance; tone: string }) {
  const { colors } = useDesign();
  const ratio =
    item.annualLeaveEntitlement > 0 ? item.usedLeaveDays / item.annualLeaveEntitlement : 0;

  return (
    <View>
      <View style={styles.barTop}>
        <ThemedText style={styles.barLabel} numberOfLines={1}>{item.name}</ThemedText>
        <ThemedText style={[styles.barCount, { color: tone }]}>
          {item.remainingLeaveDays} gün kaldı
        </ThemedText>
      </View>
      <View style={[styles.barTrack, { backgroundColor: colors.surfaceRaised }]}>
        <View
          style={[styles.barFill, { backgroundColor: tone, width: `${Math.min(ratio, 1) * 100}%` }]}
        />
      </View>
      <ThemedText style={[styles.footnote, { color: colors.textFaint }]}>
        {item.usedLeaveDays} / {item.annualLeaveEntitlement} gün kullanıldı
      </ThemedText>
    </View>
  );
}

/** Şartname: kurum içi limitin altına düşen personel listesi */
function CriticalBalances({
  employees,
  threshold,
}: {
  employees: EmployeeLeaveBalance[];
  threshold: number;
}) {
  const { colors } = useDesign();

  // Liste ada göre geliyor; burada bakiyesi en azdan çoğa sıralanır
  const byRemaining = [...employees].sort(
    (a, b) => a.remainingLeaveDays - b.remainingLeaveDays || a.name.localeCompare(b.name, 'tr'),
  );
  const critical = byRemaining.filter((item) => item.isCritical);
  // Kritik kimse yokken kart boş kalmasın: limite en yakın personel gösterilir
  const watchlist = byRemaining.filter((item) => !item.isCritical).slice(0, WATCHLIST_SIZE);

  return (
    <>
      <SectionHeader
        icon="alert-triangle"
        title="Kritik İzin Bakiyesi"
        subtitle={`Kurum içi limit: ${threshold} gün ve altı`}
      />

      {critical.length > 0 ? (
        <>
          <Notice
            icon="alert-triangle"
            text={`${critical.length} personelin kalan izni limitin altında`}
            color={colors.danger}
          />
          <View style={styles.rowList}>
            {critical.map((item) => (
              <BalanceRow key={item.userId} item={item} tone={colors.danger} />
            ))}
          </View>
        </>
      ) : (
        <>
          <Notice
            icon="check-circle"
            text="Bakiyesi kritik seviyede personel yok"
            color={colors.success}
          />
          {watchlist.length > 0 && (
            <>
              <ThemedText style={[styles.subHeading, { color: colors.textMuted }]}>
                Limite en yakın personel
              </ThemedText>
              <View style={styles.rowList}>
                {watchlist.map((item) => (
                  <BalanceRow key={item.userId} item={item} tone={colors.success} />
                ))}
              </View>
            </>
          )}
        </>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Paneller
// ─────────────────────────────────────────────────────────────────────

function AdminPanel({ data }: { data: AdminDashboard }) {
  const { colors } = useDesign();
  const usage = data.systemUsage;
  const usageAvailable = usage.status === 'AVAILABLE';
  const [staffSheetOpen, setStaffSheetOpen] = useState(false);

  const branchesByStaff = [...data.workplaceComparison].sort(
    (a, b) => b.employeeCount - a.employeeCount,
  );

  const openBranch = (workplaceId: number) => {
    setStaffSheetOpen(false);
    router.push(`/branch/${workplaceId}`);
  };

  return (
    <>
      <View style={styles.tileRow}>
        <StatTile
          icon="map-pin"
          tone={Palette.primary}
          label="Aktif şube"
          value={String(data.activeWorkplaceCount)}
          hint="Şubeler ekranını aç"
          onPress={() => router.push('/branches')}
        />
        <StatTile
          icon="users"
          tone={Palette.primary}
          label="Toplam personel"
          value={String(data.totalEmployeeCount)}
          hint="Şube dağılımını gör"
          onPress={() => setStaffSheetOpen(true)}
        />
        {/* Şartname: anlık WebSocket kullanım istatistiği */}
        <StatTile
          icon="activity"
          tone={Palette.success}
          label="Online kullanıcı"
          value={usageAvailable ? String(usage.activeUserCount ?? 0) : '—'}
          hint={
            usageAvailable
              ? `${usage.activeConnectionCount ?? 0} aktif bağlantı`
              : 'Anlık veri alınamıyor'
          }
        />
        <StatTile
          icon="archive"
          tone={Palette.canceled}
          label="Pasif kayıt"
          value={String(data.softDeletedDataVolume.totalCount)}
          hint="Soft-delete toplamı"
        />
      </View>

      <CardGrid>
        {/* Şartname: organizasyon geneli şube karşılaştırmaları */}
        <BranchComparison data={data.workplaceComparison} />
        <SoftDeleteVolume data={data.softDeletedDataVolume} />
      </CardGrid>

      <DetailSheet
        visible={staffSheetOpen}
        title="Personelin şubelere dağılımı"
        subtitle={`${data.totalEmployeeCount} personel · ${data.activeWorkplaceCount} aktif şube`}
        onClose={() => setStaffSheetOpen(false)}>
        {branchesByStaff.length === 0 ? (
          <EmptyLine text="Henüz aktif şube yok" />
        ) : (
          branchesByStaff.map((branch) => (
            <Pressable
              key={branch.workplaceId}
              onPress={() => openBranch(branch.workplaceId)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.sheetRow, pressed ? styles.pressed : undefined]}>
              <View style={styles.grow}>
                <ThemedText style={styles.personName} numberOfLines={1}>
                  {branch.workplaceName}
                </ThemedText>
                <ThemedText style={[styles.personMeta, { color: colors.textMuted }]}>
                  {branch.employeeCount} personel
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={16} color={colors.textFaint} />
            </Pressable>
          ))
        )}
      </DetailSheet>
    </>
  );
}

type HrSheet = 'employees' | 'hrStaff' | 'onLeave';

function HRPanel({ data }: { data: HrDashboard }) {
  const { colors } = useDesign();
  const [sheet, setSheet] = useState<HrSheet | null>(null);

  const onLeave = data.leaveStatus.onLeaveToday;
  const pending = data.leaveStatus.pendingRequestCount;

  return (
    <>
      {/* Şartname: şube kadrosu + anlık izinli personel + bekleyen talepler */}
      <View style={styles.tileRow}>
        <StatTile
          icon="users"
          tone={Palette.primary}
          label="Şubedeki personel"
          value={String(data.employeeCount)}
          hint="Listeyi gör"
          onPress={() => setSheet('employees')}
        />
        <StatTile
          icon="briefcase"
          tone={Palette.primary}
          label="Şubedeki İK"
          value={String(data.hrCount)}
          hint="Listeyi gör"
          onPress={() => setSheet('hrStaff')}
        />
        <StatTile
          icon="sun"
          tone={Palette.warning}
          label="Bugün izinli"
          value={String(data.leaveStatus.onLeaveTodayCount)}
          hint="Kimler izinde?"
          onPress={() => setSheet('onLeave')}
        />
        <StatTile
          icon="inbox"
          tone={pending > 0 ? Palette.warning : Palette.success}
          label="Bekleyen talep"
          value={String(pending)}
          hint="İzin Onay ekranını aç"
          onPress={() => router.push('/leave-approval')}
        />
      </View>

      <CardGrid>
        <LeaveTypeDistribution data={data.leaveTypeDistribution} />
        <CriticalBalances employees={data.employees} threshold={data.criticalBalanceThreshold} />
      </CardGrid>

      <DetailSheet
        visible={sheet === 'employees'}
        title="Şubedeki personel"
        subtitle={`${data.workplace.name} · ${data.employeeCount} kişi`}
        onClose={() => setSheet(null)}>
        {data.employees.length === 0 ? (
          <EmptyLine text="Şubeye atanmış personel yok" />
        ) : (
          data.employees.map((person) => (
            <PersonRow
              key={person.userId}
              name={person.name}
              meta={`${person.remainingLeaveDays} / ${person.annualLeaveEntitlement} gün kaldı`}
              tone={person.isCritical ? colors.danger : undefined}
            />
          ))
        )}
      </DetailSheet>

      <DetailSheet
        visible={sheet === 'hrStaff'}
        title="Şubedeki İK"
        subtitle={`${data.workplace.name} · ${data.hrCount} kişi`}
        onClose={() => setSheet(null)}>
        {data.hrStaff.length === 0 ? (
          <EmptyLine text="Şubeye atanmış İK kullanıcısı yok" />
        ) : (
          data.hrStaff.map((person) => (
            <PersonRow key={person.userId} name={person.name} meta="İnsan Kaynakları" />
          ))
        )}
      </DetailSheet>

      <DetailSheet
        visible={sheet === 'onLeave'}
        title="Bugün izinli"
        subtitle={`${data.workplace.name} · ${isoToDisplayDate(data.leaveStatus.date)}`}
        onClose={() => setSheet(null)}>
        {onLeave.length === 0 ? (
          <EmptyLine text="Bugün izinde olan personel yok" />
        ) : (
          onLeave.map((person) => {
            const label = leaveTypeFromApi(person.leaveType);
            return (
              <PersonRow
                key={person.userId}
                name={person.name}
                meta={`${leaveTypeEmoji(label)} ${label} · ${isoToDisplayDate(person.startDate)} – ${isoToDisplayDate(person.endDate)}`}
              />
            );
          })
        )}
      </DetailSheet>
    </>
  );
}

/**
 * Personel özeti — telefondan kullanılan görünüm. Yönetici/İK panelinin
 * masaüstü ızgarasından ayrı tutulur; buradaki düzen bilinçli olarak sade.
 */
function EmployeeStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const { colors } = useDesign();
  return (
    <View style={styles.employeeStatItem}>
      <Card>
        <ThemedText style={[styles.tileLabel, { color: colors.textMuted }]}>{label}</ThemedText>
        <ThemedText style={[styles.employeeStatValue, { color: colors.text }]}>{value}</ThemedText>
        {hint !== undefined && (
          <ThemedText style={[styles.tileHint, { color: colors.textFaint }]}>{hint}</ThemedText>
        )}
      </Card>
    </View>
  );
}

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
        <ThemedText style={[styles.employeeLabel, { color: colors.textMuted }]}>
          Yıllık izin hakkı
        </ThemedText>
        <ThemedText style={[styles.employeeValue, { color: colors.text }]}>
          {entitlement !== null ? `${entitlement} gün` : '—'}
        </ThemedText>
        <ThemedText style={[styles.employeeHint, { color: colors.textFaint }]}>
          Detaylı bakiye İzinlerim'de
        </ThemedText>
      </Card>

      <View style={styles.employeeStatsGrid}>
        <EmployeeStat
          label="Kullanılan izin"
          value={`${usedDays} gün`}
          hint={`${currentYear} yılı, onaylılar`}
        />
        <EmployeeStat
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

// ─────────────────────────────────────────────────────────────────────

/** Sayfa başlığı — geniş ekranda selamlama solda, kimlik bilgisi sağda */
function DashboardHeader({ user }: { user: AuthUser | null }) {
  const { colors } = useDesign();
  const wide = useWideLayout();

  return (
    <View style={[styles.header, wide ? styles.headerWide : null]}>
      <View style={styles.grow}>
        <ThemedText style={[styles.greeting, { color: colors.textMuted }]}>Merhaba,</ThemedText>
        <ThemedText type="title">{user?.name}</ThemedText>
      </View>

      <View style={[styles.headerTags, wide ? styles.headerTagsWide : null]}>
        <View style={[styles.rolePill, { backgroundColor: colors.primarySoft }]}>
          <ThemedText style={[styles.roleText, { color: colors.primary }]}>
            {user ? ROLE_LABEL[user.role] : ''}
          </ThemedText>
        </View>
        {user?.branchName && (
          <ThemedText style={[styles.branch, { color: colors.textMuted }]}>
            📍 {user.branchName}
          </ThemedText>
        )}
        {wide && (
          <ThemedText style={[styles.headerDate, { color: colors.textFaint }]}>
            {formatDate(new Date())}
          </ThemedText>
        )}
      </View>
    </View>
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
    // Geniş düzen yalnızca yönetici/İK paneli için: personel görünümü
    // (telefondan girilen ekran) bugünkü dar kolonunda kalır.
    <Screen
      wide={canSeeDashboard}
      refreshControl={
        canSeeDashboard ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
      }>
      <DashboardHeader user={user} />

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
  grow: { flex: 1 },
  fill: { flex: 1 },
  pressed: { opacity: 0.65 },

  // ---- Başlık ----
  header: { marginTop: Space.sm, gap: Space.xs, marginBottom: Space.sm },
  headerWide: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 0 },
  greeting: { fontSize: 15 },
  headerTags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    marginTop: Space.xs,
    flexWrap: 'wrap',
  },
  headerTagsWide: { justifyContent: 'flex-end', marginTop: 0 },
  rolePill: { paddingHorizontal: Space.md, paddingVertical: 5, borderRadius: Radius.pill },
  roleText: { fontSize: 13, fontWeight: '600' },
  branch: { fontSize: 13 },
  headerDate: { fontSize: 13 },

  // ---- Izgara ----
  // Tek ölçü: satır arası da sütun arası da Space.md
  tileRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.md },
  tileItemWide: { flexBasis: 0, flexGrow: 1 },
  tileItemNarrow: { flexBasis: '47%', flexGrow: 1 },
  contentRow: { flexDirection: 'row', alignItems: 'stretch', gap: Space.md },
  contentCol: { flex: 1 },

  // ---- Sayı kutusu ----
  tile: { flex: 1, padding: Space.lg, gap: 0 },
  tileHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space.md,
  },
  tileIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileValue: { fontSize: 30, fontWeight: '700', lineHeight: 36 },
  tileLabel: { fontSize: 13, marginTop: 2 },
  tileHint: { fontSize: 11, marginTop: Space.sm },

  // ---- Kart içi listeler ----
  rowList: { gap: Space.md },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.md },
  metaLabel: { fontSize: 13, flexShrink: 1 },
  metaValue: { fontSize: 14, fontWeight: '700' },
  empty: { fontSize: 13, fontStyle: 'italic' },
  footnote: { fontSize: 12, marginTop: 4 },
  subHeading: { fontSize: 12, fontWeight: '600' },

  // ---- Çubuklar ----
  barTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  barLabel: { fontSize: 14, fontWeight: '600', flex: 1, marginRight: Space.sm },
  barCount: { fontSize: 13, fontWeight: '600' },
  barTrack: { height: 10, borderRadius: Radius.pill, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: Radius.pill },

  // ---- İzin tipi payları (genişlik gün sayısına orantılanır) ----
  stackTrack: { flexDirection: 'row', height: 14, borderRadius: Radius.pill, overflow: 'hidden' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  legendMeta: { fontSize: 12, marginLeft: 'auto' },
  legendShare: { fontSize: 13, fontWeight: '700', minWidth: 40, textAlign: 'right' },

  // ---- Detay listesi ----
  personRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: Space.xs },
  personName: { fontSize: 15, fontWeight: '600' },
  personMeta: { fontSize: 12, marginTop: 2 },

  // ---- Personel paneli (telefon görünümü — değiştirilmedi) ----
  employeeStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: Space.md },
  employeeStatItem: { width: '50%', padding: Space.sm },
  employeeStatValue: { fontSize: 26, fontWeight: '700', marginTop: 2, lineHeight: 33 },
  employeeLabel: { fontSize: 14 },
  employeeValue: { fontSize: 30, fontWeight: '700', marginTop: 4, lineHeight: 38 },
  employeeHint: { fontSize: 12, marginTop: 4 },
});
