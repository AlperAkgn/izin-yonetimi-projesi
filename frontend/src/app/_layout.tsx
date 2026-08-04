import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ToastHost } from '@/components/ui/toast-host';
import { useAuthStore } from '@/store/authStore';
import { useMessagesStore } from '@/store/messagesStore';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const user = useAuthStore((s) => s.user);

  // Oturum açılınca mesajlaşma WebSocket'i bağlanır, kapanınca koparılır
  useEffect(() => {
    const messages = useMessagesStore.getState();
    if (user) messages.connect();
    return () => useMessagesStore.getState().disconnect();
  }, [user?.id]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        {!user && <Redirect href="/login" />}
        {user?.isFirstLogin && <Redirect href="/change-password" />}
        <Stack screenOptions={{ headerShown: false }} />
        <ToastHost />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
