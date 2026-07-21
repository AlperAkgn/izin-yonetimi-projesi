import { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useDesign } from '@/hooks/use-design';
import { Radius, Space, Shadow } from '@/constants/design';

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { colors } = useDesign();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        Shadow.card,
        style,
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