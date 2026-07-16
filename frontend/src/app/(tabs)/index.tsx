import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuthStore } from '@/store/authStore';

function EmployeeCards() {
  return (
    <>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="subtitle">Kalan İzin Bakiyem</ThemedText>
        <ThemedText type="title">14 gün</ThemedText>
      </ThemedView>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="subtitle">Bekleyen Talebim</ThemedText>
        <ThemedText type="title">1</ThemedText>
      </ThemedView>
    </>
  );
}

function HRCards() {
  return (
    <>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="subtitle">Şubede Bugün İzinli</ThemedText>
        <ThemedText type="title">3 kişi</ThemedText>
      </ThemedView>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="subtitle">Onay Bekleyen</ThemedText>
        <ThemedText type="title">5</ThemedText>
      </ThemedView>
    </>
  );
}

function AdminCards() {
  return (
    <>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="subtitle">Toplam Şube</ThemedText>
        <ThemedText type="title">4</ThemedText>
      </ThemedView>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="subtitle">Aktif Kullanıcı</ThemedText>
        <ThemedText type="title">42</ThemedText>
      </ThemedView>
    </>
  );
}

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.greeting}>
        Merhaba, {user?.name}
      </ThemedText>
      <ThemedText type="small" style={styles.role}>
        {user?.role}
      </ThemedText>

      <ThemedView style={styles.cardsWrapper}>
        {user?.role === 'EMPLOYEE' && <EmployeeCards />}
        {user?.role === 'HR' && <HRCards />}
        {user?.role === 'ADMIN' && <AdminCards />}
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 8 },
  greeting: { marginTop: 20 },
  role: { marginBottom: 12, opacity: 0.6 },
  cardsWrapper: { gap: 12 },
  card: { padding: 16, borderRadius: 12, gap: 4 },
});