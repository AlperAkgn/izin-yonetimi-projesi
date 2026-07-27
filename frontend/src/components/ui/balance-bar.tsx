import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Space } from '@/constants/design';
import { useDesign } from '@/hooks/use-design';

import type { LeaveBalance } from '@/store/leaveRequestsStore';

/**
 * Yıllık izin bakiyesi şeridi — dolu kısım kullanılan günü gösterir.
 *
 * variant="card" kendi kenarlıklı kutusunu çizer (sabit başlıkta tek başına
 * dururken), "plain" ise bulunduğu kartın içine gömülür.
 */
export function BalanceBar({
  balance,
  label,
  hint,
  variant = 'plain',
}: {
  balance: LeaveBalance;
  label: string;
  hint?: string;
  variant?: 'plain' | 'card';
}) {
  const { colors } = useDesign();

  const ratio = balance.entitlement > 0 ? balance.used / balance.entitlement : 0;
  const tone = ratio >= 1 ? colors.danger : ratio >= 0.75 ? colors.warning : colors.success;
  const boxed = variant === 'card';

  return (
    <View
      style={[
        styles.wrap,
        boxed ? styles.card : null,
        boxed ? { backgroundColor: colors.surface, borderColor: colors.border } : null,
      ]}>
      <View style={styles.head}>
        <View style={styles.labelRow}>
          <Feather name="pie-chart" size={12} color={colors.textMuted} />
          <ThemedText style={[styles.label, { color: colors.textMuted }]}>{label}</ThemedText>
        </View>
        <ThemedText style={[styles.value, { color: colors.text }]}>
          {balance.remaining} / {balance.entitlement} gün
        </ThemedText>
      </View>

      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View
          style={[styles.fill, { backgroundColor: tone, width: `${Math.min(ratio, 1) * 100}%` }]}
        />
      </View>

      {hint !== undefined && (
        <ThemedText style={[styles.hint, { color: colors.textFaint }]}>{hint}</ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.sm,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 12,
  },
  value: {
    fontSize: 12,
    fontWeight: '700',
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  hint: {
    fontSize: 12,
  },
});
