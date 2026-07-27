import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Space } from '@/constants/design';
import { useDesign } from '@/hooks/use-design';

export default function ReportsScreen() {
  const { colors } = useDesign();

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="title">Raporlar</ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.textMuted }]}>
          İzin kullanımı ve onay istatistikleri.
        </ThemedText>
      </View>

      <EmptyState
        icon="bar-chart-2"
        title="Raporlar hazırlanıyor"
        description="İzin türü dağılımı, şube bazlı kullanım ve ortalama onay süresi bu ekranda listelenecek."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: Space.sm,
    gap: Space.xs,
  },
  subtitle: {
    fontSize: 14,
  },
});
