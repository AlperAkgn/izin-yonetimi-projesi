import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

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

import type { LeaveRequest, LeaveStatus } from '@/store/leaveRequestsStore';

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

  // Store'dan oku
  const allRequests = useLeaveRequestsStore((s) => s.requests);
  const approveRequest = useLeaveRequestsStore((s) => s.approveRequest);
  const rejectRequest = useLeaveRequestsStore((s) => s.rejectRequest);

  // Türetilmiş listeler — tek kaynak (store) üzerinden filtrelenir
  const pendingList = filterPendingRequests(allRequests);
  const processedList = filterProcessedRequests(allRequests);

  // Reject modal state
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

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

  // ── Card Renderers ─────────────────────────────────────────────
  const renderPendingCard = ({ item }: { item: LeaveRequest }) => (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        Shadow.card,
      ]}>
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

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <Pressable
          onPress={() => handleApprove(item)}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.approveBtn,
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
            styles.rejectBtn,
            {
              backgroundColor: pressed ? '#D63A2F' : Palette.danger,
            },
          ]}>
          <ThemedText style={styles.actionBtnText}>✕ Reddet</ThemedText>
        </Pressable>
      </View>
    </View>
  );

  const renderProcessedCard = ({ item }: { item: LeaveRequest }) => {
    const isEmergency = item.status === 'AUTO_APPROVED';
    const isAdminCreated = item.createdByAdmin === true;

    return (
      <View
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
      </View>
    );
  };

  const currentList = activeTab === 'pending' ? pendingList : processedList;

  return (
    <Screen scroll={false}>
      <ThemedText type="title" style={styles.pageTitle}>
        İzin Onay Yönetimi
      </ThemedText>

      {/* Tab Buttons */}
      <View style={[styles.tabRow, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
        <Pressable
          onPress={() => setActiveTab('pending')}
          style={[
            styles.tabBtn,
            {
              backgroundColor: activeTab === 'pending' ? colors.primary : 'transparent',
            },
          ]}>
          <ThemedText
            style={[
              styles.tabBtnText,
              { color: activeTab === 'pending' ? '#fff' : colors.textMuted },
            ]}>
            Bekleyen Talepler
          </ThemedText>
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
        <Pressable
          onPress={() => setActiveTab('history')}
          style={[
            styles.tabBtn,
            {
              backgroundColor: activeTab === 'history' ? colors.primary : 'transparent',
            },
          ]}>
          <ThemedText
            style={[
              styles.tabBtnText,
              { color: activeTab === 'history' ? '#fff' : colors.textMuted },
            ]}>
            İşlem Görenler
          </ThemedText>
        </Pressable>
      </View>

      {/* List */}
      <FlatList
        data={currentList}
        keyExtractor={(item) => item.id}
        renderItem={activeTab === 'pending' ? renderPendingCard : renderProcessedCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
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
    </Screen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
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

  // List
  listContent: {
    paddingBottom: Space.xxl,
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
  approveBtn: {},
  rejectBtn: {},
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
