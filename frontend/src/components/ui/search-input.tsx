import Feather from '@expo/vector-icons/Feather';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Radius, Space } from '@/constants/design';
import { webInputReset } from '@/constants/layout';
import { useDesign } from '@/hooks/use-design';

import type { StyleProp, ViewStyle } from 'react-native';

/**
 * Liste üstündeki arama kutusu — ikon + alan + temizle düğmesi.
 *
 * Üç ekranda birebir kopyalanmıştı (İzin Onay, Mesajlar, Yeni Sohbet).
 *
 * Not: Bu bileşen bir listenin `ListHeaderComponent`'ine verilecekse ELEMENT
 * olarak geçilmeli (`ListHeaderComponent={searchBox}`), fonksiyon olarak değil
 * — fonksiyon her render'da yeni bileşen tipi üretip alanın odağını düşürür.
 */
export function SearchInput({
  value,
  onChangeText,
  placeholder,
  autoFocus,
  style,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useDesign();

  return (
    <View
      style={[
        styles.box,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}>
      <Feather name="search" size={15} color={colors.textFaint} />
      <TextInput
        style={[styles.input, { color: colors.text }]}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        returnKeyType="search"
        autoFocus={autoFocus}
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel="Aramayı temizle"
          hitSlop={8}>
          <Feather name="x" size={15} color={colors.textFaint} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    // Web'de aynı dolgu mobilde kutuyu gereksiz şişiriyor
    paddingVertical: Platform.OS === 'web' ? 10 : 6,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 4,
    ...webInputReset,
  },
});
