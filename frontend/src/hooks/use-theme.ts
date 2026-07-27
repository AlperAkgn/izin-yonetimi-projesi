import { useDesign } from '@/hooks/use-design';

import type { ThemeColor } from '@/constants/theme';

/**
 * ThemedText/ThemedView'in anlamsal renk adlarını tek palete (constants/design.ts) bağlar.
 *
 * Eskiden burası constants/theme.ts'deki ayrı bir `Colors` tablosunu okuyordu.
 * İki tablo hem farklı değerler hem de farklı varsayılan mod kullanıyordu
 * (useDesign belirsizde karanlık, burası aydınlık) — sonuç koyu zeminde siyah
 * yazıydı. Artık tek kaynak var.
 */
export function useTheme(): Record<ThemeColor, string> {
  const { colors } = useDesign();

  return {
    text: colors.text,
    textSecondary: colors.textMuted,
    background: colors.bg,
    backgroundElement: colors.surfaceRaised,
    backgroundSelected: colors.border,
  };
}
