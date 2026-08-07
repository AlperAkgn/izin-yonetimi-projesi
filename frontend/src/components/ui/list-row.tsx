import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Space } from '@/constants/design';
import { useDesign } from '@/hooks/use-design';

import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

/**
 * Liste satırlarının ortak kabuğu: kenarlıklı kart, üzerine gelince
 * (web) vurgu, seçiliyken birincil renk çerçevesi.
 *
 * Dört ekranda aynı kabuk elle yazılmıştı — İzin Onay'daki talep satırı,
 * Mesajlar'daki sohbet satırı, Yeni Sohbet'teki kişi satırı, şube ekranındaki
 * personel satırı. İçeriği çağıran belirler; burada yalnız kabuk var.
 *
 * `stripe` verilirse sol kenara o renkte durum şeridi çizilir.
 */
export function ListRow({
  children,
  onPress,
  active = false,
  stripe,
  accessibilityLabel,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  /** Seçili satır (geniş ekranda sağ panelde açık olan) */
  active?: boolean;
  /** Sol kenar durum şeridinin rengi */
  stripe?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useDesign();
  const [hovered, setHovered] = useState(false);

  const background = active
    ? colors.primarySoft
    : hovered
      ? colors.surfaceRaised
      : colors.surface;

  const body = (
    <View
      style={[
        styles.row,
        stripe !== undefined && styles.rowWithStripe,
        { backgroundColor: background, borderColor: active ? colors.primary : colors.border },
        style,
      ]}>
      {stripe !== undefined && <View style={[styles.stripe, { backgroundColor: stripe }]} />}
      {children}
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.md,
    paddingVertical: Space.md,
    // Durum şeridinin köşeleri karta göre kırpılsın
    overflow: 'hidden',
  },
  // Şerit varken sol dolgu şeridin payını da içerir
  rowWithStripe: {
    paddingLeft: Space.md + 4,
  },
  stripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
});
