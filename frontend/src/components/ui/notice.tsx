import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Space } from '@/constants/design';

import type { FeatherName } from '@/components/ui/icon';

/** Renkli bilgi/uyarı şeridi — zemin, verilen rengin soluk tonudur */
export function Notice({ icon, text, color }: { icon: FeatherName; text: string; color: string }) {
  return (
    <View style={[styles.notice, { backgroundColor: `${color}14` }]}>
      <Feather name={icon} size={14} color={color} />
      <ThemedText style={[styles.noticeText, { color }]}>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    borderRadius: Radius.sm,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
});
