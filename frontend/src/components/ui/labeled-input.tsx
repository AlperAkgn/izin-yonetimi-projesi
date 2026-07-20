import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Space } from '@/constants/design';
import { useDesign } from '@/hooks/use-design';

type Props = TextInputProps & {
  label: string;
  maxLength?: number;
};

export function LabeledInput({ label, maxLength, value, ...rest }: Props) {
  const { colors } = useDesign();
  const length = value?.length ?? 0;

  return (
    <View style={styles.wrap}>
      <ThemedText style={[styles.label, { color: colors.textMuted }]}>{label}</ThemedText>
      <TextInput
        placeholderTextColor={colors.textFaint}
        maxLength={maxLength}
        value={value}
        {...rest}
        style={[
          styles.input,
          { color: colors.text, backgroundColor: colors.surfaceRaised, borderColor: colors.border },
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