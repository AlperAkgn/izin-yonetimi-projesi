import { useWindowDimensions } from 'react-native';

export function useColumns() {
  const { width } = useWindowDimensions();
  if (width >= 1000) return 3;
  if (width >= 640) return 2;
  return 1;
}

/**
 * Panel'in masaüstü düzenine geçtiği eşik. Yalnızca yönetici/İK panelinde
 * kullanılır; bu eşiğin altında (telefon/tablet) ekran bugünkü haliyle kalır.
 */
export function useWideLayout(): boolean {
  const { width } = useWindowDimensions();
  return width >= 1000;
}