import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { loginRequest } from '@/services/auth';
import { useAuthStore } from '@/store/authStore';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const theme = useTheme();

  const handleLogin = async () => {
    if (!EMAIL_REGEX.test(email)) {
      setError('Geçerli bir e-posta adresi gir');
      return;
    }
    if (password.length === 0) {
      setError('Şifre boş olamaz');
      return;
    }

    setError('');
    setLoading(true);
    const result = await loginRequest(email, password);
    setLoading(false);

    if (!result.success) {
      setError(result.message);
      return;
    }
    login(result.user, result.token);
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">PermitFlow</ThemedText>
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.text }]}
        placeholder="E-posta"
        placeholderTextColor={theme.textSecondary ?? '#888'}
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.text }]}
        placeholder="Şifre"
        placeholderTextColor={theme.textSecondary ?? '#888'}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error !== '' && <ThemedText style={styles.error}>{error}</ThemedText>}
      <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.buttonText}>Giriş Yap</ThemedText>}
      </Pressable>
      <ThemedText type="small" style={styles.hint}>
        Test için: test@permitflow.com / 123456
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#208AEF', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
  error: { color: '#e11d48' },
  hint: { textAlign: 'center', opacity: 0.5, marginTop: 4 },
});