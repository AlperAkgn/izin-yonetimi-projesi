import { Palette } from '@/constants/design';
import { useColorScheme } from 'react-native';

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
      danger: Palette.danger,
      warning: Palette.warning,
    },
  };
}