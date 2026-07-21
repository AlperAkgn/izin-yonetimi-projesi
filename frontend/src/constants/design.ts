export const Palette = {
  // Vurgu
  primary: '#2E8FFF',
  primaryPressed: '#1F6FD9',
  primarySoft: 'rgba(46, 143, 255, 0.14)',

  // Karanlık mod (öncelikli)
  dark: {
    bg: '#0E1116',          // en arka plan
    surface: '#171B22',      // kartlar
    surfaceRaised: '#1F242D', // öne çıkan kart / input
    border: '#2A303B',
    text: '#F2F4F7',
    textMuted: '#9AA4B2',
    textFaint: '#5C6672',
  },

  // Açık mod
  light: {
    bg: '#F4F6F9',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    border: '#E3E8EF',
    text: '#0E1116',
    textMuted: '#5C6672',
    textFaint: '#9AA4B2',
  },

  // Durum renkleri (iki modda da aynı)
  success: '#22C55E',
  danger: '#F04438',
  warning: '#F79009',
  canceled: '#6B7280',
};

export const Radius = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
};

export const Space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

// Kartlara "yumuşak" his veren gölge — iOS/Android/web'de farklı çalışır,
// üçünü de tek objede topluyoruz
export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4, // Android
  },
};