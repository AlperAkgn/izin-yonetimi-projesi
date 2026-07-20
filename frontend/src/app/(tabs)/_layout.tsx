import Feather from '@expo/vector-icons/Feather';
import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItemList,
} from '@react-navigation/drawer';
import { router } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Space } from '@/constants/design';
import { useDesign } from '@/hooks/use-design';
import { useAuthStore } from '@/store/authStore';

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { colors } = useDesign();
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <View style={styles.drawerRoot}>
      <DrawerContentScrollView {...props}>
        <View style={[styles.brandBox, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
          <ThemedText style={[styles.brandText, { color: colors.primary }]}>PermitFlow</ThemedText>
          <ThemedText style={[styles.brandSub, { color: colors.textMuted }]}>
            İzin Yönetim Sistemi
          </ThemedText>
        </View>
        <DrawerItemList {...props} />
      </DrawerContentScrollView>

      <Pressable
        onPress={handleLogout}
        style={({ pressed }) => [
          styles.logoutButton,
          {
            borderTopColor: colors.border,
            backgroundColor: pressed ? colors.surfaceRaised : 'transparent',
          },
        ]}>
        <Feather name="log-out" size={20} color={colors.danger} />
        <ThemedText style={[styles.logoutText, { color: colors.danger }]}>Çıkış Yap</ThemedText>
      </Pressable>
    </View>
  );
}

export default function DrawerLayout() {
  const { colors } = useDesign();
  const user = useAuthStore((s) => s.user);
  const canSeeReports = user?.role === 'HR' || user?.role === 'ADMIN';

  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        drawerStyle: { backgroundColor: colors.surface, width: 280 },
        drawerActiveTintColor: colors.primary,
        drawerInactiveTintColor: colors.textMuted,
        drawerActiveBackgroundColor: colors.primarySoft,
        drawerLabelStyle: { fontSize: 15 },
      }}>
      <Drawer.Screen
        name="index"
        options={{
          title: 'Panel',
          drawerIcon: ({ color, size }) => <Feather name="home" size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="leave-requests"
        options={{
          title: 'İzinlerim',
          drawerIcon: ({ color, size }) => <Feather name="calendar" size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="messages"
        options={{
          title: 'Mesajlar',
          drawerIcon: ({ color, size }) => (
            <Feather name="message-circle" size={size} color={color} />
          ),
          headerRight: () => (
            <Pressable onPress={() => router.push('/new-chat')} style={{ marginRight: 16 }}>
              <Feather name="edit" size={20} color={colors.text} />
            </Pressable>
          ),
        }}
      />
      <Drawer.Screen
        name="branches"
        options={{
          title: 'Şubeler',
          drawerIcon: ({ color, size }) => <Feather name="map-pin" size={size} color={color} />,
          drawerItemStyle: user?.role === 'ADMIN' ? undefined : { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="reports"
        options={{
          title: 'Raporlar',
          drawerIcon: ({ color, size }) => (
            <Feather name="bar-chart-2" size={size} color={color} />
          ),
          drawerItemStyle: canSeeReports ? undefined : { display: 'none' },
        }}
      />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  drawerRoot: {
    flex: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    borderTopWidth: 1,
    paddingHorizontal: Space.xl,
    paddingVertical: Space.lg,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
  },
  brandBox: {
    marginHorizontal: Space.md,
    marginBottom: Space.md,
    padding: Space.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: 2,
  },
  brandText: {
    fontSize: 20,
    fontWeight: '700',
  },
  brandSub: {
    fontSize: 12,
  },
});