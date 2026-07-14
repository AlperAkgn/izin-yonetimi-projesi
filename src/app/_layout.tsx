import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Redirect, Stack } from 'expo-router';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { useAuthStore } from '@/store/authStore';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const user = useAuthStore((s) => s.user);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      {!user && <Redirect href="/login" />}
      {user?.isFirstLogin && <Redirect href="/change-password" />}
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}