import Feather from '@expo/vector-icons/Feather';
import { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Shadow, Space } from '@/constants/design';
import { useDesign } from '@/hooks/use-design';

/**
 * Panel kartlarının ardındaki listeyi gösteren üst katman.
 *
 * Sayının kendisi zaten kartta duruyor; buradaki iş "2 kişi kim?" sorusunu
 * yanıtlamak. Bu yüzden başlık + kısa açıklama + kaydırılabilir içerik olarak
 * sade tutuldu. Zemine basmak kapatır (web'de dış tıklama beklentisi bu).
 */
export function DetailSheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { colors } = useDesign();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* İçeriğe basınca kapanmasın: zemine giden dokunuşu burada durduruyoruz */}
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderColor: colors.border },
            Shadow.card,
          ]}
          onPress={() => {}}>
          <View style={styles.header}>
            <View style={styles.grow}>
              <ThemedText style={styles.title}>{title}</ThemedText>
              {subtitle !== undefined && (
                <ThemedText style={[styles.subtitle, { color: colors.textMuted }]}>
                  {subtitle}
                </ThemedText>
              )}
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Kapat"
              hitSlop={8}
              style={styles.closeBtn}>
              <Feather name="x" size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Space.xl,
  },
  sheet: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '80%',
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Space.xl,
    gap: Space.md,
  },
  grow: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.md,
  },
  title: { fontSize: 17, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 2 },
  closeBtn: { padding: Space.xs },
  body: { flexGrow: 0 },
  bodyContent: { gap: Space.sm, paddingBottom: Space.xs },
});
