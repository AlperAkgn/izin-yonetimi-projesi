import { useWindowDimensions } from 'react-native';

import { WIDE_MIN_WIDTH } from '@/constants/layout';

export function useColumns() {
  const { width } = useWindowDimensions();
  if (width >= WIDE_MIN_WIDTH) return 3;
  if (width >= 640) return 2;
  return 1;
}

/**
 * Ekranın masaüstü düzenine geçtiği eşik. Yalnızca yönetici/İK ekranlarında
 * kullanılır; bu eşiğin altında (telefon/tablet) ekran bugünkü haliyle kalır.
 */
export function useWideLayout(): boolean {
  const { width } = useWindowDimensions();
  return width >= WIDE_MIN_WIDTH;
}
