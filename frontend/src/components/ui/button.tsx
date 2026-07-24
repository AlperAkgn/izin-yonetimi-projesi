import { Radius, Space } from '@/constants/design';
import { useDesign } from '@/hooks/use-design';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const PRESS_SPRING = { damping: 15, stiffness: 300 };

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'ghost';
};

export function Button({ label, onPress, loading, variant = 'primary' }: Props) {
  const { colors } = useDesign();
  const isPrimary = variant === 'primary';
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.96, PRESS_SPRING);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, PRESS_SPRING);
      }}
      disabled={loading}>
      {({ pressed }) => (
        <Animated.View
          style={[
            styles.base,
            animatedStyle,
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
        </Animated.View>
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