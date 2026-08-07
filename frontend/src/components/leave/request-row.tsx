import { StyleSheet, View } from 'react-native';
import Animated, { FadeOutUp, LinearTransition } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { ListRow } from '@/components/ui/list-row';
import { Radius, Space } from '@/constants/design';
import { leaveTypeEmoji, statusMeta } from '@/constants/leave';
import { useDesign } from '@/hooks/use-design';

import { Checkbox, cardEntering } from '@/components/leave/leave-parts';

import type { LeaveRequest } from '@/store/leaveRequestsStore';

/**
 * Geniş ekranda soldaki dar liste satırı — tek bakışta kim, ne, ne zaman,
 * kaç gün. Detayın tamamı sağdaki panelde; burası yalnızca seçici.
 */
export function RequestRow({
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
  const meta = statusMeta(item.status);

  return (
    <Animated.View
      entering={cardEntering(index)}
      exiting={FadeOutUp.duration(160)}
      layout={LinearTransition.springify().damping(18)}>
      <ListRow
        onPress={onPress}
        active={active}
        stripe={meta.color}
        accessibilityLabel={`${item.firstName} ${item.lastName} talebi`}
        style={styles.row}>
        {selectable && (
          <Checkbox
            checked={selected}
            label={`${item.firstName} ${item.lastName} talebini seç`}
            onToggle={() => onToggleSelect(item.id)}
          />
        )}

        <Avatar firstName={item.firstName} lastName={item.lastName} size={32} />

        <View style={styles.grow}>
          <ThemedText style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {item.firstName} {item.lastName}
          </ThemedText>
          <ThemedText style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
            {leaveTypeEmoji(item.leaveType)} {item.leaveType} · {item.startDate}
          </ThemedText>
        </View>

        <View style={[styles.days, { backgroundColor: colors.primarySoft }]}>
          <ThemedText style={[styles.daysText, { color: colors.primary }]}>
            {item.netDays}g
          </ThemedText>
        </View>
      </ListRow>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  // Kabuğu ListRow çiziyor; burada yalnız bu listeye özgü sapma var:
  // dar panele çok satır sığsın diye dikey dolgu kısaltılmış.
  row: {
    gap: Space.sm,
    paddingVertical: 10,
  },
  name: { fontSize: 14, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 1 },
  days: {
    paddingHorizontal: Space.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  daysText: { fontSize: 12, fontWeight: '700' },
});
