import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Space } from '@/constants/design';
import { useDesign } from '@/hooks/use-design';
import { useAuthStore } from '@/store/authStore';

export default function ChangePasswordScreen() {
  const { colors } = useDesign();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const completeFirstLogin = useAuthStore((s) => s.completeFirstLogin);

  const handleSubmit = () => {
    if (newPassword.length < 6) {
      setError('Şifre en az 6 karakter olmalı');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Şifreler eşleşmiyor');
      return;
    }
    setError('');
    console.log('Yeni şifre kaydedildi:', newPassword);
    completeFirstLogin();
    router.replace('/');
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View style={styles.card}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Yeni Şifre Belirle
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.textMuted }]}>
            İlk girişte güvenliğin için şifreni değiştirmen gerekiyor
          </ThemedText>
        </View>

        <Card>
          <Input
            placeholder="Yeni şifre"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <Input
            placeholder="Yeni şifre (tekrar)"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          {error !== '' && (
            <ThemedText style={[styles.error, { color: colors.danger }]}>{error}</ThemedText>
          )}

          <Button label="Şifreyi Kaydet" onPress={handleSubmit} />
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Space.xl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    gap: Space.md,
  },
  header: {
    alignItems: 'center',
    marginBottom: Space.lg,
    gap: Space.xs,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 14,
  },
  error: {
    fontSize: 13,
  },
});