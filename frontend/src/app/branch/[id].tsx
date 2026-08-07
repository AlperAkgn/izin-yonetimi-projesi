import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, Stack, useFocusEffect } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { BackButton } from '@/components/ui/back-button';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LabeledInput } from '@/components/ui/labeled-input';
import { useDesign } from '@/hooks/use-design';
import { Radius, Space } from '@/constants/design';
import { showConfirm } from '@/utils/alert';
import { normalizePhone } from '@/utils/phone';
import { showToast } from '@/store/toastStore';
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
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (firstName.trim().length === 0) return setError('İsim boş olamaz');
    if (lastName.trim().length === 0) return setError('Soyisim boş olamaz');
    if (!EMAIL_REGEX.test(email)) return setError('Geçerli bir e-posta gir');
    if (!isValidPhone(phone)) return setError('Geçerli bir telefon numarası gir');
    setError('');

    setSaving(true);
    const result = await addUser(branchId, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      role,
    });
    setSaving(false);

    if (!result.ok) return setError(result.message ?? 'Eklenemedi');

    // Şifre backend'de üretilir ve kullanıcıya e-postayla gider
    showToast({
      message: `${firstName.trim()} için hesap oluşturuldu — geçici şifre e-postayla gönderildi.`,
      tone: 'success',
    });
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

      <ThemedText style={[styles.hint, { color: colors.textFaint }]}>
        Şifre sorulmaz — sistem geçici şifre üretip personelin e-postasına gönderir, ilk girişte değiştirtilir.
      </ThemedText>

      {error !== '' && <ThemedText style={{ color: colors.danger, fontSize: 13 }}>{error}</ThemedText>}
      <Button label="Personeli Oluştur" onPress={handleSave} loading={saving} />
      <Button label="Vazgeç" onPress={onDone} variant="ghost" />
    </Card>
  );
}

// ---- Bilgi düzeltme formu ----
/**
 * Yanlış girilmiş ad/soyad/telefon buradan düzeltilir. Değişiklik User
 * kaydına yazıldığı için kişinin kendi panelindeki selamlama da güncellenir.
 *
 * E-posta salt okunur: hesabı tekil kılan alan o — giriş, geçici şifre
 * postası ve mevcut kayıtlar o adrese bağlı.
 */
function EditStaffForm({
  user,
  branchId,
  onDone,
}: {
  user: AppUser;
  branchId: string;
  onDone: () => void;
}) {
  const { colors } = useDesign();
  const updateUser = useUsersStore((s) => s.updateUser);
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [phone, setPhone] = useState(user.phone);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (firstName.trim().length === 0) return setError('İsim boş olamaz');
    if (lastName.trim().length === 0) return setError('Soyisim boş olamaz');
    if (!isValidPhone(phone)) return setError('Geçerli bir telefon numarası gir');
    setError('');

    setSaving(true);
    const result = await updateUser(branchId, user.id, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
    });
    setSaving(false);

    if (!result.ok) return setError(result.message ?? 'Güncellenemedi');

    showToast({
      message: `${firstName.trim()} ${lastName.trim()} bilgileri güncellendi.`,
      tone: 'success',
    });
    onDone();
  };

  return (
    <Card>
      <ThemedText style={styles.formTitle}>Bilgileri Düzenle</ThemedText>
      <LabeledInput label="İsim" maxLength={30} value={firstName} onChangeText={setFirstName} />
      <LabeledInput label="Soyisim" maxLength={30} value={lastName} onChangeText={setLastName} />
      <LabeledInput
        label="Telefon"
        placeholder="Örn: 05XX XXX XX XX"
        maxLength={15}
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
        onBlur={() => setPhone(normalizePhone(phone))}
      />

      <ThemedText style={[styles.roleLabel, { color: colors.textMuted }]}>E-posta</ThemedText>
      <View
        style={[
          styles.readonlyBox,
          { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
        ]}>
        <Feather name="lock" size={14} color={colors.textFaint} />
        <ThemedText style={[styles.readonlyText, { color: colors.textMuted }]} numberOfLines={1}>
          {user.email}
        </ThemedText>
      </View>
      <ThemedText style={[styles.hint, { color: colors.textFaint }]}>
        E-posta hesabı tekil kılan alandır, değiştirilemez. Kişi başka bir adres kullanacaksa yeni
        hesap açılmalı.
      </ThemedText>

      {error !== '' && <ThemedText style={{ color: colors.danger, fontSize: 13 }}>{error}</ThemedText>}
      <Button label="Kaydet" onPress={handleSave} loading={saving} />
      <Button label="Vazgeç" onPress={onDone} variant="ghost" />
    </Card>
  );
}

