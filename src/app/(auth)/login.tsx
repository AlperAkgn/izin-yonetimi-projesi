import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Space } from '@/constants/design';
import { useDesign } from '@/hooks/use-design';
import { loginRequest } from '@/services/auth';
import { useAuthStore } from '@/store/authStore';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const { colors } = useDesign();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);

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
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View style={styles.card}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.brand}>
            PermitFlow
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.textMuted }]}>
            Kurumsal izin yönetim sistemi
          </ThemedText>
        </View>

        <Card>
          <Input
            placeholder="E-posta"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            placeholder="Şifre"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error !== '' && (
            <ThemedText style={[styles.error, { color: colors.danger }]}>{error}</ThemedText>
          )}

          <Button label="Giriş Yap" onPress={handleLogin} loading={loading} />
        </Card>

        <ThemedText style={[styles.hint, { color: colors.textFaint }]}>
          Test: test@permitflow.com / 123456
        </ThemedText>
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
  brand: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 14,
  },
  error: {
    fontSize: 13,
  },
  hint: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: Space.xl,
  },
});