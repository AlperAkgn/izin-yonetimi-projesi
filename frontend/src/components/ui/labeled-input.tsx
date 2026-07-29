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
  /** Doluysa kenarlık kırmızıya döner ve alanın altında mesaj çıkar */
  error?: string;
};

export function LabeledInput({
  label,
  maxLength,
  error,
  value,
  onFocus,
  onBlur,
  ...rest
}: Props) {
  const { colors } = useDesign();
  const length = value?.length ?? 0;
  const focusProgress = useSharedValue(0);

  // Sayaç limit tanımlıysa hep görünür; limite gelince kırmızıya döner
  const showCounter = maxLength !== undefined;
  const atLimit = maxLength !== undefined && length >= maxLength;

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
          // Hata odak animasyonunu ezmeli — bu yüzden en sonda
          error ? { borderColor: colors.danger } : null,
          rest.style,
        ]}
      />

      {(error || showCounter) && (
        <View style={styles.footer}>
          {error ? (
            <ThemedText style={[styles.error, { color: colors.danger }]}>{error}</ThemedText>
          ) : (
            <View style={styles.grow} />
          )}
          {showCounter && (
            <ThemedText
              style={[styles.counter, { color: atLimit ? colors.danger : colors.textFaint }]}>
              {length}/{maxLength}
            </ThemedText>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  wrap: { gap: 4 },
  label: { fontSize: 13, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: 12,
    fontSize: 15,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  error: { flex: 1, fontSize: 12, fontWeight: '600' },
  counter: { fontSize: 11 },
});
