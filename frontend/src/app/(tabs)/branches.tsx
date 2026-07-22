import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { showConfirm } from '@/utils/alert';

import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui/screen';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LabeledInput } from '@/components/ui/labeled-input';
import { useDesign } from '@/hooks/use-design';
import { Radius, Space } from '@/constants/design';
import { normalizePhone } from '@/utils/phone';
import { Branch, DEFAULT_LEAVE_DAYS } from '@/services/branches';
import { useBranchesStore } from '@/store/branchesStore';
import { useUsersStore, getBranchUsers } from '@/store/usersStore';
import { useColumns } from '@/hooks/use-columns';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^0(5\d{9}|[2-4]\d{9})$/;
function isValidPhone(p: string) {
  return PHONE_REGEX.test(p.replace(/\D/g, ''));
}

// ---- Şube formu (ekleme + düzenleme ortak) ----
function BranchForm({ initial, onDone }: { initial?: Branch; onDone: () => void }) {
  const { colors } = useDesign();
  const addBranch = useBranchesStore((s) => s.addBranch);
  const updateBranch = useBranchesStore((s) => s.updateBranch);

  const [name, setName] = useState(initial?.name ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [leaveDays, setLeaveDays] = useState(initial ? String(initial.defaultLeaveDays) : '');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (name.trim().length < 3) return setError('Şube adı en az 3 karakter olmalı');
    if (city.trim().length === 0) return setError('Şehir boş olamaz');
    if (address.trim().length === 0) return setError('Adres boş olamaz');
    if (!isValidPhone(phone)) return setError('Geçerli bir telefon numarası gir');
    if (!EMAIL_REGEX.test(email)) return setError('Geçerli bir şube e-postası gir');
    setError('');

    // İzin günü boş bırakılırsa varsayılan (15)
    const parsed = leaveDays.trim() === '' ? DEFAULT_LEAVE_DAYS : parseInt(leaveDays, 10);
    const days = isNaN(parsed) || parsed < 0 ? DEFAULT_LEAVE_DAYS : parsed;

    const data = {
      name: name.trim(),
      city: city.trim(),
      address: address.trim(),
      phone: phone.trim(),
      email: email.trim(),
      defaultLeaveDays: days,
    };

    if (initial) updateBranch(initial.id, data);
    else addBranch(data);
    onDone();
  };

  return (
    <Card>
      <ThemedText style={styles.formTitle}>{initial ? 'Şubeyi Düzenle' : 'Yeni Şube'}</ThemedText>
      <LabeledInput label="Şube adı" placeholder="Örn: İzmir Şube" maxLength={50} value={name} onChangeText={setName} />
      <LabeledInput label="Şehir" placeholder="Örn: İzmir" maxLength={30} value={city} onChangeText={setCity} />
      <LabeledInput label="Adres" placeholder="Örn: Alsancak Mah. No:12" maxLength={100} value={address} onChangeText={setAddress} />
      <LabeledInput label="Şube telefonu" placeholder="Örn: 0232 000 00 00" maxLength={15} keyboardType="phone-pad" value={phone} onChangeText={setPhone} onBlur={() => setPhone(normalizePhone(phone))} />
      <LabeledInput label="Şube e-postası" placeholder="Örn: izmir@sirket.com" maxLength={60} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <LabeledInput label="Yıllık izin hakkı (gün) — boş bırakılırsa 15" placeholder="15" maxLength={3} keyboardType="number-pad" value={leaveDays} onChangeText={setLeaveDays} />
      {error !== '' && <ThemedText style={{ color: colors.danger, fontSize: 13 }}>{error}</ThemedText>}
      <Button label={initial ? 'Değişiklikleri Kaydet' : 'Şubeyi Kaydet'} onPress={handleSave} />
      <Button label="Vazgeç" onPress={onDone} variant="ghost" />
    </Card>
  );
}

