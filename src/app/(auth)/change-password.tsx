import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/store/authStore';

export default function ChangePasswordScreen() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const completeFirstLogin = useAuthStore((s) => s.completeFirstLogin);
  const theme = useTheme();

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
    router.replace('/'); // artık elle yönlendiriyoruz, Redirect'e güvenmiyoruz
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Yeni Şifre Belirle</ThemedText>
      <ThemedText type="small">İlk girişte şifreni değiştirmen gerekiyor.</ThemedText>

      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.text }]}
        placeholder="Yeni şifre"
        placeholderTextColor={theme.textSecondary ?? '#888'}
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
      />
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.text }]}
        placeholder="Yeni şifre (tekrar)"
        placeholderTextColor={theme.textSecondary ?? '#888'}
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      {error !== '' && <ThemedText style={styles.error}>{error}</ThemedText>}

      <Pressable style={styles.button} onPress={handleSubmit}>
        <ThemedText style={styles.buttonText}>Şifreyi Kaydet</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  button: {
    backgroundColor: '#208AEF',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  error: { color: '#e11d48' },
});