import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  // Hidrasyondan önceki değer uygulamanın varsayılanıyla aynı olmalı: karanlık
  // (bkz. use-design.ts "belirsizse karanlık"). Burada 'light' dönmek, koyu
  // zemin çizilirken yazının bir kare siyah kalmasına yol açıyordu.
  return 'dark';
}