// ---- Taşıma formu ----
function MoveStaffForm({ user, currentBranchId, onDone }: { user: AppUser; currentBranchId: string; onDone: () => void }) {
  const { colors } = useDesign();
  const branches = useBranchesStore((s) => s.branches);
  const moveToBranch = useUsersStore((s) => s.moveToBranch);
  const [moving, setMoving] = useState(false);

  const targets = branches.filter((b) => b.id !== currentBranchId);

  const handleMove = async (targetBranchId: string) => {
    if (moving) return;
    setMoving(true);
    const result = await moveToBranch(user.id, currentBranchId, targetBranchId);
    setMoving(false);

    if (!result.ok) {
      showToast({ message: result.message ?? 'Personel taşınamadı.', tone: 'danger' });
      return;
    }
    showToast({ message: `${user.firstName} ${user.lastName} taşındı.`, tone: 'success' });
    onDone();
  };

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
            onPress={() => void handleMove(b.id)}
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
function PersonRow({
  user,
  onEdit,
  onMove,
  onDelete,
}: {
  user: AppUser;
  onEdit: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  const { colors } = useDesign();
  const fullName = `${user.firstName} ${user.lastName}`;
  return (
    <Card>
      <View style={styles.personRow}>
        <Avatar firstName={user.firstName} lastName={user.lastName} size={44} />
        <View style={styles.personBody}>
          <View style={styles.personNameRow}>
            <ThemedText style={styles.personName}>{user.firstName} {user.lastName}</ThemedText>
            {/* Girişi kapatılmış kullanıcı — silinmiş değil, listede kalır */}
            {!user.isActive && (
              <View style={[styles.inactiveTag, { backgroundColor: colors.surfaceRaised }]}>
                <ThemedText style={[styles.inactiveTagText, { color: colors.textMuted }]}>
                  Pasif
                </ThemedText>
              </View>
            )}
          </View>
          <ThemedText style={[styles.personDetail, { color: colors.textMuted }]} numberOfLines={1}>
            {user.email} · {user.annualLeaveCount} gün izin
          </ThemedText>
        </View>
        <Pressable
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={`${fullName} bilgilerini düzenle`}
          style={styles.iconBtn}>
          <Feather name="edit-2" size={18} color={colors.textMuted} />
        </Pressable>
        <Pressable
          onPress={onMove}
          accessibilityRole="button"
          accessibilityLabel={`${fullName} kişisini başka şubeye taşı`}
          style={styles.iconBtn}>
          <Feather name="repeat" size={18} color={colors.textMuted} />
        </Pressable>
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={`${fullName} kişisini sil`}
          style={styles.iconBtn}>
          <Feather name="trash-2" size={18} color={colors.danger} />
        </Pressable>
      </View>
    </Card>
  );
}

// ---- Ana ekran ----
type Mode =
  | { kind: 'view' }
  | { kind: 'create' }
  | { kind: 'edit'; user: AppUser }
  | { kind: 'move'; user: AppUser };

const VIEW_MODE: Mode = { kind: 'view' };

export default function BranchDetailScreen() {
  const { colors } = useDesign();
  const { id } = useLocalSearchParams<{ id: string }>();
  const branches = useBranchesStore((s) => s.branches);
  const fetchAllBranches = useBranchesStore((s) => s.fetchAll);
  const byBranch = useUsersStore((s) => s.byBranch);
  const loading = useUsersStore((s) => s.loading);
  const usersError = useUsersStore((s) => s.error);
  const fetchBranch = useUsersStore((s) => s.fetchBranch);
  const deleteUser = useUsersStore((s) => s.deleteUser);

  const [mode, setMode] = useState<Mode>(VIEW_MODE);

  // Doğrudan URL ile gelinirse şube listesi henüz yüklenmemiş olabilir
  useEffect(() => {
    void fetchAllBranches();
  }, [fetchAllBranches]);

  // Silinenler'den geri alma sonrası dönüşte liste güncel olsun
  useFocusEffect(
    useCallback(() => {
      void fetchBranch(id);
    }, [id, fetchBranch]),
  );

  const branch = branches.find((b) => b.id === id);
  const branchUsers = getBranchUsers(byBranch, id);
  const hrUsers = branchUsers.filter((u) => u.role === 'HR');
  const employeeUsers = branchUsers.filter((u) => u.role === 'EMPLOYEE');

  const handleDelete = (user: AppUser) => {
    showConfirm(
      'Personeli Sil',
      `${user.firstName} ${user.lastName} silinecek: sisteme girişi kapanır, listelerde görünmez. Şubeler ekranındaki "Silinenler" bölümünden istediğin zaman geri alabilirsin. Emin misin?`,
      'Sil',
      () => {
        void deleteUser(user.id, id).then((result) => {
          if (!result.ok) {
            showToast({ message: result.message ?? 'Personel silinemedi.', tone: 'danger' });
          } else {
            showToast({
              message: `${user.firstName} ${user.lastName} silindi — Silinenler'den geri alınabilir.`,
              tone: 'info',
            });
          }
        });
      }
    );
  };

  const header = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: branch?.name ?? 'Şube',
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerLeft: () => <BackButton />,
      }}
    />
  );

  if (mode.kind !== 'view') {
    const closeForm = () => setMode(VIEW_MODE);
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        {header}
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.contentWrap}>
            {mode.kind === 'create' && <CreateStaffForm branchId={id} onDone={closeForm} />}
            {mode.kind === 'edit' && (
              <EditStaffForm user={mode.user} branchId={id} onDone={closeForm} />
            )}
            {mode.kind === 'move' && (
              <MoveStaffForm user={mode.user} currentBranchId={id} onDone={closeForm} />
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {header}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void fetchBranch(id)} />
        }>
        <View style={styles.contentWrap}>
          {branch && (
            <View style={[styles.infoPill, { backgroundColor: colors.primarySoft }]}>
              <ThemedText style={[styles.infoText, { color: colors.primary }]}>
                Yıllık izin hakkı: {branch.defaultLeaveDays} gün · {branch.email}
              </ThemedText>
            </View>
          )}

          {usersError && (
            <ThemedText style={{ color: colors.danger, fontSize: 13 }}>{usersError}</ThemedText>
          )}

          <Button label="+ Yeni Personel Oluştur" onPress={() => setMode({ kind: 'create' })} />

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>İnsan Kaynakları ({hrUsers.length})</ThemedText>
            {hrUsers.length === 0 ? (
              <ThemedText style={[styles.empty, { color: colors.textMuted }]}>Bu kategoride kimse yok</ThemedText>
            ) : (
              hrUsers.map((u) => (
                <PersonRow
                  key={u.id}
                  user={u}
                  onEdit={() => setMode({ kind: 'edit', user: u })}
                  onMove={() => setMode({ kind: 'move', user: u })}
                  onDelete={() => handleDelete(u)}
                />
              ))
            )}
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Personel ({employeeUsers.length})</ThemedText>
            {employeeUsers.length === 0 ? (
              <ThemedText style={[styles.empty, { color: colors.textMuted }]}>Bu kategoride kimse yok</ThemedText>
            ) : (
              employeeUsers.map((u) => (
                <PersonRow
                  key={u.id}
                  user={u}
                  onEdit={() => setMode({ kind: 'edit', user: u })}
                  onMove={() => setMode({ kind: 'move', user: u })}
                  onDelete={() => handleDelete(u)}
                />
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
  hint: { fontSize: 12, lineHeight: 17 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md, borderWidth: 1, borderRadius: Radius.md, padding: Space.md, marginBottom: Space.sm },
  pickBody: { flex: 1, gap: 2 },
  pickName: { fontSize: 14, fontWeight: '600' },
  pickDetail: { fontSize: 12 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  personBody: { flex: 1, gap: 2, marginLeft: Space.xs },
  personNameRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  personName: { fontSize: 15, fontWeight: '600' },
  personDetail: { fontSize: 12 },
  inactiveTag: { paddingHorizontal: Space.sm, paddingVertical: 2, borderRadius: Radius.pill },
  inactiveTagText: { fontSize: 11, fontWeight: '600' },
  iconBtn: { padding: Space.sm },
  // Değiştirilemeyen alan: girdi gibi durur ama kilit ikonuyla salt okunur
  readonlyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: 14,
  },
  readonlyText: { fontSize: 15, flexShrink: 1 },
});
