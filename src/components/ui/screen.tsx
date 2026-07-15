import { Space } from '@/constants/design';
import { useDesign } from '@/hooks/use-design';
import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const { colors } = useDesign();
  const Container = scroll ? ScrollView : View;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <Container
        style={styles.flex}
        contentContainerStyle={scroll ? styles.content : undefined}>
        <View style={styles.inner}>{children}</View>
      </Container>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: Space.xl },
  inner: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: Space.md },
});