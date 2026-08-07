import { ReactNode, ReactElement } from 'react';
import { ScrollView, View, StyleSheet, RefreshControlProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CONTENT_WIDE_MAX_WIDTH, NARROW_MAX_WIDTH } from '@/constants/layout';
import { Space } from '@/constants/design';
import { useDesign } from '@/hooks/use-design';

export function Screen({
  children,
  scroll = true,
  wide = false,
  refreshControl,
}: {
  children: ReactNode;
  scroll?: boolean;
  wide?: boolean;
  /** Aşağı çekerek yenileme — yalnızca scroll=true iken geçerli */
  refreshControl?: ReactElement<RefreshControlProps>;
}) {
  const { colors } = useDesign();
  // Android SDK 54 kenardan kenara çiziyor: sabit dolguyla kalsaydı listenin
  // sonundaki kart sistem gezinme çubuğunun altında kalırdı.
  const insets = useSafeAreaInsets();
  const maxWidth = wide ? CONTENT_WIDE_MAX_WIDTH : NARROW_MAX_WIDTH;

  if (scroll) {
    // Kaydırma en dışta, tam genişlikte → çubuk ekranın en sağında.
    // İçerik ise maxWidth ile sınırlanıp ortalanıyor.
    return (
      <ScrollView
        style={[styles.root, { backgroundColor: colors.bg }]}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Space.xl + insets.bottom }]}
        refreshControl={refreshControl}>
        <View style={[styles.inner, { maxWidth }]}>{children}</View>
      </ScrollView>
    );
  }

  // scroll=false: FlatList gibi kendi kaydırmasını yöneten içerikler için.
  // Burada maxWidth ile saramıyoruz — FlatList'i sarmak onun kaydırma
  // çubuğunu da o dar kutunun kenarına hapseder. Genişlik/dolgu sınırlamasını
  // çağıran ekran kendi contentContainerStyle'ında uygular (Screen'in
  // scroll=true yolundaki maxWidth mantığıyla aynı prensip); alt güvenli alanı
  // da orada eklemesi gerekir.
  return <View style={[styles.root, { backgroundColor: colors.bg }]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: Space.xl },
  inner: { width: '100%', alignSelf: 'center', gap: Space.md, flex: 1 },
});
