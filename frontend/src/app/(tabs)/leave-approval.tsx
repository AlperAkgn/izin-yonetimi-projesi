import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Palette, Radius, Shadow, Space } from '@/constants/design';
import { useDesign } from '@/hooks/use-design';
import {
  filterPendingRequests,
  filterProcessedRequests,
  useLeaveRequestsStore,
} from '@/store/leaveRequestsStore';
import { showAlert, showConfirm } from '@/utils/alert';

import type { LeaveRequest, LeaveStatus, LeaveType } from '@/store/leaveRequestsStore';

const LEAVE_TYPES: LeaveType[] = ['Yıllık', 'Sağlık', 'Mazeret', 'Acil'];

// ─── Helpers ──────────────────────────────────────────────────────
type Tab = 'pending' | 'history';

function statusLabel(status: LeaveStatus): string {
  switch (status) {
    case 'APPROVED':
      return '✅ Onaylandı';
    case 'REJECTED':
      return '❌ Reddedildi';
    case 'AUTO_APPROVED':
      return '🚨 ACİL - Sistem Tarafından Onaylandı';
    case 'CANCELED':
      return '🚫 İptal Edildi';
    default:
      return '⏳ Beklemede';
  }
}

function statusColor(status: LeaveStatus): string {
  switch (status) {
    case 'APPROVED':
      return Palette.success;
    case 'REJECTED':
      return Palette.danger;
    case 'AUTO_APPROVED':
      return Palette.danger;
    case 'CANCELED':
      return Palette.canceled;
    default:
      return Palette.warning;
  }
}

function leaveTypeEmoji(type: string): string {
  switch (type) {
    case 'Yıllık':
      return '🏖️';
    case 'Sağlık':
      return '🏥';
    case 'Mazeret':
      return '📋';
    case 'Acil':
      return '🚨';
    default:
      return '📄';
  }
}

