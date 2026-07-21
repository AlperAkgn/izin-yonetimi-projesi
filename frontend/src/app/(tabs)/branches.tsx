import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Screen } from '@/components/ui/screen';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LabeledInput } from '@/components/ui/labeled-input';
import { useDesign } from '@/hooks/use-design';
import { Radius, Space } from '@/constants/design';
import { showConfirm } from '@/utils/alert';
import { normalizePhone } from '@/utils/phone';
import { Branch } from '@/services/branches';
import { useBranchesStore, PURGE_AFTER_MS } from '@/store/branchesStore';
import { useUsersStore, getBranchUsers, getUnassignedUsers, AppUser } from '@/store/usersStore';
import { useColumns } from '@/hooks/use-columns';

const PHONE_REGEX = /^0(5\d{9}|[2-4]\d{9})$/;
function isValidPhone(p: string) {
  return PHONE_REGEX.test(p.replace(/\D/g, ''));
}

const ROLE_LABEL: Record<string, string> = { EMPLOYEE: 'Personel', HR: 'İnsan Kaynakları' };

// ---- Şube ekleme formu ----
function AddBranchForm({ onDone }: { onDone: () => void }) {
  const { colors } = useDesign();
  const addBranch = useBranchesStore((s) => s.addBranch);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (name.trim().length < 3) return setError('Şube adı en az 3 karakter olmalı');
    if (city.trim().length === 0) return setError('Şehir boş olamaz');
    if (address.trim().length === 0) return setError('Adres boş olamaz');
    if (!isValidPhone(phone)) return setError('Geçerli bir telefon numarası gir');
    setError('');
    addBranch({ name: name.trim(), city: city.trim(), address: address.trim(), phone: phone.trim() });
    onDone();
  };

  return (
    <Card>
      <ThemedText style={styles.formTitle}>Yeni Şube</ThemedText>
      <LabeledInput label="Şube adı" placeholder="Örn: İzmir Şube" maxLength={50} value={name} onChangeText={setName} />
      <LabeledInput label="Şehir" placeholder="Örn: İzmir" maxLength={30} value={city} onChangeText={setCity} />
      <LabeledInput label="Adres" placeholder="Örn: Alsancak Mah. No:12" maxLength={100} value={address} onChangeText={setAddress} />
      <LabeledInput
        label="Şube telefonu"
        placeholder="Örn: 0232 000 00 00"
        maxLength={15}
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
        onBlur={() => setPhone(normalizePhone(phone))}
      />
      {error !== '' && <ThemedText style={{ color: colors.danger, fontSize: 13 }}>{error}</ThemedText>}
      <Button label="Şubeyi Kaydet" onPress={handleSave} />
      <Button label="Vazgeç" onPress={onDone} variant="ghost" />
    </Card>
  );
}

// ---- Personel atama (havuzdan seçme) ----
function AssignStaffForm({ branch, onDone }: { branch: Branch; onDone: () => void }) {
  const { colors } = useDesign();
  const users = useUsersStore((s) => s.users);
  const assignToBranch = useUsersStore((s) => s.assignToBranch);
  const [query, setQuery] = useState('');

  const available = useMemo(() => {
    const unassigned = getUnassignedUsers(users);
    const q = query.trim().toLocaleLowerCase('tr-TR');
    if (q === '') return unassigned;
    return unassigned.filter((u) =>
      `${u.firstName} ${u.lastName}`.toLocaleLowerCase('tr-TR').includes(q)
    );
  }, [users, query]);

  return (
    <Card>
      <ThemedText style={styles.formTitle}>{branch.name} — Personel Ekle</ThemedText>
      <ThemedText style={[styles.formHint, { color: colors.textMuted }]}>
        Yalnızca hiçbir şubeye atanmamış kullanıcılar listelenir.
      </ThemedText>

      <View style={[styles.searchBar, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
        <Feather name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="İsim ara..."
          placeholderTextColor={colors.textFaint}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {available.length === 0 ? (
        <ThemedText style={[styles.empty, { color: colors.textMuted }]}>
          Atanabilecek kullanıcı yok
        </ThemedText>
      ) : (
        available.map((u) => (
          <Pressable
            key={u.id}
            onPress={() => assignToBranch(u.id, branch.id)}
            style={({ pressed }) => [
              styles.pickRow,
              { borderColor: colors.border, backgroundColor: pressed ? colors.surfaceRaised : 'transparent' },
            ]}>
            <View style={styles.pickBody}>
              <ThemedText style={styles.pickName}>{u.firstName} {u.lastName}</ThemedText>
              <ThemedText style={[styles.pickDetail, { color: colors.textMuted }]}>
                {ROLE_LABEL[u.role]} · {u.email}
              </ThemedText>
            </View>
            <Feather name="plus-circle" size={20} color={colors.primary} />
          </Pressable>
        ))
      )}

      <Button label="Bitti" onPress={onDone} variant="ghost" />
    </Card>
  );
}

// ---- Aktif şube kartı ----
function BranchCard({
  branch,
  userCount,
  onAssign,
  onView,
}: {
  branch: Branch;
  userCount: number;
  onAssign: () => void;
  onView: () => void;
}) {
  const { colors } = useDesign();
  const deleteBranch = useBranchesStore((s) => s.deleteBranch);

  const handleDelete = () => {
    showConfirm(
      'Şubeyi Sil',
      `"${branch.name}" şubesi silinecek. Şube 24 saat boyunca "Silinen Şubeler" bölümünden geri alınabilir; süre dolunca kalıcı olarak temizlenir. Emin misin?`,
      'Devam',
      () => deleteBranch(branch.id)
    );
  };

  return (
    <Card>
      <View style={styles.branchHeader}>
        <View style={styles.branchTitleWrap}>
          <ThemedText style={styles.branchName}>{branch.name}</ThemedText>
          <ThemedText style={[styles.branchCity, { color: colors.textMuted }]}>📍 {branch.city}</ThemedText>
        </View>
        <Pressable onPress={handleDelete} style={styles.deleteButton}>
          <Feather name="trash-2" size={18} color={colors.danger} />
        </Pressable>
      </View>

      <ThemedText style={[styles.branchDetail, { color: colors.textMuted }]}>{branch.address}</ThemedText>
      <ThemedText style={[styles.branchDetail, { color: colors.textMuted }]}>{branch.phone}</ThemedText>

      <View style={[styles.statPill, { backgroundColor: colors.primarySoft }]}>
        <ThemedText style={[styles.statPillText, { color: colors.primary }]}>
          {userCount} kişi atanmış
        </ThemedText>
      </View>

      <Button label="Personelleri Görüntüle" onPress={onView} variant="ghost" />
      <Button label="Personel Ekle" onPress={onAssign} />
    </Card>
  );
}

// ---- Silinen şube kartı ----
function DeletedBranchCard({ branch, deletedAtMs }: { branch: Branch; deletedAtMs: number }) {
  const { colors } = useDesign();
  const restoreBranch = useBranchesStore((s) => s.restoreBranch);

  const remainingMs = Math.max(0, deletedAtMs + PURGE_AFTER_MS - Date.now());
  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));

  return (
    <Card>
      <View style={styles.branchHeader}>
        <View style={styles.branchTitleWrap}>
          <ThemedText style={[styles.branchName, styles.deletedName, { color: colors.textMuted }]}>
            {branch.name}
          </ThemedText>
          <ThemedText style={[styles.branchCity, { color: colors.danger }]}>
            Kalıcı silinmeye kalan: {hours} sa {minutes} dk
          </ThemedText>
        </View>
      </View>
      <Button label="Geri Al" onPress={() => restoreBranch(branch.id)} variant="ghost" />
    </Card>
  );
}

