import { useMemo, useState } from 'react';
import { ScrollView, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LabeledInput } from '@/components/ui/labeled-input';
import { useDesign } from '@/hooks/use-design';
import { Radius, Space } from '@/constants/design';
import { showConfirm } from '@/utils/alert';
import { normalizePhone } from '@/utils/phone';
import { useBranchesStore } from '@/store/branchesStore';
import { useUsersStore, getBranchUsers, AppUser, UserRole } from '@/store/usersStore';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^0(5\d{9}|[2-4]\d{9})$/;
function isValidPhone(p: string) {
  return PHONE_REGEX.test(p.replace(/\D/g, ''));
}
const ROLE_LABEL: Record<UserRole, string> = { EMPLOYEE: 'Personel', HR: 'İnsan Kaynakları' };

// ---- Personel oluşturma formu ----
function CreateStaffForm({ branchId, onDone }: { branchId: string; onDone: () => void }) {
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
      branchId,
    });
    if (!result.ok) return setError(result.message ?? 'Eklenemedi');
    onDone();
  };

  return (
    <Card>
      <ThemedText style={styles.formTitle}>Yeni Personel</ThemedText>
      <LabeledInput label="İsim" placeholder="Örn: Ahmet" maxLength={30} value={firstName} onChangeText={setFirstName} />
      <LabeledInput label="Soyisim" placeholder="Örn: Kaya" maxLength={30} value={lastName} onChangeText={setLastName} />
      <LabeledInput label="E-posta" placeholder="Örn: ahmet@sirket.com" maxLength={60} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <LabeledInput label="Telefon" placeholder="Örn: 05XX XXX XX XX" maxLength={15} keyboardType="phone-pad" value={phone} onChangeText={setPhone} onBlur={() => setPhone(normalizePhone(phone))} />

      <ThemedText style={[styles.roleLabel, { color: colors.textMuted }]}>Rol</ThemedText>
      <View style={styles.roleRow}>
        {(['EMPLOYEE', 'HR'] as UserRole[]).map((r) => {
          const active = role === r;
          return (
            <Pressable
              key={r}
              onPress={() => setRole(r)}
              style={[styles.roleChip, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : 'transparent' }]}>
              <ThemedText style={{ color: active ? '#fff' : colors.text, fontWeight: active ? '600' : '400' }}>
                {ROLE_LABEL[r]}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {error !== '' && <ThemedText style={{ color: colors.danger, fontSize: 13 }}>{error}</ThemedText>}
      <Button label="Personeli Oluştur" onPress={handleSave} />
      <Button label="Vazgeç" onPress={onDone} variant="ghost" />
    </Card>
  );
}

// ---- Taşıma formu ----
function MoveStaffForm({ user, currentBranchId, onDone }: { user: AppUser; currentBranchId: string; onDone: () => void }) {
  const { colors } = useDesign();
  const branches = useBranchesStore((s) => s.branches);
  const deletedBranches = useBranchesStore((s) => s.deletedAt);
  const moveToBranch = useUsersStore((s) => s.moveToBranch);

  // Silinmemiş ve mevcut olmayan şubeler
  const targets = branches.filter((b) => b.id !== currentBranchId && !(b.id in deletedBranches));

  return (
    <Card>
      <ThemedText style={styles.formTitle}>
        {user.firstName} {user.lastName} — Şube Taşı
      </ThemedText>
      {targets.length === 0 ? (
        <ThemedText style={[styles.empty, { color: colors.textMuted }]}>
          Taşınabilecek başka şube yok
        </ThemedText>
      ) : (
        targets.map((b) => (
          <Pressable
            key={b.id}
            onPress={() => {
              moveToBranch(user.id, b.id);
              onDone();
            }}
            style={({ pressed }) => [styles.pickRow, { borderColor: colors.border, backgroundColor: pressed ? colors.surfaceRaised : 'transparent' }]}>
            <View style={styles.pickBody}>
              <ThemedText style={styles.pickName}>{b.name}</ThemedText>
              <ThemedText style={[styles.pickDetail, { color: colors.textMuted }]}>📍 {b.city}</ThemedText>
            </View>
            <Feather name="arrow-right-circle" size={20} color={colors.primary} />
          </Pressable>
        ))
      )}
      <Button label="Vazgeç" onPress={onDone} variant="ghost" />
    </Card>
  );
}

// ---- Personel satırı ----
function PersonRow({ user, onMove, onDelete }: { user: AppUser; onMove: () => void; onDelete: () => void }) {
  const { colors } = useDesign();
  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();
  return (
    <Card>
      <View style={styles.personRow}>
        <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
          <ThemedText style={[styles.avatarText, { color: colors.primary }]}>{initials}</ThemedText>
        </View>
        <View style={styles.personBody}>
          <ThemedText style={styles.personName}>{user.firstName} {user.lastName}</ThemedText>
          <ThemedText style={[styles.personDetail, { color: colors.textMuted }]} numberOfLines={1}>
            {user.email}
          </ThemedText>
        </View>
        <Pressable onPress={onMove} style={styles.iconBtn}>
          <Feather name="repeat" size={18} color={colors.textMuted} />
        </Pressable>
        <Pressable onPress={onDelete} style={styles.iconBtn}>
          <Feather name="trash-2" size={18} color={colors.danger} />
        </Pressable>
      </View>
    </Card>
  );
}

// ---- Ana ekran ----
type Mode = 'view' | 'create' | { moveUser: AppUser };

export default function BranchDetailScreen() {
  const { colors } = useDesign();
  const { id } = useLocalSearchParams<{ id: string }>();
  const branches = useBranchesStore((s) => s.branches);
  const users = useUsersStore((s) => s.users);
  const usersDeletedAt = useUsersStore((s) => s.deletedAt);
  const deleteUser = useUsersStore((s) => s.deleteUser);

  const [mode, setMode] = useState<Mode>('view');

  const branch = branches.find((b) => b.id === id);
  const branchUsers = getBranchUsers(users, usersDeletedAt, id);
  const hrUsers = branchUsers.filter((u) => u.role === 'HR');
  const employeeUsers = branchUsers.filter((u) => u.role === 'EMPLOYEE');

  const handleDelete = (user: AppUser) => {
    showConfirm(
      'Personeli Sil',
      `${user.firstName} ${user.lastName} silinecek. 24 saat boyunca "Silinenler" bölümünden geri alınabilir. Emin misin?`,
      'Sil',
      () => deleteUser(user.id)
    );
  };

  const header = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: branch?.name ?? 'Şube',
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
      }}
    />
  );

  if (mode === 'create') {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        {header}
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.contentWrap}>
            <CreateStaffForm branchId={id} onDone={() => setMode('view')} />
          </View>
        </ScrollView>
      </View>
    );
  }

  if (typeof mode === 'object') {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        {header}
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.contentWrap}>
            <MoveStaffForm user={mode.moveUser} currentBranchId={id} onDone={() => setMode('view')} />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {header}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentWrap}>
          {branch && (
            <View style={[styles.infoPill, { backgroundColor: colors.primarySoft }]}>
              <ThemedText style={[styles.infoText, { color: colors.primary }]}>
                Yıllık izin hakkı: {branch.defaultLeaveDays} gün · {branch.email}
              </ThemedText>
            </View>
          )}

          <Button label="+ Yeni Personel Oluştur" onPress={() => setMode('create')} />

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>İnsan Kaynakları ({hrUsers.length})</ThemedText>
            {hrUsers.length === 0 ? (
              <ThemedText style={[styles.empty, { color: colors.textMuted }]}>Bu kategoride kimse yok</ThemedText>
            ) : (
              hrUsers.map((u) => (
                <PersonRow key={u.id} user={u} onMove={() => setMode({ moveUser: u })} onDelete={() => handleDelete(u)} />
              ))
            )}
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Personel ({employeeUsers.length})</ThemedText>
            {employeeUsers.length === 0 ? (
              <ThemedText style={[styles.empty, { color: colors.textMuted }]}>Bu kategoride kimse yok</ThemedText>
            ) : (
              employeeUsers.map((u) => (
                <PersonRow key={u.id} user={u} onMove={() => setMode({ moveUser: u })} onDelete={() => handleDelete(u)} />
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: Space.xl },
  contentWrap: { maxWidth: 900, width: '100%', alignSelf: 'center', gap: Space.md },
  infoPill: { borderRadius: Radius.md, paddingHorizontal: Space.lg, paddingVertical: Space.md },
  infoText: { fontSize: 13, fontWeight: '600' },
  section: { gap: Space.sm, marginTop: Space.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: Space.xs },
  empty: { fontSize: 13, fontStyle: 'italic' },
  formTitle: { fontSize: 17, fontWeight: '700', marginBottom: Space.xs },
  roleLabel: { fontSize: 13, fontWeight: '600', marginTop: Space.xs },
  roleRow: { flexDirection: 'row', gap: Space.sm },
  roleChip: { flex: 1, borderWidth: 1, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center' },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md, borderWidth: 1, borderRadius: Radius.md, padding: Space.md, marginBottom: Space.sm },
  pickBody: { flex: 1, gap: 2 },
  pickName: { fontSize: 14, fontWeight: '600' },
  pickDetail: { fontSize: 12 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  avatar: { width: 44, height: 44, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '700', fontSize: 15 },
  personBody: { flex: 1, gap: 2, marginLeft: Space.xs },
  personName: { fontSize: 15, fontWeight: '600' },
  personDetail: { fontSize: 12 },
  iconBtn: { padding: Space.sm },
});