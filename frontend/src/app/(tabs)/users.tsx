import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { normalizePhone } from '@/utils/phone';
import { useColumns } from '@/hooks/use-columns';
import { ScrollView,TextInput} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui/screen';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LabeledInput } from '@/components/ui/labeled-input';
import { useDesign } from '@/hooks/use-design';
import { Radius, Space } from '@/constants/design';
import { showAlert } from '@/utils/alert';
import { useUsersStore, UserRole, AppUser } from '@/store/usersStore';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(\+90|0)?5\d{9}$/;

function isValidPhone(p: string) {
  return PHONE_REGEX.test(p.replace(/[\s()-]/g, ''));
}

const ROLE_LABEL: Record<UserRole, string> = {
  EMPLOYEE: 'Personel',
  HR: 'İnsan Kaynakları',
};

// ---- Oluşturma formu ----
function CreateUserForm({ onDone }: { onDone: () => void }) {
  const { colors } = useDesign();
  const addUser = useUsersStore((s) => s.addUser);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('EMPLOYEE');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (firstName.trim().length === 0) return setError('İsim boş olamaz');
    if (lastName.trim().length === 0) return setError('Soyisim boş olamaz');
    if (!EMAIL_REGEX.test(email)) return setError('Geçerli bir e-posta gir');
    if (!isValidPhone(phone)) return setError('Geçerli bir telefon numarası gir');
    setError('');

    const result = addUser({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      role,
    });

    if (!result.ok) {
      setError(result.message ?? 'Kullanıcı eklenemedi');
      return;
    }
    showAlert('Kullanıcı Oluşturuldu', `${firstName} ${lastName} eklendi. Geçici şifre e-posta ile gönderilecek.`);
    onDone();
  };

  return (
    <Card>
      <ThemedText style={styles.formTitle}>Yeni Kullanıcı</ThemedText>
      <LabeledInput label="İsim" placeholder="Örn: Ahmet" maxLength={30} value={firstName} onChangeText={setFirstName} />
      <LabeledInput label="Soyisim" placeholder="Örn: Kaya" maxLength={30} value={lastName} onChangeText={setLastName} />
      <LabeledInput label="E-posta" placeholder="Örn: ahmet.kaya@sirket.com" maxLength={60} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <LabeledInput
        label="Telefon"
        placeholder="Örn: 05XX XXX XX XX"
        maxLength={15}
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
        onBlur={() => setPhone(normalizePhone(phone))}
      />

      <ThemedText style={[styles.roleLabel, { color: colors.textMuted }]}>Rol</ThemedText>
      <View style={styles.roleRow}>
        {(['EMPLOYEE', 'HR'] as UserRole[]).map((r) => {
          const active = role === r;
          return (
            <Pressable
              key={r}
              onPress={() => setRole(r)}
              style={[
                styles.roleChip,
                { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : 'transparent' },
              ]}>
              <ThemedText style={{ color: active ? '#fff' : colors.text, fontWeight: active ? '600' : '400' }}>
                {ROLE_LABEL[r]}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {error !== '' && <ThemedText style={{ color: colors.danger, fontSize: 13 }}>{error}</ThemedText>}
      <Button label="Kullanıcıyı Oluştur" onPress={handleSave} />
      <Button label="Vazgeç" onPress={onDone} variant="ghost" />
    </Card>
  );
}

// ---- Kullanıcı satırı ----
function UserRow({ user }: { user: AppUser }) {
  const { colors } = useDesign();
  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();
  return (
    <Card>
      <View style={styles.userCard}>
        <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
          <ThemedText style={[styles.avatarText, { color: colors.primary }]}>{initials}</ThemedText>
        </View>
        <ThemedText style={styles.userName} numberOfLines={1}>
          {user.firstName} {user.lastName}
        </ThemedText>
        <ThemedText style={[styles.userDetail, { color: colors.textMuted }]} numberOfLines={1}>
          {user.email}
        </ThemedText>
        <ThemedText style={[styles.userDetail, { color: colors.textMuted }]} numberOfLines={1}>
          {user.phone}
        </ThemedText>
        <View style={styles.userTags}>
          <View style={[styles.tag, { backgroundColor: colors.primarySoft }]}>
            <ThemedText style={[styles.tagText, { color: colors.primary }]}>
              {ROLE_LABEL[user.role]}
            </ThemedText>
          </View>
          <View
            style={[
              styles.tag,
              user.branchId
                ? { backgroundColor: colors.primarySoft }
                : { borderColor: colors.border, borderWidth: 1 },
            ]}>
            <ThemedText style={[styles.tagText, { color: user.branchId ? colors.primary : colors.textMuted }]}>
              {user.branchId ? 'Atanmış' : 'Atanmamış'}
            </ThemedText>
          </View>
        </View>
      </View>
    </Card>
  );
}

// ---- Ana ekran ----
export default function UsersScreen() {
  const { colors } = useDesign();
  const users = useUsersStore((s) => s.users);
  const [creating, setCreating] = useState(false);
  const columns = useColumns();

  if (creating) {
    return (
      <Screen>
        <CreateUserForm onDone={() => setCreating(false)} />
      </Screen>
    );
  }

  return (
    <View style={[styles.screenRoot, { backgroundColor: colors.bg }]}>
      <ScrollView style={styles.flatList} contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentWrap}>
          <Button label="+ Yeni Kullanıcı Oluştur" onPress={() => setCreating(true)} />

          <View style={styles.grid}>
            {users.map((item) => (
              <View key={item.id} style={[styles.gridItem, { width: `${100 / columns}%` }]}>
                <UserRow user={item} />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1 },
  flatList: { flex: 1, width: '100%' },
  scrollContent: { padding: Space.xl },
  contentWrap: { maxWidth: 1200, width: '100%', alignSelf: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: Space.md },
  gridItem: { padding: Space.sm },
  listHeader: { marginBottom: Space.sm },
  formTitle: { fontSize: 17, fontWeight: '700', marginBottom: Space.xs },
  roleLabel: { fontSize: 13, fontWeight: '600', marginTop: Space.xs },
  roleRow: { flexDirection: 'row', gap: Space.sm },
  roleChip: { flex: 1, borderWidth: 1, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center' },
  userCard: { alignItems: 'center', gap: 4 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space.xs,
  },
  avatarText: { fontWeight: '700', fontSize: 17 },
  userName: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  userDetail: { fontSize: 12, textAlign: 'center' },
  userTags: { flexDirection: 'row', gap: Space.sm, marginTop: Space.sm, flexWrap: 'wrap', justifyContent: 'center' },
  tag: { borderRadius: Radius.pill, paddingHorizontal: Space.md, paddingVertical: 4 },
  tagText: { fontSize: 11, fontWeight: '600' },
  columnWrapper: { gap: Space.md },
  list: {
    padding: Space.xl,
    gap: Space.md,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: Space.xl,
  },
});