// ---- Ana ekran ----
export default function BranchesScreen() {
  const { colors } = useDesign();
  const branches = useBranchesStore((s) => s.branches);
  const deletedAt = useBranchesStore((s) => s.deletedAt);
  const users = useUsersStore((s) => s.users);
  const columns = useColumns();
  const [mode, setMode] = useState<'list' | 'add-branch' | { assignTo: string }>('list');

  const active = branches.filter((b) => !(b.id in deletedAt));
  const deleted = branches.filter((b) => b.id in deletedAt);

  if (mode === 'add-branch') {
    return (
      <Screen>
        <AddBranchForm onDone={() => setMode('list')} />
      </Screen>
    );
  }

  if (typeof mode === 'object') {
    const branch = active.find((b) => b.id === mode.assignTo);
    if (branch) {
      return (
        <Screen>
          <AssignStaffForm branch={branch} onDone={() => setMode('list')} />
        </Screen>
      );
    }
  }

  return (
    <View style={[styles.screenRoot, { backgroundColor: colors.bg }]}>
      <ScrollView
        style={styles.flatList}
        contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentWrap}>
          <Button label="+ Yeni Şube Ekle" onPress={() => setMode('add-branch')} />

          <View style={styles.grid}>
            {active.map((item) => (
              <View key={item.id} style={[styles.gridItem, { width: `${100 / columns}%` }]}>
                <BranchCard
                  branch={item}
                  userCount={getBranchUsers(users, item.id).length}
                  onAssign={() => setMode({ assignTo: item.id })}
                  onView={() => router.push(`/branch/${item.id}`)}
                />
              </View>
            ))}
          </View>

          {deleted.length > 0 && (
            <View style={styles.deletedSection}>
              <ThemedText style={styles.deletedTitle}>Silinen Şubeler</ThemedText>
              {deleted.map((b) => (
                <DeletedBranchCard key={b.id} branch={b} deletedAtMs={deletedAt[b.id]} />
              ))}
            </View>
          )}
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
  formTitle: { fontSize: 17, fontWeight: '700', marginBottom: Space.xs },
  formHint: { fontSize: 12, marginBottom: Space.sm },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingHorizontal: Space.md, paddingVertical: Space.sm, borderRadius: Radius.md, borderWidth: 1, marginBottom: Space.sm },
  searchInput: { flex: 1, fontSize: 15 },
  empty: { fontSize: 13, fontStyle: 'italic', marginVertical: Space.sm },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md, borderWidth: 1, borderRadius: Radius.md, padding: Space.md, marginBottom: Space.sm },
  pickBody: { flex: 1, gap: 2 },
  pickName: { fontSize: 14, fontWeight: '600' },
  pickDetail: { fontSize: 12 },
  branchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  branchTitleWrap: { flex: 1, gap: 2 },
  branchName: { fontSize: 17, fontWeight: '700' },
  branchCity: { fontSize: 13 },
  deleteButton: { padding: Space.sm },
  branchDetail: { fontSize: 13 },
  statPill: { alignSelf: 'flex-start', borderRadius: Radius.pill, paddingHorizontal: Space.md, paddingVertical: 4, marginTop: Space.xs },
  statPillText: { fontSize: 12, fontWeight: '600' },
  deletedName: { textDecorationLine: 'line-through' },
  deletedSection: { marginTop: Space.lg, gap: Space.md },
  deletedTitle: { fontSize: 15, fontWeight: '700' },
});