// ---- Şube kartı ----
function BranchCard({ branch, userCount, onEdit, onManage }: {
  branch: Branch;
  userCount: number;
  onEdit: () => void;
  onManage: () => void;
}) {
  const { colors } = useDesign();
  const deleteBranch = useBranchesStore((s) => s.deleteBranch);
  const initial = branch.name.charAt(0).toLocaleUpperCase('tr-TR');

  const handleDelete = () => {
    showConfirm(
      'Şubeyi Sil',
      `"${branch.name}" şubesi silinecek. 24 saat boyunca "Silinenler" bölümünden geri alınabilir; süre dolunca kalıcı olarak temizlenir. Emin misin?`,
      'Devam',
      () => deleteBranch(branch.id)
    );
  };

  return (
    <Card>
      <View style={styles.cardTop}>
        <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
          <ThemedText style={[styles.badgeText, { color: colors.primary }]}>{initial}</ThemedText>
        </View>
        <View style={styles.cardTitleWrap}>
          <ThemedText style={styles.branchName} numberOfLines={1}>{branch.name}</ThemedText>
          <ThemedText style={[styles.branchCity, { color: colors.textMuted }]}>📍 {branch.city}</ThemedText>
        </View>
        <Pressable onPress={onEdit} style={styles.iconBtn}>
          <Feather name="edit-2" size={16} color={colors.textMuted} />
        </Pressable>
        <Pressable onPress={handleDelete} style={styles.iconBtn}>
          <Feather name="trash-2" size={16} color={colors.danger} />
        </Pressable>
      </View>

      <ThemedText style={[styles.branchDetail, { color: colors.textMuted }]} numberOfLines={1}>{branch.address}</ThemedText>
      <ThemedText style={[styles.branchDetail, { color: colors.textMuted }]}>{branch.phone}</ThemedText>

      <View style={styles.pillRow}>
        <View style={[styles.statPill, { backgroundColor: colors.primarySoft }]}>
          <Feather name="users" size={12} color={colors.primary} />
          <ThemedText style={[styles.statPillText, { color: colors.primary }]}>{userCount} kişi</ThemedText>
        </View>
        <View style={[styles.statPill, { backgroundColor: colors.primarySoft }]}>
          <Feather name="calendar" size={12} color={colors.primary} />
          <ThemedText style={[styles.statPillText, { color: colors.primary }]}>{branch.defaultLeaveDays} gün</ThemedText>
        </View>
      </View>

      <Button label="Yönet" onPress={onManage} />
    </Card>
  );
}
// ---- Ana ekran ----
export default function BranchesScreen() {
  const { colors } = useDesign();
  const branches = useBranchesStore((s) => s.branches);
  const branchesDeletedAt = useBranchesStore((s) => s.deletedAt);
  const users = useUsersStore((s) => s.users);
  const usersDeletedAt = useUsersStore((s) => s.deletedAt);
  const columns = useColumns();

  const [mode, setMode] = useState<'list' | 'add' | { edit: Branch }>('list');
  const [search, setSearch] = useState('');

  const active = branches.filter((b) => !(b.id in branchesDeletedAt));

  const q = search.trim().toLocaleLowerCase('tr-TR');
  const filtered = q === '' ? active : active.filter(
    (b) => b.name.toLocaleLowerCase('tr-TR').includes(q) || b.city.toLocaleLowerCase('tr-TR').includes(q)
  );

  if (mode === 'add') {
    return <Screen><BranchForm onDone={() => setMode('list')} /></Screen>;
  }
  if (typeof mode === 'object') {
    return <Screen><BranchForm initial={mode.edit} onDone={() => setMode('list')} /></Screen>;
  }

  return (
    <View style={[styles.screenRoot, { backgroundColor: colors.bg }]}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentWrap}>
          <View style={styles.headerRow}>
            <Button label="+ Yeni Şube Ekle" onPress={() => setMode('add')} />
            <Pressable
              onPress={() => router.push('/deleted')}
              style={[styles.trashButton, { borderColor: colors.border }]}>
              <Feather name="trash-2" size={18} color={colors.textMuted} />
              <ThemedText style={[styles.trashText, { color: colors.textMuted }]}>Silinenler</ThemedText>
            </Pressable>
          </View>

          <View style={[styles.searchBar, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
            <Feather name="search" size={18} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Şube adı veya şehir ara..."
              placeholderTextColor={colors.textFaint}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')}>
                <Feather name="x" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          <View style={styles.grid}>
            {filtered.map((item) => (
              <View key={item.id} style={[styles.gridItem, { width: `${100 / columns}%` }]}>
                <BranchCard
                  branch={item}
                  userCount={getBranchUsers(users, usersDeletedAt, item.id).length}
                  onEdit={() => setMode({ edit: item })}
                  onManage={() => router.push(`/branch/${item.id}`)}
                />
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
  flex: { flex: 1 },
  scrollContent: { padding: Space.xl },
  contentWrap: { maxWidth: 1200, width: '100%', alignSelf: 'center' },
  headerRow: { flexDirection: 'row', gap: Space.md, alignItems: 'stretch' },
  trashButton: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Space.lg },
  trashText: { fontSize: 14, fontWeight: '600' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingHorizontal: Space.md, paddingVertical: Space.sm, borderRadius: Radius.md, borderWidth: 1, marginTop: Space.md, marginBottom: Space.xs },
  searchInput: { flex: 1, fontSize: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: Space.md },
  gridItem: { padding: Space.sm },
  formTitle: { fontSize: 17, fontWeight: '700', marginBottom: Space.xs },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  badge: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 20, fontWeight: '700' },
  cardTitleWrap: { flex: 1, gap: 2 },
  branchName: { fontSize: 16, fontWeight: '700' },
  branchCity: { fontSize: 13 },
  iconBtn: { padding: Space.sm },
  branchDetail: { fontSize: 13, marginTop: 2 },
  pillRow: { flexDirection: 'row', gap: Space.sm, marginTop: Space.sm, marginBottom: Space.xs },
  statPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: Radius.pill, paddingHorizontal: Space.md, paddingVertical: 5 },
  statPillText: { fontSize: 12, fontWeight: '600' },
});