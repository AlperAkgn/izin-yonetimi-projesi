import Feather from '@expo/vector-icons/Feather';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, LinearTransition } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Palette, Radius, Shadow, Space } from '@/constants/design';
import { useDesign } from '@/hooks/use-design';
import { useToastStore } from '@/store/toastStore';

import type { FeatherName } from '@/components/ui/icon';
import type { Toast, ToastTone } from '@/store/toastStore';

function toneMeta(tone: ToastTone): { icon: FeatherName; color: string } {
  switch (tone) {
    case 'success':
      return { icon: 'check-circle', color: Palette.success };
    case 'danger':
      return { icon: 'alert-circle', color: Palette.danger };
    default:
      return { icon: 'info', color: Palette.primary };
  }
}

function ToastRow({ toast }: { toast: Toast }) {
  const { colors } = useDesign();
  const dismiss = useToastStore((s) => s.dismiss);
  const meta = toneMeta(toast.tone);

  return (
    <Animated.View
      entering={FadeInDown.duration(220).springify().damping(18)}
      exiting={FadeOutDown.duration(180)}
      layout={LinearTransition.springify().damping(18)}
      style={[
        styles.toast,
        { backgroundColor: colors.surface, borderColor: colors.border },
        Shadow.card,
      ]}>
      <View style={[styles.iconWrap, { backgroundColor: `${meta.color}18` }]}>
        <Feather name={meta.icon} size={15} color={meta.color} />
      </View>

      <ThemedText style={[styles.message, { color: colors.text }]} numberOfLines={2}>
        {toast.message}
      </ThemedText>

      {toast.action && (
        <Pressable
          onPress={() => {
            toast.action?.onPress();
            dismiss(toast.id);
          }}
          accessibilityRole="button"
          style={styles.actionBtn}>
          <ThemedText style={[styles.actionText, { color: colors.primary }]}>
            {toast.action.label}
          </ThemedText>
        </Pressable>
      )}

      <Pressable
        onPress={() => dismiss(toast.id)}
        accessibilityRole="button"
        accessibilityLabel="Bildirimi kapat"
        hitSlop={8}>
        <Feather name="x" size={15} color={colors.textFaint} />
      </Pressable>
    </Animated.View>
  );
}

/**
 * Ekranın altında biriken bildirimler. Kök layout'a bir kez bağlanır.
 * Not: native'de RN Modal ayrı bir katmanda çizildiği için açık bir modalin
 * üstüne çıkmaz — bu yüzden toast'ları modal kapandıktan sonra tetikliyoruz.
 */
export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <View pointerEvents="box-none" style={styles.host}>
      {toasts.map((toast) => (
        <ToastRow key={toast.id} toast={toast} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: Space.xl,
    // Projede SafeAreaProvider bağlı değil; useSafeAreaInsets çağırmak yerine
    // iOS ana ekran çubuğunu sabit değerle geçiyoruz.
    paddingBottom: Platform.select({ ios: 44, default: Space.xl }),
    gap: Space.sm,
  },
  toast: {
    width: '100%',
    maxWidth: 460,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
  },
  actionBtn: {
    paddingHorizontal: Space.sm,
    paddingVertical: Space.xs,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
