import Feather from '@expo/vector-icons/Feather';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOutUp } from 'react-native-reanimated';

import { DetailPanel } from '@/components/leave/detail-panel';
import { StatChip } from '@/components/leave/leave-parts';
import { RejectModal } from '@/components/leave/reject-modal';
import { PendingCard, ProcessedCard } from '@/components/leave/request-cards';
import { RequestRow } from '@/components/leave/request-row';
import { ThemedText } from '@/components/themed-text';
import { EmptyState } from '@/components/ui/empty-state';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { SearchInput } from '@/components/ui/search-input';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Palette, Radius, Shadow, Space } from '@/constants/design';
import { LIST_PANE_WIDTH, NARROW_MAX_WIDTH, PAGE_MAX_WIDTH } from '@/constants/layout';
import { useDesign } from '@/hooks/use-design';
import { useWideLayout } from '@/hooks/use-columns';
import {
  calculateLeaveBalance,
  filterPendingRequests,
  filterProcessedRequests,
  findOverlappingLeaves,
  useLeaveRequestsStore,
} from '@/store/leaveRequestsStore';
import { showToast } from '@/store/toastStore';

import type { LeaveBalance, LeaveRequest } from '@/store/leaveRequestsStore';

/**
 * İZİN ONAY EKRANI — veri, aksiyonlar ve yerleşim.
 *
 * Görsel parçalar `components/leave/` altında: kartlar (dar ekran), liste
 * satırı ve detay paneli (geniş ekran), ret modalı, paylaşılan küçük parçalar.
 */

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

// ─── Component ────────────────────────────────────────────────────
export default function LeaveApprovalScreen() {
  const { colors } = useDesign();
  /** Geniş ekranda liste + detay paneli, dar ekranda tek kolon kart listesi */
  const split = useWideLayout();

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

  const isFiltering =
    searchQuery.trim().length > 0 || (activeTab === 'history' && statusFilter !== 'ALL');

  /**
   * Detayı açık talep. Onay/ret sonrası kayıt listeden düştüğü için seçim
   * kendiliğinden listenin ilk kaydına kayar — panel hiç boş kalmaz ve
   * bunun için ayrı bir effect'e gerek olmaz.
   */
  const focusedItem = useMemo(
    () => visibleList.find((r) => r.id === focusedId) ?? visibleList[0] ?? null,
    [visibleList, focusedId],
  );

  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);

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

  /** Modal hatayı kendi içinde gösteriyor; başarılıysa kapanışı o tetikliyor */
  const submitReject = async (item: LeaveRequest, reason: string) => {
    const result = await rejectRequest(item.id, reason);
    if (result.ok) {
      showToast({
        message: `${item.firstName} ${item.lastName} — talep reddedildi.`,
        tone: 'danger',
      });
    }
    return result;
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
        onReject={setRejectTarget}
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
      <SearchInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="İsim veya şube ara..."
      />

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
            <Animated.View key={focusedItem.id} entering={FadeIn.duration(180)} style={styles.grow}>
              <DetailPanel
                item={focusedItem}
                balance={balanceFor(focusedItem)}
                overlaps={findOverlappingLeaves(allRequests, focusedItem)}
                onApprove={handleApprove}
                onReject={setRejectTarget}
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

      <FlatList
        data={visibleList}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        style={styles.grow}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator
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

      <RejectModal
        visible={rejectTarget !== null}
        target={rejectTarget}
        onClose={() => setRejectTarget(null)}
        onReject={submitReject}
      />
    </Screen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  grow: { flex: 1 },

  // Screen scroll=false yolunda genişlik sınırlamıyor (FlatList'in kendi
  // kaydırma çubuğu ekranın en sağına yapışsın diye) — bu yüzden kaydırmayan
  // başlık/tab alanını burada kendimiz ortalayıp genişlik sınırlıyoruz.
  headerWrap: {
    width: '100%',
    maxWidth: NARROW_MAX_WIDTH,
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

  /* ── Geniş ekran düzeni (>= WIDE_MIN_WIDTH) ──────────────────
     Dar ekrandaki dar kolon burada bırakılıyor: sayfa ekranın iki
     yakasına kadar açılıyor, üst sınır sadece ultra geniş
     monitörlerde satırların okunmaz uzunlukta olmasını engelliyor. */
  page: {
    flex: 1,
    width: '100%',
    maxWidth: PAGE_MAX_WIDTH,
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

  // Özet şeridi
  statRow: {
    flexDirection: 'row',
    gap: Space.sm,
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

  // contentContainerStyle'da maxWidth+alignSelf: FlatList'in kendisi tam
  // genişlikte (kaydırma çubuğu sağda) kalırken, içindeki kartlar ortalanır.
  listContent: {
    width: '100%',
    maxWidth: NARROW_MAX_WIDTH,
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
});
