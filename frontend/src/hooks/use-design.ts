import { Palette } from '@/constants/design';
// react-native yerine bu sarmalayıcı: web'de hidrasyon öncesi/sonrası aynı
// değeri verip ThemedText ile aynı kaynaktan okumamızı sağlıyor.
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useDesign() {
  const scheme = useColorScheme();
  const isDark = scheme !== 'light'; // karanlık öncelikli: belirsizse karanlık
  const c = isDark ? Palette.dark : Palette.light;

  return {
    isDark,
    colors: {
      ...c,
      primary: Palette.primary,
      primaryPressed: Palette.primaryPressed,
      primarySoft: Palette.primarySoft,
      success: Palette.success,
      successPressed: Palette.successPressed,
      danger: Palette.danger,
      dangerPressed: Palette.dangerPressed,
      warning: Palette.warning,
      canceled: Palette.canceled,
    },
  };
}