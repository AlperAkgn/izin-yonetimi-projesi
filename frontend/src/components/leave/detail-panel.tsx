import Feather from '@expo/vector-icons/Feather';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { BalanceBar } from '@/components/ui/balance-bar';
import { Notice } from '@/components/ui/notice';
import { Palette, Radius, Space } from '@/constants/design';
import { statusMeta } from '@/constants/leave';
import { useDesign } from '@/hooks/use-design';

import {
  ActionButton,
  TypeBadge,
  sharedLeaveStyles as shared,
} from '@/components/leave/leave-parts';

import type { LeaveBalance, LeaveRequest } from '@/store/leaveRequestsStore';

/**
 * Geniş ekranda sağdaki detay paneli — seçili talebin tüm bilgisi.
 *
 * Aksiyon şeridi kaydırma alanının DIŞINDA, panelin dibine sabit: uzun
 * açıklamalarda bile "Onayla/Reddet" hep göz önünde kalır.
 */
export function DetailPanel({
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
      <ScrollView style={shared.grow} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Avatar firstName={item.firstName} lastName={item.lastName} size={56} />
          <View style={shared.grow}>
            <ThemedText style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {item.firstName} {item.lastName}
            </ThemedText>
            <View style={shared.branchRow}>
              <Feather name="map-pin" size={12} color={colors.textMuted} />
              <ThemedText style={[shared.cardBranch, { color: colors.textMuted }]} numberOfLines={1}>
                {item.branch}
              </ThemedText>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TypeBadge type={item.leaveType} />
            <View style={[shared.statusBadge, { backgroundColor: `${meta.color}18` }]}>
              <Feather name={meta.icon} size={12} color={meta.color} />
              <ThemedText style={[shared.statusBadgeText, { color: meta.color }]}>
                {meta.label}
              </ThemedText>
            </View>
          </View>
        </View>

        {isEmergency && (
          <View style={[shared.emergencyBanner, { backgroundColor: Palette.danger }]}>
            <Feather name="alert-triangle" size={13} color="#FFFFFF" />
            <ThemedText style={shared.emergencyBannerText}>
              ACİL — Sistem tarafından onaylandı
            </ThemedText>
          </View>
        )}

        {item.createdByAdmin === true && !isEmergency && (
          <View style={[shared.adminBadge, { backgroundColor: colors.primarySoft }]}>
            <Feather name="user-check" size={11} color={colors.primary} />
            <ThemedText style={[shared.adminBadgeText, { color: colors.primary }]}>
              Admin tarafından oluşturuldu
            </ThemedText>
          </View>
        )}

        <View
          style={[
            styles.dateBox,
            { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
          ]}>
          <View>
            <ThemedText style={[styles.dateLabel, { color: colors.textFaint }]}>
              Başlangıç
            </ThemedText>
            <ThemedText style={[styles.dateValue, { color: colors.text }]}>
              {item.startDate}
            </ThemedText>
          </View>
          <Feather name="arrow-right" size={18} color={colors.textFaint} />
          <View>
            <ThemedText style={[styles.dateLabel, { color: colors.textFaint }]}>Bitiş</ThemedText>
            <ThemedText style={[styles.dateValue, { color: colors.text }]}>
              {item.endDate}
            </ThemedText>
          </View>
          <View style={shared.grow} />
          <View style={[styles.dayPill, { backgroundColor: colors.primarySoft }]}>
            <ThemedText style={[styles.dayPillText, { color: colors.primary }]}>
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
          <ThemedText style={[styles.blockLabel, { color: colors.textFaint }]}>Açıklama</ThemedText>
          <ThemedText style={[styles.description, { color: colors.textMuted }]}>
            {item.description}
          </ThemedText>
        </View>

        {item.status === 'REJECTED' && item.rejectionReason && (
          <View style={[shared.rejectionBox, { backgroundColor: `${Palette.danger}12` }]}>
            <ThemedText style={[shared.rejectionLabel, { color: Palette.danger }]}>
              Ret nedeni
            </ThemedText>
            <ThemedText style={[shared.rejectionText, { color: colors.textMuted }]}>
              {item.rejectionReason}
            </ThemedText>
          </View>
        )}

        {item.processedAt && (
          <ThemedText style={[shared.processedAt, { color: colors.textFaint }]}>
            İşlem tarihi: {item.processedAt}
          </ThemedText>
        )}
      </ScrollView>

      {isPending && (
        <View style={[styles.actions, { borderTopColor: colors.border }]}>
          <View style={styles.actionMain}>
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

const styles = StyleSheet.create({
  content: {
    padding: Space.xl,
    gap: Space.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.lg,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: Space.sm,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  dateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Space.xl,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.xl,
    paddingVertical: Space.lg,
  },
  dateLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    lineHeight: 14,
  },
  dateValue: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  dayPill: {
    paddingHorizontal: Space.lg,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  dayPillText: {
    fontSize: 14,
    fontWeight: '700',
  },
  blockLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    lineHeight: 14,
    marginBottom: 2,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
  // Kaydırma alanının dışında, panelin dibine sabit
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    borderTopWidth: 1,
    paddingHorizontal: Space.xl,
    paddingVertical: Space.lg,
  },
  actionMain: {
    flex: 1,
    flexDirection: 'row',
    gap: Space.md,
  },
});
