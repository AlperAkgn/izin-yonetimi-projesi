import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function ReportsScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle">Raporlar</ThemedText>
      <ThemedText type="small">Burası yakında dolacak.</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
});