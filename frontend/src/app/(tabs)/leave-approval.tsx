import Feather from '@expo/vector-icons/Feather';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOutUp,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { BalanceBar } from '@/components/ui/balance-bar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Palette, Radius, Shadow, Space } from '@/constants/design';
import { leaveTypeEmoji, statusMeta } from '@/constants/leave';
import { useDesign } from '@/hooks/use-design';
import {
  calculateLeaveBalance,
  filterPendingRequests,
  filterProcessedRequests,
  findOverlappingLeaves,
  useLeaveRequestsStore,
} from '@/store/leaveRequestsStore';
import { showToast } from '@/store/toastStore';

import type { FeatherName } from '@/components/ui/icon';
import type { LeaveBalance, LeaveRequest, LeaveType } from '@/store/leaveRequestsStore';

/** Ret modalında tek dokunuşla doldurulabilen hazır gerekçeler */
const REJECT_PRESETS: { label: string; reason: string }[] = [
  {
    label: 'Yoğun dönem',
    reason: 'Talep edilen tarihlerde iş yoğunluğu nedeniyle izin verilememektedir.',
  },
  { label: 'Bakiye yetersiz', reason: 'Kalan izin bakiyesi bu talep için yeterli değil.' },
  {
    label: 'Tarih çakışması',
    reason: 'Aynı tarihlerde ekipten başka bir çalışanın izni onaylanmış durumda.',
  },
  { label: 'Geç bildirim', reason: 'Talep, izin başlangıcına çok yakın bir tarihte iletildi.' },
];

const MAX_REJECT_REASON = 300;
/** Açıklama bu uzunluğu aşarsa 2 satıra kırpılıp "Devamını gör" çıkar */
const DESCRIPTION_CLAMP = 110;

const PRESS_SPRING = { damping: 15, stiffness: 300 };

/**
 * Bu genişlikten itibaren ekran "solda liste / sağda detay" konsoluna döner.
 * Altında mobildeki tek kolon kart listesi görünür.
 */
const SPLIT_MIN_WIDTH = 1000;
const LIST_PANE_WIDTH = 380;

// ─── Helpers ──────────────────────────────────────────────────────
type Tab = 'pending' | 'history';
type StatusFilter = 'ALL' | 'APPROVED' | 'REJECTED' | 'CANCELED';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Tümü' },
  { value: 'APPROVED', label: 'Onaylı' },
  { value: 'REJECTED', label: 'Reddedilen' },
  { value: 'CANCELED', label: 'İptal' },
];

function matchesQuery(request: LeaveRequest, query: string): boolean {
  if (query.length === 0) return true;
  const haystack = `${request.firstName} ${request.lastName} ${request.branch}`.toLocaleLowerCase(
    'tr-TR',
  );
  return haystack.includes(query);
}

function matchesStatusFilter(request: LeaveRequest, filter: StatusFilter): boolean {
  switch (filter) {
    case 'APPROVED':
      return request.status === 'APPROVED' || request.status === 'AUTO_APPROVED';
    case 'REJECTED':
      return request.status === 'REJECTED';
    case 'CANCELED':
      return request.status === 'CANCELED';
    default:
      return true;
  }
}

// ─── Küçük parçalar ───────────────────────────────────────────────

/** Onayla/Reddet düğmesi — dolu (birincil) veya çerçeveli (ikincil) */
function ActionButton({
  icon,
  label,
  tone,
  tonePressed,
  filled,
  onPress,
}: {
  icon: FeatherName;
  label: string;
  tone: string;
  tonePressed: string;
  filled: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const [hovered, setHovered] = useState(false);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.96, PRESS_SPRING);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, PRESS_SPRING);
      }}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.actionPressable}>
      {({ pressed }) => (
        <Animated.View
          style={[
            styles.actionBtn,
            animatedStyle,
            filled
              ? { backgroundColor: pressed ? tonePressed : tone }
              : {
                  borderWidth: 1,
                  borderColor: tone,
                  backgroundColor: `${tone}${pressed ? '24' : hovered ? '14' : '00'}`,
                },
          ]}>
          <Feather name={icon} size={16} color={filled ? '#fff' : tone} />
          <ThemedText style={[styles.actionBtnText, { color: filled ? '#fff' : tone }]}>
            {label}
          </ThemedText>
        </Animated.View>
      )}
    </Pressable>
  );
}

function Checkbox({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  const { colors } = useDesign();

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      hitSlop={10}
      style={[
        styles.checkbox,
        {
          backgroundColor: checked ? colors.primary : 'transparent',
          borderColor: checked ? colors.primary : colors.border,
        },
      ]}>
      {checked && <Feather name="check" size={13} color="#fff" />}
    </Pressable>
  );
}

/** Başlıktaki özet kutucuğu */
function StatChip({
  icon,
  label,
  value,
  color,
}: {
  icon: FeatherName;
  label: string;
  value: number;
  color: string;
}) {
  const { colors } = useDesign();

  return (
    <View style={[styles.statChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.statIcon, { backgroundColor: `${color}18` }]}>
        <Feather name={icon} size={13} color={color} />
      </View>
      <View style={styles.grow}>
        <ThemedText style={[styles.statValue, { color: colors.text }]}>{value}</ThemedText>
        <ThemedText style={[styles.statLabel, { color: colors.textMuted }]} numberOfLines={1}>
          {label}
        </ThemedText>
      </View>
    </View>
  );
}

