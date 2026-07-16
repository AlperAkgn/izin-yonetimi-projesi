import { Radius, Space } from '@/constants/design';
import { useDesign } from '@/hooks/use-design';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'ghost';
};

export function Button({ label, onPress, loading, variant = 'primary' }: Props) {
  const { colors } = useDesign();
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: isPrimary
            ? pressed
              ? colors.primaryPressed
              : colors.primary
            : 'transparent',
          opacity: loading ? 0.6 : 1,
        },
      ]}>
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={[styles.label, { color: isPrimary ? '#fff' : colors.primary }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.md,
    paddingVertical: 15,
    paddingHorizontal: Space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontWeight: '600', fontSize: 16 },
});