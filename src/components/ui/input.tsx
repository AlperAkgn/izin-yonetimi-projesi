import { Radius, Space } from '@/constants/design';
import { useDesign } from '@/hooks/use-design';
import { StyleSheet, TextInput, TextInputProps } from 'react-native';

export function Input(props: TextInputProps) {
  const { colors } = useDesign();
  return (
    <TextInput
      placeholderTextColor={colors.textFaint}
      {...props}
      style={[
        styles.input,
        { color: colors.text, backgroundColor: colors.surfaceRaised, borderColor: colors.border },
        props.style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: 14,
    fontSize: 16,
  },
});