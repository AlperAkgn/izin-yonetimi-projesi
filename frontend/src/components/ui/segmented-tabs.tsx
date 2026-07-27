import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Radius, Space } from '@/constants/design';
import { useDesign } from '@/hooks/use-design';

export type SegmentedTab<T extends string> = {
  key: T;
  label: string;
  /** 0 ise rozet çizilmez */
  badge?: number;
};

// Gösterge, kenarlık ve iç dolgu düşülmüş iç kutunun tam bölümü kadar geniş
// olmalı — yoksa son sekmede kenardan taşar.
const BORDER = 1;
const PADDING = 3;

/** Kayan göstergeli segment çubuğu */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: SegmentedTab<T>[];
  value: T;
  onChange: (key: T) => void;
}) {
  const { colors } = useDesign();
  const [rowWidth, setRowWidth] = useState(0);

  const activeIndex = Math.max(
    tabs.findIndex((t) => t.key === value),
    0,
  );
  const indicatorWidth = rowWidth > 0 ? (rowWidth - 2 * BORDER - 2 * PADDING) / tabs.length : 0;
  const progress = useSharedValue(activeIndex);

  const select = (tab: SegmentedTab<T>, index: number) => {
    onChange(tab.key);
    progress.value = withTiming(index, { duration: 260, easing: Easing.out(Easing.cubic) });
  };

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * indicatorWidth }],
  }));

  return (
    <View
      style={[styles.row, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
      onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}>
      {rowWidth > 0 && (
        <Animated.View
          style={[
            styles.indicator,
            { backgroundColor: colors.primary, width: indicatorWidth },
            indicatorStyle,
          ]}
        />
      )}

      {tabs.map((tab, index) => (
        <TabButton
          key={tab.key}
          tab={tab}
          index={index}
          progress={progress}
          isActive={tab.key === value}
          onPress={() => select(tab, index)}
        />
      ))}
    </View>
  );
}

function TabButton<T extends string>({
  tab,
  index,
  progress,
  isActive,
  onPress,
}: {
  tab: SegmentedTab<T>;
  index: number;
  progress: SharedValue<number>;
  isActive: boolean;
  onPress: () => void;
}) {
  const { colors } = useDesign();

  const labelStyle = useAnimatedStyle(() => {
    // Gösterge bu sekmenin üstündeyken beyaz, uzaklaştıkça soluk metne döner.
    // Mesafeyle çalışmak sekme sayısından bağımsız olmayı sağlıyor.
    const distance = Math.min(Math.abs(progress.value - index), 1);
    return { color: interpolateColor(distance, [0, 1], ['#ffffff', colors.textMuted]) };
  });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      style={styles.tab}>
      <Animated.Text style={[styles.label, labelStyle]}>{tab.label}</Animated.Text>

      {tab.badge !== undefined && tab.badge > 0 && (
        <View style={[styles.badge, { backgroundColor: isActive ? '#fff' : colors.primarySoft }]}>
          <ThemedText style={[styles.badgeText, { color: colors.primary }]}>{tab.badge}</ThemedText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    borderWidth: BORDER,
    padding: PADDING,
  },
  indicator: {
    position: 'absolute',
    top: PADDING,
    bottom: PADDING,
    left: PADDING,
    borderRadius: Radius.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    paddingVertical: Space.md,
    borderRadius: Radius.sm,
  },
  label: {
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
    lineHeight: 16,
  },
});
