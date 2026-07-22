import { ReactNode } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { useDesign } from '@/hooks/use-design';
import { Space } from '@/constants/design';

export function Screen({
  children,
  scroll = true,
  wide = false,
}: {
  children: ReactNode;
  scroll?: boolean;
  wide?: boolean;
}) {
  const { colors } = useDesign();
  const maxWidth = wide ? 1200 : 480;

  if (scroll) {
    // Kaydırma en dışta, tam genişlikte → çubuk ekranın en sağında.
    // İçerik ise maxWidth ile sınırlanıp ortalanıyor.
    return (
      <ScrollView
        style={[styles.root, { backgroundColor: colors.bg }]}
        contentContainerStyle={styles.scrollContent}>
        <View style={[styles.inner, { maxWidth }]}>{children}</View>
      </ScrollView>
    );
  }

  // scroll=false: FlatList gibi kendi kaydırmasını yöneten içerikler için
  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.inner, styles.innerPadding, { maxWidth }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: Space.xl },
  inner: { width: '100%', alignSelf: 'center', gap: Space.md, flex: 1 },
  innerPadding: { padding: Space.xl },
});