/** Başlangıç → Bitiş aralığı ve net gün rozeti */
function DateRangeBox({ item }: { item: LeaveRequest }) {
  const { colors } = useDesign();

  return (
    <View
      style={[
        styles.dateBox,
        { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
      ]}>
      <View style={styles.dateRange}>
        <View>
          <ThemedText style={[styles.dateLabel, { color: colors.textFaint }]}>Başlangıç</ThemedText>
          <ThemedText style={[styles.dateValue, { color: colors.text }]}>
            {item.startDate}
          </ThemedText>
        </View>
        <Feather name="arrow-right" size={14} color={colors.textFaint} />
        <View>
          <ThemedText style={[styles.dateLabel, { color: colors.textFaint }]}>Bitiş</ThemedText>
          <ThemedText style={[styles.dateValue, { color: colors.text }]}>{item.endDate}</ThemedText>
        </View>
      </View>

      <View style={[styles.dayPill, { backgroundColor: colors.primarySoft }]}>
        <ThemedText style={[styles.dayPillText, { color: colors.primary }]}>
          {item.netDays} gün
        </ThemedText>
      </View>
    </View>
  );
}

/**
 * Uzun açıklamaları 2 satıra kırpar. Satır sayısını ölçmek yerine karakter
 * eşiği kullanıyoruz: onTextLayout react-native-web'de tetiklenmiyor, ölçüme
 * bağlansaydı web'de "Devamını gör" hiç görünmezdi.
 */
function ExpandableText({ text }: { text: string }) {
  const { colors } = useDesign();
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > DESCRIPTION_CLAMP;

  return (
    <View style={styles.descWrap}>
      <ThemedText
        style={[styles.cardDescription, { color: colors.textMuted }]}
        numberOfLines={isLong && !expanded ? 2 : undefined}>
        {text}
      </ThemedText>
      {isLong && (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Açıklamayı kısalt' : 'Açıklamanın tamamını göster'}
          hitSlop={8}>
          <ThemedText style={[styles.moreLink, { color: colors.primary }]}>
            {expanded ? 'Daha az göster' : 'Devamını gör'}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

/** Kartın üst satırı: (seçim kutusu) + avatar + isim/şube + sağdaki içerik */
function CardHeader({
  item,
  leading,
  children,
}: {
  item: LeaveRequest;
  leading?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const { colors } = useDesign();

  return (
    <View style={styles.cardHeader}>
      {leading}
      <Avatar firstName={item.firstName} lastName={item.lastName} size={38} />
      <View style={styles.grow}>
        <ThemedText style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
          {item.firstName} {item.lastName}
        </ThemedText>
        <View style={styles.branchRow}>
          <Feather name="map-pin" size={11} color={colors.textMuted} />
          <ThemedText style={[styles.cardBranch, { color: colors.textMuted }]} numberOfLines={1}>
            {item.branch}
          </ThemedText>
        </View>
      </View>
      {children}
    </View>
  );
}

function TypeBadge({ type }: { type: LeaveType }) {
  const { colors } = useDesign();

  return (
    <View style={[styles.typeBadge, { backgroundColor: colors.primarySoft }]}>
      <ThemedText style={[styles.typeBadgeText, { color: colors.primary }]}>
        {leaveTypeEmoji(type)} {type}
      </ThemedText>
    </View>
  );
}

// ─── Kartlar ──────────────────────────────────────────────────────

const cardEntering = (index: number) =>
  // Gecikmeyi sınırlıyoruz: index * 50 ile 20. kart bir saniye sonra beliriyordu
  FadeInDown.delay(Math.min(index, 6) * 50)
    .duration(280)
    .springify()
    .damping(18);

function PendingCard({
  item,
  index,
  balance,
  overlaps,
  selected,
  onToggleSelect,
  onApprove,
  onReject,
}: {
  item: LeaveRequest;
  index: number;
  balance: LeaveBalance | null;
  overlaps: LeaveRequest[];
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onApprove: (item: LeaveRequest) => void;
  onReject: (item: LeaveRequest) => void;
}) {
  const { colors } = useDesign();
  const exceedsBalance = balance !== null && item.netDays > balance.remaining;

  return (
    <Animated.View
      entering={cardEntering(index)}
      exiting={FadeOutUp.duration(200)}
      layout={LinearTransition.springify().damping(18)}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
        Shadow.card,
      ]}>
      <View style={[styles.statusStripe, { backgroundColor: Palette.warning }]} />

      <CardHeader
        item={item}
        leading={
          <Checkbox
            checked={selected}
            label={`${item.firstName} ${item.lastName} talebini seç`}
            onToggle={() => onToggleSelect(item.id)}
          />
        }>
        <TypeBadge type={item.leaveType} />
      </CardHeader>

      <DateRangeBox item={item} />

      {balance && <BalanceBar balance={balance} label="Yıllık izin bakiyesi" />}

      {exceedsBalance && (
        <Notice
          icon="alert-triangle"
          color={colors.danger}
          text={`Bu talep kalan bakiyeyi ${item.netDays - balance.remaining} gün aşıyor.`}
        />
      )}

      {overlaps.length > 0 && (
        <Notice
          icon="users"
          color={colors.warning}
          text={`Aynı tarihlerde ${item.branch} şubesinden ${overlaps.length} kişi daha izinli.`}
        />
      )}

      <ExpandableText text={item.description} />

      <View style={styles.actionRow}>
        <ActionButton
          icon="check"
          label="Onayla"
          tone={colors.success}
          tonePressed={colors.successPressed}
          filled
          onPress={() => onApprove(item)}
        />
        <ActionButton
          icon="x"
          label="Reddet"
          tone={colors.danger}
          tonePressed={colors.dangerPressed}
          filled={false}
          onPress={() => onReject(item)}
        />
      </View>
    </Animated.View>
  );
}

function ProcessedCard({ item, index }: { item: LeaveRequest; index: number }) {
  const { colors } = useDesign();
  const meta = statusMeta(item.status);
  const isEmergency = item.status === 'AUTO_APPROVED';
  const isAdminCreated = item.createdByAdmin === true;

  return (
    <Animated.View
      entering={cardEntering(index)}
      exiting={FadeOutUp.duration(200)}
      layout={LinearTransition.springify().damping(18)}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        Shadow.card,
      ]}>
      {/* Sol kenar şeridi durumun rengini taşır — listede tarama hızını artırır */}
      <View style={[styles.statusStripe, { backgroundColor: meta.color }]} />

      {isEmergency && (
        <View style={styles.emergencyBanner}>
          <Feather name="alert-triangle" size={13} color="#FFFFFF" />
          <ThemedText style={styles.emergencyBannerText}>
            ACİL — Sistem tarafından onaylandı
          </ThemedText>
        </View>
      )}

      {isAdminCreated && !isEmergency && (
        <View style={[styles.adminBadge, { backgroundColor: colors.primarySoft }]}>
          <Feather name="user-check" size={11} color={colors.primary} />
          <ThemedText style={[styles.adminBadgeText, { color: colors.primary }]}>
            Admin tarafından oluşturuldu
          </ThemedText>
        </View>
      )}

      <CardHeader item={item}>
        <TypeBadge type={item.leaveType} />
      </CardHeader>

      <DateRangeBox item={item} />
      <ExpandableText text={item.description} />

      <View style={styles.statusRow}>
        <View style={[styles.statusBadge, { backgroundColor: `${meta.color}18` }]}>
          <Feather name={meta.icon} size={12} color={meta.color} />
          <ThemedText style={[styles.statusBadgeText, { color: meta.color }]}>
            {meta.label}
          </ThemedText>
        </View>
        {item.processedAt && (
          <ThemedText style={[styles.processedAt, { color: colors.textFaint }]}>
            {item.processedAt}
          </ThemedText>
        )}
      </View>

      {item.status === 'REJECTED' && item.rejectionReason && (
        <View style={[styles.rejectionBox, { backgroundColor: `${Palette.danger}12` }]}>
          <ThemedText style={[styles.rejectionLabel, { color: Palette.danger }]}>
            Ret nedeni
          </ThemedText>
          <ThemedText style={[styles.rejectionText, { color: colors.textMuted }]}>
            {item.rejectionReason}
          </ThemedText>
        </View>
      )}
    </Animated.View>
  );
}

// ─── Geniş ekran: liste satırı + detay paneli ─────────────────────

/** Sol paneldeki dar liste satırı — tek bakışta kim, ne, ne zaman, kaç gün */
function RequestRow({
  item,
  index,
  active,
  selected,
  selectable,
  onPress,
  onToggleSelect,
}: {
  item: LeaveRequest;
  index: number;
  active: boolean;
  selected: boolean;
  selectable: boolean;
  onPress: () => void;
  onToggleSelect: (id: string) => void;
}) {
  const { colors } = useDesign();
  const [hovered, setHovered] = useState(false);
  const meta = statusMeta(item.status);

  return (
    <Animated.View
      entering={cardEntering(index)}
      exiting={FadeOutUp.duration(160)}
      layout={LinearTransition.springify().damping(18)}>
      <Pressable
        onPress={onPress}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        style={[
          styles.row,
          {
            backgroundColor: active
              ? colors.primarySoft
              : hovered
                ? colors.surfaceRaised
                : colors.surface,
            borderColor: active ? colors.primary : colors.border,
          },
        ]}>
        <View style={[styles.rowStripe, { backgroundColor: meta.color }]} />

        {selectable && (
          <Checkbox
            checked={selected}
            label={`${item.firstName} ${item.lastName} talebini seç`}
            onToggle={() => onToggleSelect(item.id)}
          />
        )}

        <Avatar firstName={item.firstName} lastName={item.lastName} size={32} />

        <View style={styles.grow}>
          <ThemedText style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
            {item.firstName} {item.lastName}
          </ThemedText>
          <ThemedText style={[styles.rowMeta, { color: colors.textMuted }]} numberOfLines={1}>
            {leaveTypeEmoji(item.leaveType)} {item.leaveType} · {item.startDate}
          </ThemedText>
        </View>

        <View style={[styles.rowDays, { backgroundColor: colors.primarySoft }]}>
          <ThemedText style={[styles.rowDaysText, { color: colors.primary }]}>
            {item.netDays}g
          </ThemedText>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Sağdaki detay paneli — seçili talebin tüm bilgisi.
 * Aksiyon şeridi kaydırma alanının DIŞINDA, panelin dibine sabit: uzun
 * açıklamalarda bile "Onayla/Reddet" hep göz önünde kalır.
 */
function DetailPanel({
  item,
  balance,
  overlaps,
  onApprove,
  onReject,
}: {
  item: LeaveRequest;
  balance: LeaveBalance | null;
  overlaps: LeaveRequest[];
  onApprove: (item: LeaveRequest) => void;
  onReject: (item: LeaveRequest) => void;
}) {
  const { colors } = useDesign();
  const meta = statusMeta(item.status);
  const isPending = item.status === 'PENDING';
  const isEmergency = item.status === 'AUTO_APPROVED';
  const exceedsBalance = balance !== null && item.netDays > balance.remaining;

  return (
    <>
      <ScrollView style={styles.grow} contentContainerStyle={styles.detailContent}>
        <View style={styles.detailHeader}>
          <Avatar firstName={item.firstName} lastName={item.lastName} size={56} />
          <View style={styles.grow}>
            <ThemedText style={[styles.detailName, { color: colors.text }]} numberOfLines={1}>
              {item.firstName} {item.lastName}
            </ThemedText>
            <View style={styles.branchRow}>
              <Feather name="map-pin" size={12} color={colors.textMuted} />
              <ThemedText style={[styles.cardBranch, { color: colors.textMuted }]} numberOfLines={1}>
                {item.branch}
              </ThemedText>
            </View>
          </View>
          <View style={styles.detailHeaderRight}>
            <TypeBadge type={item.leaveType} />
            <View style={[styles.statusBadge, { backgroundColor: `${meta.color}18` }]}>
              <Feather name={meta.icon} size={12} color={meta.color} />
              <ThemedText style={[styles.statusBadgeText, { color: meta.color }]}>
                {meta.label}
              </ThemedText>
            </View>
          </View>
        </View>

        {isEmergency && (
          <View style={styles.emergencyBanner}>
            <Feather name="alert-triangle" size={13} color="#FFFFFF" />
            <ThemedText style={styles.emergencyBannerText}>
              ACİL — Sistem tarafından onaylandı
            </ThemedText>
          </View>
        )}

        {item.createdByAdmin === true && !isEmergency && (
          <View style={[styles.adminBadge, { backgroundColor: colors.primarySoft }]}>
            <Feather name="user-check" size={11} color={colors.primary} />
            <ThemedText style={[styles.adminBadgeText, { color: colors.primary }]}>
              Admin tarafından oluşturuldu
            </ThemedText>
          </View>
        )}

        <View
          style={[
            styles.detailDateBox,
            { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
          ]}>
          <View>
            <ThemedText style={[styles.dateLabel, { color: colors.textFaint }]}>
              Başlangıç
            </ThemedText>
            <ThemedText style={[styles.detailDateValue, { color: colors.text }]}>
              {item.startDate}
            </ThemedText>
          </View>
          <Feather name="arrow-right" size={18} color={colors.textFaint} />
          <View>
            <ThemedText style={[styles.dateLabel, { color: colors.textFaint }]}>Bitiş</ThemedText>
            <ThemedText style={[styles.detailDateValue, { color: colors.text }]}>
              {item.endDate}
            </ThemedText>
          </View>
          <View style={styles.grow} />
          <View style={[styles.detailDayPill, { backgroundColor: colors.primarySoft }]}>
            <ThemedText style={[styles.detailDayPillText, { color: colors.primary }]}>
              {item.netDays} gün
            </ThemedText>
          </View>
        </View>

        {balance && <BalanceBar balance={balance} label="Yıllık izin bakiyesi" />}

        {exceedsBalance && (
          <Notice
            icon="alert-triangle"
            color={colors.danger}
            text={`Bu talep kalan bakiyeyi ${item.netDays - balance.remaining} gün aşıyor.`}
          />
        )}

        {overlaps.length > 0 && (
          <Notice
            icon="users"
            color={colors.warning}
            text={`Aynı tarihlerde ${item.branch} şubesinden ${overlaps.length} kişi daha izinli.`}
          />
        )}

        <View>
          <ThemedText style={[styles.detailBlockLabel, { color: colors.textFaint }]}>
            Açıklama
          </ThemedText>
          <ThemedText style={[styles.detailDescription, { color: colors.textMuted }]}>
            {item.description}
          </ThemedText>
        </View>

        {item.status === 'REJECTED' && item.rejectionReason && (
          <View style={[styles.rejectionBox, { backgroundColor: `${Palette.danger}12` }]}>
            <ThemedText style={[styles.rejectionLabel, { color: Palette.danger }]}>
              Ret nedeni
            </ThemedText>
            <ThemedText style={[styles.rejectionText, { color: colors.textMuted }]}>
              {item.rejectionReason}
            </ThemedText>
          </View>
        )}

        {item.processedAt && (
          <ThemedText style={[styles.processedAt, { color: colors.textFaint }]}>
            İşlem tarihi: {item.processedAt}
          </ThemedText>
        )}
      </ScrollView>

      {isPending && (
        <View style={[styles.detailActions, { borderTopColor: colors.border }]}>
          <View style={styles.detailActionMain}>
            <ActionButton
              icon="check"
              label="Onayla"
              tone={colors.success}
              tonePressed={colors.successPressed}
              filled
              onPress={() => onApprove(item)}
            />
            <ActionButton
              icon="x"
              label="Reddet"
              tone={colors.danger}
              tonePressed={colors.dangerPressed}
              filled={false}
              onPress={() => onReject(item)}
            />
          </View>
        </View>
      )}
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────
export default function LeaveApprovalScreen() {
  const { colors } = useDesign();
  const { width } = useWindowDimensions();
  /** Geniş ekranda liste + detay paneli, dar ekranda tek kolon kart listesi */
  const split = width >= SPLIT_MIN_WIDTH;

  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  /** Detay panelinde açık olan talep — yalnızca geniş ekranda kullanılır */
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const selectTab = (tab: Tab) => {
    setActiveTab(tab);
    setSelectedIds([]);
    setFocusedId(null);
  };

  // Kapsam sunucuda uygulanır: HR kendi şubesini, admin tüm şubeleri alır
  const allRequests = useLeaveRequestsStore((s) => s.approval);
  const fetchApproval = useLeaveRequestsStore((s) => s.fetchApproval);
  const loadingApproval = useLeaveRequestsStore((s) => s.loadingApproval);
  const approvalError = useLeaveRequestsStore((s) => s.approvalError);
  const approveRequest = useLeaveRequestsStore((s) => s.approveRequest);
  const rejectRequest = useLeaveRequestsStore((s) => s.rejectRequest);

  // Drawer ekranı açık kaldığı için her odaklanmada tazele —
  // yeni gelen talepler ekrana dönüşte görünsün
  useFocusEffect(
    useCallback(() => {
      void fetchApproval();
    }, [fetchApproval]),
  );

  // Türetilmiş listeler — filtreler her çağrıda yeni dizi ürettiği için memoize
  const pendingList = useMemo(() => filterPendingRequests(allRequests), [allRequests]);
  const processedList = useMemo(() => filterProcessedRequests(allRequests), [allRequests]);

  const stats = useMemo(() => {
    let approved = 0;
    let rejected = 0;
    for (const r of processedList) {
      if (r.status === 'APPROVED' || r.status === 'AUTO_APPROVED') approved++;
      else if (r.status === 'REJECTED') rejected++;
    }
    return { pending: pendingList.length, approved, rejected };
  }, [pendingList, processedList]);

  /** Arama + (geçmişte) durum filtresi uygulanmış görünen liste */
  const visibleList = useMemo(() => {
    const base = activeTab === 'pending' ? pendingList : processedList;
    const query = searchQuery.trim().toLocaleLowerCase('tr-TR');

    return base.filter((r) => {
      if (activeTab === 'history' && !matchesStatusFilter(r, statusFilter)) return false;
      return matchesQuery(r, query);
    });
  }, [activeTab, pendingList, processedList, searchQuery, statusFilter]);

  const isFiltering = searchQuery.trim().length > 0 || (activeTab === 'history' && statusFilter !== 'ALL');

  /**
   * Detayı açık talep. Onay/ret sonrası kayıt listeden düştüğü için seçim
   * kendiliğinden listenin ilk kaydına kayar — panel hiç boş kalmaz ve
   * bunun için ayrı bir effect'e gerek olmaz.
   */
  const focusedItem = useMemo(
    () => visibleList.find((r) => r.id === focusedId) ?? visibleList[0] ?? null,
    [visibleList, focusedId],
  );

  // Reject modal state
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  // ── Actions ────────────────────────────────────────────────────
  // İşlemler sunucuda kalıcıdır; onaylanan/reddedilen talep geri alınamaz.

  const handleApprove = async (item: LeaveRequest) => {
    const result = await approveRequest(item.id);
    if (!result.ok) {
      showToast({ message: result.message ?? 'Talep onaylanamadı.', tone: 'danger' });
      return;
    }

    // Backend limit aşımını onay anında yakalayıp talebi REDDEDEBİLİR
    if (result.request?.status === 'REJECTED') {
      showToast({
        message: `${item.firstName} ${item.lastName} — bakiye yetersiz, talep otomatik reddedildi.`,
        tone: 'danger',
      });
      return;
    }

    showToast({
      message: `${item.firstName} ${item.lastName} — ${item.netDays} günlük izin onaylandı.`,
      tone: 'success',
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const approveSelected = async () => {
    const snapshots = pendingList.filter((r) => selectedIds.includes(r.id));
    if (snapshots.length === 0) return;

    setSelectedIds([]);
    let approved = 0;
    let failed = 0;
    for (const request of snapshots) {
      const result = await approveRequest(request.id);
      if (result.ok && result.request?.status !== 'REJECTED') approved += 1;
      else failed += 1;
    }

    showToast({
      message:
        failed === 0
          ? `${approved} talep onaylandı.`
          : `${approved} talep onaylandı, ${failed} talep onaylanamadı.`,
      tone: failed === 0 ? 'success' : 'danger',
    });
  };

  const openRejectModal = (item: LeaveRequest) => {
    setRejectTarget(item);
    setRejectReason('');
    setRejectError('');
    setRejectModalVisible(true);
  };

  const closeRejectModal = () => {
    setRejectModalVisible(false);
    setRejectTarget(null);
    setRejectReason('');
    setRejectError('');
  };

  /**
   * Modalın kendisi onay adımıdır — üstüne bir de sistem onay kutusu açmıyoruz.
   * Doğrulama hatası da modal içinde satır olarak gösteriliyor.
   */
  const confirmReject = async () => {
    if (!rejectTarget || rejectSubmitting) return;

    const reason = rejectReason.trim();
    if (reason.length === 0) {
      setRejectError('Reddetme nedeni boş bırakılamaz.');
      return;
    }

    const snapshot = rejectTarget;
    setRejectSubmitting(true);
    const result = await rejectRequest(snapshot.id, reason);
    setRejectSubmitting(false);

    if (!result.ok) {
      setRejectError(result.message ?? 'Talep reddedilemedi.');
      return;
    }

    closeRejectModal();
    showToast({
      message: `${snapshot.firstName} ${snapshot.lastName} — talep reddedildi.`,
      tone: 'danger',
    });
  };

  /**
   * Bakiye şeridi yalnızca yıllık izinlerde gösterilir; kişinin izin hakkı
   * sunucudan talep kaydıyla birlikte gelir (userAnnualLeaveCount).
   */
  const balanceFor = (item: LeaveRequest): LeaveBalance | null =>
    item.leaveType === 'Yıllık' && item.annualLeaveCount != null
      ? calculateLeaveBalance(allRequests, item, item.annualLeaveCount)
      : null;

  const renderItem = ({ item, index }: { item: LeaveRequest; index: number }) => {
    // Geniş ekranda liste yalnızca "seçici"dir; tüm detay sağ panelde
    if (split) {
      return (
        <RequestRow
          item={item}
          index={index}
          active={focusedItem?.id === item.id}
          selected={selectedIds.includes(item.id)}
          selectable={activeTab === 'pending'}
          onPress={() => setFocusedId(item.id)}
          onToggleSelect={toggleSelect}
        />
      );
    }

    return activeTab === 'pending' ? (
      <PendingCard
        item={item}
        index={index}
        balance={balanceFor(item)}
        overlaps={findOverlappingLeaves(allRequests, item)}
        selected={selectedIds.includes(item.id)}
        onToggleSelect={toggleSelect}
        onApprove={handleApprove}
        onReject={openRejectModal}
      />
    ) : (
      <ProcessedCard item={item} index={index} />
    );
  };

  /**
   * Arama ve filtre listeyle birlikte kaysın diye ListHeaderComponent'te.
   * Element olarak veriliyor (fonksiyon değil) — fonksiyon her render'da yeni
   * bileşen tipi üretip TextInput'un odağını düşürürdü.
   */
  const listHeader = (
    <View style={styles.listHeader}>
      {approvalError !== null && (
        <Notice icon="alert-circle" color={colors.danger} text={approvalError} />
      )}
      <View
        style={[
          styles.searchBox,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}>
        <Feather name="search" size={15} color={colors.textFaint} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="İsim veya şube ara..."
          placeholderTextColor={colors.textFaint}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <Pressable
            onPress={() => setSearchQuery('')}
            accessibilityRole="button"
            accessibilityLabel="Aramayı temizle"
            hitSlop={8}>
            <Feather name="x" size={15} color={colors.textFaint} />
          </Pressable>
        )}
      </View>

      {activeTab === 'history' && (
        <View style={styles.filterRow}>
          {STATUS_FILTERS.map((filter) => {
            const active = statusFilter === filter.value;
            return (
              <Pressable
                key={filter.value}
                onPress={() => setStatusFilter(filter.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? colors.primary : 'transparent',
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}>
                <ThemedText
                  style={[styles.filterChipText, { color: active ? '#fff' : colors.textMuted }]}>
                  {filter.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );

  const summaryStats = (
    <>
      <StatChip icon="clock" label="Bekleyen" value={stats.pending} color={Palette.warning} />
      <StatChip
        icon="check-circle"
        label="Onaylanan"
        value={stats.approved}
        color={Palette.success}
      />
      <StatChip icon="x-circle" label="Reddedilen" value={stats.rejected} color={Palette.danger} />
    </>
  );

  const tabsBar = (
    <SegmentedTabs
      tabs={[
        { key: 'pending', label: 'Bekleyen Talepler', badge: pendingList.length },
        { key: 'history', label: 'İşlem Görenler', badge: processedList.length },
      ]}
      value={activeTab}
      onChange={selectTab}
    />
  );

  /** Toplu işlem şeridi — sadece seçim varken görünür */
  const bulkBar =
    activeTab === 'pending' && selectedIds.length > 0 ? (
      <Animated.View
        entering={FadeInDown.duration(200)}
        exiting={FadeOutUp.duration(160)}
        style={[
          styles.selectionBar,
          { backgroundColor: colors.primarySoft, borderColor: colors.primary },
        ]}>
        <ThemedText style={[styles.selectionText, { color: colors.primary }]}>
          {selectedIds.length} talep seçildi
        </ThemedText>
        <Pressable
          onPress={() => setSelectedIds([])}
          accessibilityRole="button"
          hitSlop={8}
          style={styles.selectionClear}>
          <ThemedText style={[styles.selectionClearText, { color: colors.textMuted }]}>
            Temizle
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={approveSelected}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.selectionApprove,
            { backgroundColor: pressed ? colors.successPressed : colors.success },
          ]}>
          <Feather name="check" size={14} color="#fff" />
          <ThemedText style={styles.selectionApproveText}>Onayla</ThemedText>
        </Pressable>
      </Animated.View>
    ) : null;

  const emptyState = isFiltering ? (
    <EmptyState
      icon="search"
      title="Sonuç bulunamadı"
      description="Arama veya filtre koşullarını değiştirip tekrar dene."
    />
  ) : activeTab === 'pending' ? (
    <EmptyState
      icon="check-circle"
      title="Bekleyen talep yok"
      description="Tüm izin talepleri işlendi. Yeni bir talep geldiğinde burada görünecek."
    />
  ) : (
    <EmptyState
      icon="inbox"
      title="Geçmiş henüz boş"
      description="Onayladığın, reddettiğin veya iptal ettiğin talepler burada listelenir."
    />
  );

  // ── Geniş ekran: solda seçici liste, sağda detay paneli ────────
  const wideLayout = (
    <View style={styles.page}>
      <View style={styles.pageHeader}>
        <View style={[styles.titleBlock, styles.grow]}>
          <ThemedText type="title">İzin Onay Yönetimi</ThemedText>
          <ThemedText style={[styles.pageSubtitle, { color: colors.textMuted }]}>
            Soldan bir talep seç, sağdaki panelden onayla, reddet veya düzenle.
          </ThemedText>
        </View>
        <View style={[styles.statRow, styles.headerStats]}>{summaryStats}</View>
      </View>

      <View style={styles.split}>
        <View style={styles.listPane}>
          {tabsBar}
          {listHeader}
          {bulkBar}
          <FlatList
            data={visibleList}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            style={styles.grow}
            contentContainerStyle={styles.rowListContent}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl refreshing={loadingApproval} onRefresh={() => void fetchApproval()} />
            }
            ListEmptyComponent={loadingApproval ? null : emptyState}
          />
        </View>

        <View
          style={[
            styles.detailPane,
            { backgroundColor: colors.surface, borderColor: colors.border },
            Shadow.card,
          ]}>
          {focusedItem ? (
            // key: talep değişince panel baştan kurulur, kaydırma tepeye döner
            <Animated.View
              key={focusedItem.id}
              entering={FadeIn.duration(180)}
              style={styles.grow}>
              <DetailPanel
                item={focusedItem}
                balance={balanceFor(focusedItem)}
                overlaps={findOverlappingLeaves(allRequests, focusedItem)}
                onApprove={handleApprove}
                onReject={openRejectModal}
              />
            </Animated.View>
          ) : (
            <View style={styles.detailEmpty}>{emptyState}</View>
          )}
        </View>
      </View>
    </View>
  );

  // ── Dar ekran: mevcut tek kolon kart listesi ───────────────────
  const narrowLayout = (
    <>
      <View style={styles.headerWrap}>
        <View style={styles.titleBlock}>
          <ThemedText type="title">İzin Onay Yönetimi</ThemedText>
          <ThemedText style={[styles.pageSubtitle, { color: colors.textMuted }]}>
            Gelen talepleri onayla, reddet veya düzenle.
          </ThemedText>
        </View>

        {/* Özet şeridi */}
        <View style={styles.statRow}>{summaryStats}</View>

        {tabsBar}

        {bulkBar}
      </View>

      {/* List */}
      <FlatList
        data={visibleList}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        style={styles.flatList}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={loadingApproval} onRefresh={() => void fetchApproval()} />
        }
        ListHeaderComponent={listHeader}
        ListEmptyComponent={loadingApproval ? null : emptyState}
      />
    </>
  );

  return (
    <Screen scroll={false}>
      {split ? wideLayout : narrowLayout}

      {/* ─── Reject Reason Modal ────────────────────────────────── */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeRejectModal}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View
            entering={FadeInDown.duration(220).springify().damping(20)}
            style={[
              styles.modalContent,
              { backgroundColor: colors.surface, borderColor: colors.border },
              Shadow.card,
            ]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: `${colors.danger}18` }]}>
                <Feather name="x-circle" size={18} color={colors.danger} />
              </View>
              <View style={styles.grow}>
                <ThemedText style={[styles.modalTitle, { color: colors.text }]}>
                  Talebi Reddet
                </ThemedText>
                {rejectTarget && (
                  <ThemedText style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                    {rejectTarget.firstName} {rejectTarget.lastName} — {rejectTarget.leaveType} izni
                  </ThemedText>
                )}
              </View>
            </View>

            <ThemedText style={[styles.fieldLabel, { color: colors.textMuted }]}>
              Hazır gerekçeler
            </ThemedText>
            <View style={styles.presetRow}>
              {REJECT_PRESETS.map((preset) => {
                const active = rejectReason === preset.reason;
                return (
                  <Pressable
                    key={preset.label}
                    onPress={() => {
                      setRejectReason(preset.reason);
                      setRejectError('');
                    }}
                    accessibilityRole="button"
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: active ? colors.primary : 'transparent',
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}>
                    <ThemedText
                      style={[styles.presetChipText, { color: active ? '#fff' : colors.text }]}>
                      {preset.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <ThemedText style={[styles.fieldLabel, { color: colors.textMuted }]}>
              Reddetme nedeni
            </ThemedText>
            <TextInput
              style={[
                styles.modalInput,
                {
                  color: colors.text,
                  backgroundColor: colors.surfaceRaised,
                  borderColor: rejectError ? colors.danger : colors.border,
                },
              ]}
              placeholder="Ret nedenini açıklayınız..."
              placeholderTextColor={colors.textFaint}
              multiline
              maxLength={MAX_REJECT_REASON}
              value={rejectReason}
              onChangeText={(text) => {
                setRejectReason(text);
                if (rejectError) setRejectError('');
              }}
              autoFocus
            />
            <ThemedText style={[styles.charCount, { color: colors.textFaint }]}>
              {rejectReason.length}/{MAX_REJECT_REASON}
            </ThemedText>

            {rejectError !== '' && (
              <Notice icon="alert-circle" color={colors.danger} text={rejectError} />
            )}

            <View style={styles.modalActions}>
              <Pressable
                onPress={closeRejectModal}
                accessibilityRole="button"
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}>
                <ThemedText style={[styles.modalCancelText, { color: colors.textMuted }]}>
                  Vazgeç
                </ThemedText>
              </Pressable>
              <View style={styles.grow}>
                <Button label="Reddet" onPress={confirmReject} loading={rejectSubmitting} />
              </View>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  grow: { flex: 1 },

  // Screen artık scroll=false yolunda genişlik sınırlamıyor (FlatList'in kendi
  // kaydırma çubuğu ekranın en sağına yapışsın diye) — bu yüzden kaydırmayan
  // başlık/tab alanını burada kendimiz ortalayıp genişlik sınırlıyoruz.
  headerWrap: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: Space.xl,
    paddingTop: Space.xl,
    paddingBottom: Space.sm,
    gap: Space.md,
  },
  titleBlock: {
    gap: Space.xs,
  },
  pageSubtitle: {
    fontSize: 14,
  },

  /* ── Geniş ekran düzeni (>= SPLIT_MIN_WIDTH) ─────────────────
     Dar ekrandaki 480px'lik kolon burada bırakılıyor: sayfa ekranın
     iki yakasına kadar açılıyor, üst sınır sadece ultra geniş
     monitörlerde satırların okunmaz uzunlukta olmasını engelliyor. */
  page: {
    flex: 1,
    width: '100%',
    maxWidth: 1600,
    alignSelf: 'center',
    paddingHorizontal: Space.xl,
    paddingTop: Space.xl,
    paddingBottom: Space.xl,
    gap: Space.lg,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xl,
  },
  // Özet kutucukları başlıkla aynı satırda, sağ tarafta
  headerStats: {
    width: 460,
  },
  split: {
    flex: 1,
    flexDirection: 'row',
    gap: Space.lg,
  },
  listPane: {
    width: LIST_PANE_WIDTH,
    gap: Space.sm,
  },
  rowListContent: {
    paddingBottom: Space.lg,
    gap: Space.sm,
  },
  detailPane: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.lg,
    // Dipteki aksiyon şeridi ve kaydırma alanı yuvarlak köşeye kırpılsın
    overflow: 'hidden',
  },
  detailEmpty: {
    flex: 1,
    justifyContent: 'center',
  },

  /* ── Liste satırı (geniş ekran) ──────────────────────────── */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingLeft: Space.md + 4, // sol durum şeridi payı
    paddingRight: Space.md,
    paddingVertical: 10,
    overflow: 'hidden',
  },
  rowStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  rowName: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowMeta: {
    fontSize: 12,
    marginTop: 1,
  },
  rowDays: {
    paddingHorizontal: Space.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  rowDaysText: {
    fontSize: 12,
    fontWeight: '700',
  },

  /* ── Detay paneli (geniş ekran) ──────────────────────────── */
  detailContent: {
    padding: Space.xl,
    gap: Space.md,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.lg,
  },
  detailHeaderRight: {
    alignItems: 'flex-end',
    gap: Space.sm,
  },
  detailName: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  detailDateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Space.xl,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.xl,
    paddingVertical: Space.lg,
  },
  detailDateValue: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  detailDayPill: {
    paddingHorizontal: Space.lg,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  detailDayPillText: {
    fontSize: 14,
    fontWeight: '700',
  },
  detailBlockLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    lineHeight: 14,
    marginBottom: 2,
  },
  detailDescription: {
    fontSize: 15,
    lineHeight: 22,
  },
  // Kaydırma alanının dışında, panelin dibine sabit
  detailActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    borderTopWidth: 1,
    paddingHorizontal: Space.xl,
    paddingVertical: Space.lg,
  },
  detailActionMain: {
    flex: 1,
    flexDirection: 'row',
    gap: Space.md,
  },

  // Özet şeridi
  statRow: {
    flexDirection: 'row',
    gap: Space.sm,
  },
  statChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    minWidth: 0,
  },
  statIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 21,
  },
  statLabel: {
    fontSize: 11,
    lineHeight: 15,
  },

  // Toplu işlem şeridi
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm,
  },
  selectionText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  selectionClear: {
    paddingVertical: Space.xs,
  },
  selectionClearText: {
    fontSize: 13,
    fontWeight: '600',
  },
  selectionApprove: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.sm,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
  },
  selectionApproveText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  // List — FlatList kalan alanı doldurur, tab'lar sticky kalır.
  // contentContainerStyle'da maxWidth+alignSelf: FlatList'in kendisi tam
  // genişlikte (kaydırma çubuğu sağda) kalırken, içindeki kartlar ortalanır.
  flatList: {
    flex: 1,
  },
  listContent: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: Space.xl,
    paddingBottom: Space.xxl,
    paddingTop: Space.xs,
    gap: Space.md,
  },

  // Arama + filtre (listeyle birlikte kayar)
  listHeader: {
    gap: Space.sm,
    paddingBottom: Space.xs,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Platform.OS === 'web' ? 10 : 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 4,
    // Web'de input'un varsayılan odak çerçevesi kutunun içinde çift çizgi yapıyor
    ...Platform.select({ web: { outlineStyle: 'none' } as object, default: {} }),
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Space.md,
    paddingVertical: 6,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Card (inline, not using <Card> for extra control)
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Space.xl,
    gap: Space.md,
    // Durum şeridinin köşeleri karta göre kırpılsın
    overflow: 'hidden',
  },
  statusStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
  },
  branchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  cardBranch: {
    fontSize: 13,
    flexShrink: 1,
  },
  typeBadge: {
    paddingHorizontal: Space.md,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Tarih aralığı
  // surfaceRaised açık modda surface ile aynı beyaz — kenarlık olmadan kutu kaybolur
  dateBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Space.md,
    borderWidth: 1,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    borderRadius: Radius.md,
  },
  dateRange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  dateLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    lineHeight: 14,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  dayPill: {
    paddingHorizontal: Space.md,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  dayPillText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Description
  descWrap: {
    gap: 2,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  moreLink: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap: Space.md,
    marginTop: Space.xs,
  },
  actionPressable: {
    flex: 1,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    paddingVertical: 12,
    borderRadius: Radius.md,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },

  // Status (history)
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Space.md,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  processedAt: {
    fontSize: 12,
  },

  // Emergency — tam genişlik kırmızı banner
  emergencyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    backgroundColor: Palette.danger,
    paddingHorizontal: Space.md,
    paddingVertical: Space.md,
    borderRadius: Radius.sm,
  },
  emergencyBannerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // Admin oluşturma rozeti
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    borderRadius: Radius.sm,
    alignSelf: 'flex-start',
  },
  adminBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Rejection reason
  rejectionBox: {
    borderRadius: Radius.sm,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    gap: 2,
  },
  rejectionLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  rejectionText: {
    fontSize: 13,
    lineHeight: 18,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: Space.xl,
  },
  modalContent: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Space.xl,
    gap: Space.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    marginBottom: Space.xs,
  },
  modalIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 13,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: Space.sm,
    marginBottom: Space.xs,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: 14,
    fontSize: 15,
    minHeight: 96,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 11,
    textAlign: 'right',
  },
  modalActions: {
    flexDirection: 'row',
    gap: Space.md,
    marginTop: Space.sm,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Hazır ret gerekçeleri
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  presetChip: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Space.md,
    paddingVertical: 7,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
