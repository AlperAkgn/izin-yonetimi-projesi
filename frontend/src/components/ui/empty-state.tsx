import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Space } from '@/constants/design';
import { useDesign } from '@/hooks/use-design';

import type { FeatherName } from '@/components/ui/icon';

/** Liste boş durumu — soluk ikon dairesi + başlık + açıklama */
export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: FeatherName;
  title: string;
  description: string;
}) {
  const { colors } = useDesign();

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
        ]}>
        <Feather name={icon} size={26} color={colors.textFaint} />
      </View>
      <ThemedText style={[styles.title, { color: colors.text }]}>{title}</ThemedText>
      <ThemedText style={[styles.description, { color: colors.textFaint }]}>
        {description}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: Space.xxl * 2,
    paddingHorizontal: Space.xl,
    gap: Space.sm,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space.xs,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  description: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});
