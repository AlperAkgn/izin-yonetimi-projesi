import { Radius, Shadow, Space } from '@/constants/design';
import { useDesign } from '@/hooks/use-design';
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

export function Card({ children }: { children: ReactNode }) {
  const { colors } = useDesign();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        Shadow.card,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Space.xl,
    gap: Space.sm,
  },
});