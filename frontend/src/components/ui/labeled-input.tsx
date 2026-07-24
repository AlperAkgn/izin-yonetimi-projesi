import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Radius, Space } from '@/constants/design';
import { useDesign } from '@/hooks/use-design';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

type Props = TextInputProps & {
  label: string;
  maxLength?: number;
};

export function LabeledInput({ label, maxLength, value, onFocus, onBlur, ...rest }: Props) {
  const { colors } = useDesign();
  const length = value?.length ?? 0;
  const focusProgress = useSharedValue(0);

  const animatedBorderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focusProgress.value, [0, 1], [colors.border, colors.primary]),
  }));

  return (
    <View style={styles.wrap}>
      <ThemedText style={[styles.label, { color: colors.textMuted }]}>{label}</ThemedText>
      <AnimatedTextInput
        placeholderTextColor={colors.textFaint}
        maxLength={maxLength}
        value={value}
        onFocus={(e) => {
          focusProgress.value = withTiming(1, { duration: 180 });
          onFocus?.(e);
        }}
        onBlur={(e) => {
          focusProgress.value = withTiming(0, { duration: 180 });
          onBlur?.(e);
        }}
        {...rest}
        style={[
          styles.input,
          { color: colors.text, backgroundColor: colors.surfaceRaised },
          animatedBorderStyle,
          rest.style,
        ]}
      />
      {maxLength !== undefined && (
        <ThemedText style={[styles.counter, { color: colors.textFaint }]}>
          {length}/{maxLength}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  label: { fontSize: 13, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: 12,
    fontSize: 15,
  },
  counter: { fontSize: 11, alignSelf: 'flex-end' },
});