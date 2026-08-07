import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeOutUp, LinearTransition } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { BalanceBar } from '@/components/ui/balance-bar';
import { Notice } from '@/components/ui/notice';
import { Palette, Radius, Shadow, Space } from '@/constants/design';
import { statusMeta } from '@/constants/leave';
import { useDesign } from '@/hooks/use-design';

import {
  CardHeader,
  Checkbox,
  DateRangeBox,
  ExpandableText,
  TypeBadge,
  cardEntering,
  sharedLeaveStyles as shared,
  ActionButton,
} from '@/components/leave/leave-parts';

import type { LeaveBalance, LeaveRequest } from '@/store/leaveRequestsStore';

/**
 * Dar ekrandaki (telefon) tek kolon kart listesi. Geniş ekranda bunların
 * yerine solda `RequestRow`, sağda `DetailPanel` kullanılıyor.
 */

export function PendingCard({
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

export function ProcessedCard({ item, index }: { item: LeaveRequest; index: number }) {
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
        <View style={[shared.emergencyBanner, { backgroundColor: Palette.danger }]}>
          <Feather name="alert-triangle" size={13} color="#FFFFFF" />
          <ThemedText style={shared.emergencyBannerText}>
            ACİL — Sistem tarafından onaylandı
          </ThemedText>
        </View>
      )}

      {isAdminCreated && !isEmergency && (
        <View style={[shared.adminBadge, { backgroundColor: colors.primarySoft }]}>
          <Feather name="user-check" size={11} color={colors.primary} />
          <ThemedText style={[shared.adminBadgeText, { color: colors.primary }]}>
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
        <View style={[shared.statusBadge, { backgroundColor: `${meta.color}18` }]}>
          <Feather name={meta.icon} size={12} color={meta.color} />
          <ThemedText style={[shared.statusBadgeText, { color: meta.color }]}>
            {meta.label}
          </ThemedText>
        </View>
        {item.processedAt && (
          <ThemedText style={[shared.processedAt, { color: colors.textFaint }]}>
            {item.processedAt}
          </ThemedText>
        )}
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
  actionRow: {
    flexDirection: 'row',
    gap: Space.md,
    marginTop: Space.xs,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
});
