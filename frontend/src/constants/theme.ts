/**
 * Tipografi ve font tanımları. RENKLER BURADA DEĞİL — tek palet
 * constants/design.ts içindeki `Palette`, erişim `useDesign()` / `useTheme()`.
 *
 * Burada ayrıca ikinci bir `Colors` tablosu ve `Spacing` ölçeği vardı; ikisi de
 * design.ts'deki karşılıklarıyla çelişiyordu (farklı renkler, farklı varsayılan
 * mod, farklı boşluk adımları) ve kaldırıldı.
 */

import '@/global.css';

import { Platform } from 'react-native';

/** ThemedText/ThemedView'in kabul ettiği anlamsal renk adları */
export type ThemeColor =
  | 'text'
  | 'textSecondary'
  | 'background'
  | 'backgroundElement'
  | 'backgroundSelected';

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});
