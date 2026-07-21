import { useWindowDimensions } from 'react-native';

export function useColumns() {
  const { width } = useWindowDimensions();
  if (width >= 1000) return 3;
  if (width >= 640) return 2;
  return 1;
}