// ─── Component ────────────────────────────────────────────────────
export default function LeaveApprovalScreen() {
  const { colors } = useDesign();

  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [tabRowWidth, setTabRowWidth] = useState(0);
  // tabRow: borderWidth 1 + padding 3 her iki yanda da var; gösterge bu
  // içerik kutusunun tam yarısı olmalı, yoksa kenardan taşar.
  const indicatorWidth = tabRowWidth > 0 ? (tabRowWidth - 2 * 1 - 2 * 3) / 2 : 0;
  const tabProgress = useSharedValue(0);

  const selectTab = (tab: Tab) => {
    setActiveTab(tab);
    tabProgress.value = withTiming(tab === 'pending' ? 0 : 1, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  };

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tabProgress.value * indicatorWidth }],
  }));
  const pendingLabelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(tabProgress.value, [0, 1], ['#ffffff', colors.textMuted]),
  }));
  const historyLabelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(tabProgress.value, [0, 1], [colors.textMuted, '#ffffff']),
  }));

  // Store'dan oku
  const allRequests = useLeaveRequestsStore((s) => s.requests);
  const approveRequest = useLeaveRequestsStore((s) => s.approveRequest);
  const rejectRequest = useLeaveRequestsStore((s) => s.rejectRequest);
  const cancelRequest = useLeaveRequestsStore((s) => s.cancelRequest);
  const updateRequest = useLeaveRequestsStore((s) => s.updateRequest);

  // Türetilmiş listeler — tek kaynak (store) üzerinden filtrelenir
  const pendingList = filterPendingRequests(allRequests);
  const processedList = filterProcessedRequests(allRequests);

  // Reject modal state
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<LeaveRequest | null>(null);
  const [editLeaveType, setEditLeaveType] = useState<LeaveType>('Yıllık');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // ── Actions ────────────────────────────────────────────────────
  const handleApprove = (item: LeaveRequest) => {
    showConfirm(
      'İzin Onayı',
      `${item.firstName} ${item.lastName} adlı çalışanın ${item.netDays} günlük ${item.leaveType} iznini onaylamak istediğinize emin misiniz?`,
      'Onayla',
      () => {
        approveRequest(item.id);
        showAlert('Başarılı', `${item.firstName} ${item.lastName} adlı çalışanın izni onaylandı.`);
      },
    );
  };

  const openRejectModal = (item: LeaveRequest) => {
    setRejectTarget(item);
    setRejectReason('');
    setRejectModalVisible(true);
  };

  const confirmReject = () => {
    if (!rejectTarget) return;

    if (rejectReason.trim().length === 0) {
      showAlert('Hata', 'Reddetme nedeni boş bırakılamaz.');
      return;
    }

    showConfirm(
      'İzin Reddi',
      `${rejectTarget.firstName} ${rejectTarget.lastName} adlı çalışanın iznini reddetmek istediğinize emin misiniz?`,
      'Reddet',
      () => {
        rejectRequest(rejectTarget.id, rejectReason.trim());
        setRejectModalVisible(false);
        setRejectTarget(null);
        setRejectReason('');

        showAlert('İşlem Tamamlandı', `${rejectTarget.firstName} ${rejectTarget.lastName} adlı çalışanın izni reddedildi.`);
      },
    );
  };

  // ── Cancel ─────────────────────────────────────────────────────
  const handleCancel = (item: LeaveRequest) => {
    showConfirm(
      'İzin İptali',
      `${item.firstName} ${item.lastName} adlı çalışanın ${item.leaveType} iznini iptal etmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz.`,
      'İptal Et',
      () => {
        cancelRequest(item.id);
        showAlert('İptal Edildi', `${item.firstName} ${item.lastName} adlı çalışanın izni iptal edildi.`);
      },
    );
  };

  // ── Edit Modal ─────────────────────────────────────────────────
  const openEditModal = (item: LeaveRequest) => {
    setEditTarget(item);
    setEditLeaveType(item.leaveType);
    setEditStartDate(item.startDate);
    setEditEndDate(item.endDate);
    setEditDescription(item.description);
    setEditModalVisible(true);
  };

  const confirmEdit = () => {
    if (!editTarget) return;
    if (editDescription.trim().length === 0) {
      showAlert('Hata', 'Açıklama boş bırakılamaz.');
      return;
    }
    if (editStartDate.trim().length === 0 || editEndDate.trim().length === 0) {
      showAlert('Hata', 'Tarih alanları boş bırakılamaz.');
      return;
    }

    updateRequest(editTarget.id, {
      leaveType: editLeaveType,
      startDate: editStartDate.trim(),
      endDate: editEndDate.trim(),
      description: editDescription.trim(),
    });

    setEditModalVisible(false);
    setEditTarget(null);

    const msg = editLeaveType === 'Acil'
      ? 'İzin ACİL olarak güncellendi ve otomatik onaylandı.'
      : 'İzin talebi başarıyla güncellendi.';
    showAlert('Güncellendi', msg);
  };

  // ── Card Renderers ─────────────────────────────────────────────
  const renderPendingCard = ({ item, index }: { item: LeaveRequest; index: number }) => (
    <Animated.View
      entering={FadeInDown.delay(index * 50).duration(280).springify().damping(18)}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        Shadow.card,
      ]}>
      {/* Updated badge */}
      {item.updatedAt && (
        <View style={[styles.updatedBadge, { backgroundColor: `${Palette.primary}14` }]}>
          <ThemedText style={[styles.updatedBadgeText, { color: Palette.primary }]}>
            ✏️ Güncellendi — {item.updatedAt}
          </ThemedText>
        </View>
      )}

      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <ThemedText style={[styles.cardName, { color: colors.text }]}>
            {item.firstName} {item.lastName}
          </ThemedText>
          <ThemedText style={[styles.cardBranch, { color: colors.textMuted }]}>
            📍 {item.branch}
          </ThemedText>
        </View>
        <View style={styles.cardHeaderActions}>
          <Pressable onPress={() => openEditModal(item)} style={[styles.iconBtn, { backgroundColor: `${Palette.primary}14` }]}>
            <ThemedText style={{ fontSize: 16 }}>✏️</ThemedText>
          </Pressable>
          <Pressable onPress={() => handleCancel(item)} style={[styles.iconBtn, { backgroundColor: `${Palette.canceled}14` }]}>
            <ThemedText style={{ fontSize: 16 }}>🚫</ThemedText>
          </Pressable>
        </View>
      </View>

      {/* Leave type badge */}
      <View style={[styles.typeBadge, { backgroundColor: colors.primarySoft, alignSelf: 'flex-start' }]}>
        <ThemedText style={[styles.typeBadgeText, { color: colors.primary }]}>
          {leaveTypeEmoji(item.leaveType)} {item.leaveType}
        </ThemedText>
      </View>

      {/* Date info */}
      <View style={[styles.dateInfoBox, { backgroundColor: colors.surfaceRaised }]}>
        <ThemedText style={[styles.dateInfoText, { color: colors.text }]}>
          📅 {item.startDate} — {item.endDate}
        </ThemedText>
        <ThemedText style={[styles.dateInfoDays, { color: colors.primary }]}>
          {item.netDays} Gün
        </ThemedText>
      </View>

      {/* Description */}
      <ThemedText style={[styles.cardDescription, { color: colors.textMuted }]}>
        {item.description}
      </ThemedText>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <Pressable
          onPress={() => handleApprove(item)}
          style={({ pressed }) => [
            styles.actionBtn,
            {
              backgroundColor: pressed ? '#1DA84E' : Palette.success,
            },
          ]}>
          <ThemedText style={styles.actionBtnText}>✓ Onayla</ThemedText>
        </Pressable>
        <Pressable
          onPress={() => openRejectModal(item)}
          style={({ pressed }) => [
            styles.actionBtn,
            {
              backgroundColor: pressed ? '#D63A2F' : Palette.danger,
            },
          ]}>
          <ThemedText style={styles.actionBtnText}>✕ Reddet</ThemedText>
        </Pressable>
      </View>
    </Animated.View>
  );

  const renderProcessedCard = ({ item, index }: { item: LeaveRequest; index: number }) => {
    const isEmergency = item.status === 'AUTO_APPROVED';
    const isAdminCreated = item.createdByAdmin === true;

    return (
      <Animated.View
        entering={FadeInDown.delay(index * 50).duration(280).springify().damping(18)}
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: isEmergency ? Palette.danger : colors.border,
            borderWidth: isEmergency ? 2 : 1,
          },
          Shadow.card,
        ]}>
        {/* Emergency badge — tam genişlik kırmızı banner */}
        {isEmergency && (
          <View style={styles.emergencyBanner}>
            <ThemedText style={styles.emergencyBannerText}>
              🚨 ACİL — Sistem Tarafından Onaylandı
            </ThemedText>
          </View>
        )}

        {/* Admin tarafından oluşturulmuş rozet */}
        {isAdminCreated && !isEmergency && (
          <View style={[styles.adminBadge, { backgroundColor: colors.primarySoft }]}>
            <ThemedText style={[styles.adminBadgeText, { color: colors.primary }]}>
              👤 Admin Tarafından Oluşturuldu
            </ThemedText>
          </View>
        )}

        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <ThemedText style={[styles.cardName, { color: colors.text }]}>
              {item.firstName} {item.lastName}
            </ThemedText>
            <ThemedText style={[styles.cardBranch, { color: colors.textMuted }]}>
              📍 {item.branch}
            </ThemedText>
          </View>
          <View style={[styles.typeBadge, { backgroundColor: colors.primarySoft }]}>
            <ThemedText style={[styles.typeBadgeText, { color: colors.primary }]}>
              {leaveTypeEmoji(item.leaveType)} {item.leaveType}
            </ThemedText>
          </View>
        </View>

        {/* Date info */}
        <View style={[styles.dateInfoBox, { backgroundColor: colors.surfaceRaised }]}>
          <ThemedText style={[styles.dateInfoText, { color: colors.text }]}>
            📅 {item.startDate} — {item.endDate}
          </ThemedText>
          <ThemedText style={[styles.dateInfoDays, { color: colors.primary }]}>
            {item.netDays} Gün
          </ThemedText>
        </View>

        {/* Description */}
        <ThemedText style={[styles.cardDescription, { color: colors.textMuted }]}>
          {item.description}
        </ThemedText>

        {/* Status badge */}
        <View style={[styles.statusRow]}>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor(item.status)}18` }]}>
            <ThemedText style={[styles.statusBadgeText, { color: statusColor(item.status) }]}>
              {statusLabel(item.status)}
            </ThemedText>
          </View>
          {item.processedAt && (
            <ThemedText style={[styles.processedAt, { color: colors.textFaint }]}>
              {item.processedAt}
            </ThemedText>
          )}
        </View>

        {/* Rejection reason */}
        {item.status === 'REJECTED' && item.rejectionReason && (
          <View style={[styles.rejectionBox, { backgroundColor: `${Palette.danger}12` }]}>
            <ThemedText style={[styles.rejectionLabel, { color: Palette.danger }]}>
              Ret Nedeni:
            </ThemedText>
            <ThemedText style={[styles.rejectionText, { color: colors.textMuted }]}>
              {item.rejectionReason}
            </ThemedText>
          </View>
        )}
      </Animated.View>
    );
  };

  const currentList = activeTab === 'pending' ? pendingList : processedList;

  return (
    <Screen scroll={false}>
      <View style={styles.headerWrap}>
        <ThemedText type="title" style={styles.pageTitle}>
          İzin Onay Yönetimi
        </ThemedText>

        {/* Tab Buttons */}
        <View
          style={[styles.tabRow, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
          onLayout={(e) => setTabRowWidth(e.nativeEvent.layout.width)}>
          {tabRowWidth > 0 && (
            <Animated.View
              style={[
                styles.tabIndicator,
                { backgroundColor: colors.primary, width: indicatorWidth },
                indicatorStyle,
              ]}
            />
          )}
          <Pressable onPress={() => selectTab('pending')} style={styles.tabBtn}>
            <Animated.Text style={[styles.tabBtnText, pendingLabelStyle]}>
              Bekleyen Talepler
            </Animated.Text>
            {pendingList.length > 0 && (
              <View style={[styles.badge, { backgroundColor: activeTab === 'pending' ? '#fff' : colors.primary }]}>
                <ThemedText
                  style={[
                    styles.badgeText,
                    { color: activeTab === 'pending' ? colors.primary : '#fff' },
                  ]}>
                  {pendingList.length}
                </ThemedText>
              </View>
            )}
          </Pressable>
          <Pressable onPress={() => selectTab('history')} style={styles.tabBtn}>
            <Animated.Text style={[styles.tabBtnText, historyLabelStyle]}>
              İşlem Görenler
            </Animated.Text>
          </Pressable>
        </View>
      </View>

      {/* List */}
      <FlatList
        data={currentList}
        keyExtractor={(item) => item.id}
        renderItem={activeTab === 'pending' ? renderPendingCard : renderProcessedCard}
        style={styles.flatList}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={true}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <ThemedText style={[styles.emptyText, { color: colors.textFaint }]}>
              {activeTab === 'pending'
                ? '🎉 Bekleyen izin talebi bulunmuyor.'
                : 'Henüz işlem görmüş talep yok.'}
            </ThemedText>
          </View>
        }
      />

      {/* ─── Reject Reason Modal ────────────────────────────────── */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ThemedText style={[styles.modalTitle, { color: colors.text }]}>
              Reddetme Nedeni
            </ThemedText>

            {rejectTarget && (
              <ThemedText style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                {rejectTarget.firstName} {rejectTarget.lastName} — {rejectTarget.leaveType} İzni
              </ThemedText>
            )}

            <TextInput
              style={[
                styles.modalInput,
                {
                  color: colors.text,
                  backgroundColor: colors.surfaceRaised,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Ret nedenini açıklayınız..."
              placeholderTextColor={colors.textFaint}
              multiline
              value={rejectReason}
              onChangeText={setRejectReason}
              autoFocus
            />

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setRejectModalVisible(false);
                  setRejectTarget(null);
                  setRejectReason('');
                }}
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}>
                <ThemedText style={[styles.modalCancelText, { color: colors.textMuted }]}>
                  İptal
                </ThemedText>
              </Pressable>
              <View style={{ flex: 1 }}>
                <Button label="Reddet" onPress={confirmReject} />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Edit Modal ─────────────────────────────────────────── */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ThemedText style={[styles.modalTitle, { color: colors.text }]}>
              İzin Düzenle
            </ThemedText>

            {editTarget && (
              <ThemedText style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                {editTarget.firstName} {editTarget.lastName} — {editTarget.branch}
              </ThemedText>
            )}

            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {/* Leave type chips */}
              <ThemedText style={[styles.editLabel, { color: colors.textMuted }]}>İzin Türü</ThemedText>
              <View style={styles.editChipRow}>
                {LEAVE_TYPES.map((type) => {
                  const active = editLeaveType === type;
                  return (
                    <Pressable
                      key={type}
                      onPress={() => setEditLeaveType(type)}
                      style={[
                        styles.editChip,
                        {
                          backgroundColor: active ? colors.primary : 'transparent',
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}>
                      <ThemedText style={{ color: active ? '#fff' : colors.text, fontSize: 13, fontWeight: active ? '600' : '400' }}>
                        {leaveTypeEmoji(type)} {type}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              {/* Date fields */}
              <ThemedText style={[styles.editLabel, { color: colors.textMuted }]}>Başlangıç Tarihi</ThemedText>
              <TextInput
                style={[styles.editInput, { color: colors.text, backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
                placeholder="GG.AA.YYYY"
                placeholderTextColor={colors.textFaint}
                value={editStartDate}
                onChangeText={setEditStartDate}
              />

              <ThemedText style={[styles.editLabel, { color: colors.textMuted }]}>Bitiş Tarihi</ThemedText>
              <TextInput
                style={[styles.editInput, { color: colors.text, backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
                placeholder="GG.AA.YYYY"
                placeholderTextColor={colors.textFaint}
                value={editEndDate}
                onChangeText={setEditEndDate}
              />

              {/* Description */}
              <ThemedText style={[styles.editLabel, { color: colors.textMuted }]}>Açıklama</ThemedText>
              <TextInput
                style={[styles.modalInput, { color: colors.text, backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
                placeholder="İzin açıklaması..."
                placeholderTextColor={colors.textFaint}
                multiline
                value={editDescription}
                onChangeText={setEditDescription}
              />
            </ScrollView>

            {editLeaveType === 'Acil' && (
              <View style={[styles.editWarning, { backgroundColor: `${Palette.danger}14` }]}>
                <ThemedText style={{ color: Palette.danger, fontSize: 12, fontWeight: '700' }}>
                  ⚠️ Acil izin seçildi — kaydet butonuna basıldığında otomatik onaylanacaktır.
                </ThemedText>
              </View>
            )}

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => { setEditModalVisible(false); setEditTarget(null); }}
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}>
                <ThemedText style={[styles.modalCancelText, { color: colors.textMuted }]}>
                  Vazgeç
                </ThemedText>
              </Pressable>
              <View style={{ flex: 1 }}>
                <Button label="Kaydet" onPress={confirmEdit} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Screen artık scroll=false yolunda genişlik sınırlamıyor (FlatList'in kendi
  // kaydırma çubuğu ekranın en sağına yapışsın diye) — bu yüzden kaydırmayan
  // başlık/tab alanını burada kendimiz ortalayıp genişlik sınırlıyoruz.
  headerWrap: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: Space.xl,
    paddingTop: Space.xl,
    paddingBottom: Space.md,
    gap: Space.md,
  },
  pageTitle: {
    marginTop: Space.sm,
    marginBottom: Space.md,
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 3,
    marginBottom: Space.md,
  },
  tabIndicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: Radius.sm,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    paddingVertical: Space.md,
    borderRadius: Radius.sm,
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 12,
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

  // Card (inline, not using <Card> for extra control)
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Space.xl,
    gap: Space.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardBranch: {
    fontSize: 13,
    marginTop: 2,
  },
  typeBadge: {
    paddingHorizontal: Space.md,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Date info
  dateInfoBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    borderRadius: Radius.md,
  },
  dateInfoText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dateInfoDays: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Description
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap: Space.md,
    marginTop: Space.xs,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: '#fff',
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
    backgroundColor: Palette.danger,
    paddingHorizontal: Space.md,
    paddingVertical: Space.md,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  emergencyBannerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Admin oluşturma rozeti
  adminBadge: {
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    borderRadius: Radius.sm,
    alignSelf: 'flex-start',
  },
  adminBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Card header icon buttons
  cardHeaderActions: {
    flexDirection: 'row',
    gap: Space.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Updated badge
  updatedBadge: {
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs,
    borderRadius: Radius.sm,
    alignSelf: 'flex-start',
  },
  updatedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Edit modal extras
  editLabel: {
    fontSize: 13,
    marginBottom: Space.xs,
    marginTop: Space.md,
  },
  editChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  editChip: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: 12,
    fontSize: 15,
  },
  editWarning: {
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    borderRadius: Radius.sm,
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
  },

  // Empty state
  emptyBox: {
    alignItems: 'center',
    paddingVertical: Space.xxl * 2,
  },
  emptyText: {
    fontSize: 15,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: Space.xl,
  },
  modalContent: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Space.xl,
    gap: Space.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 14,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: 14,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
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
});
