import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Space } from '@/constants/design';
import { useDesign } from '@/hooks/use-design';

import type { FeatherName } from '@/components/ui/icon';

/** Bölüm başlığı — ikon rozeti + başlık/alt başlık */
export function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: FeatherName;
  title: string;
  subtitle: string;
}) {
  const { colors } = useDesign();
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionIcon, { backgroundColor: colors.primarySoft }]}>
        <Feather name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.grow}>
        <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
        <ThemedText style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
          {subtitle}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    marginBottom: Space.xs,
  },
  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 12,
  },
});
