import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui/screen';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LabeledInput } from '@/components/ui/labeled-input';
import { useDesign } from '@/hooks/use-design';
import { Radius, Space } from '@/constants/design';
import { showAlert, showConfirm } from '@/utils/alert';
import { Branch } from '@/services/branches';
import { useBranchesStore, PURGE_AFTER_MS } from '@/store/branchesStore';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(\+90|0)?[25]\d{9}$/;

function isValidPhone(p: string) {
  return PHONE_REGEX.test(p.replace(/[\s()-]/g, ''));
}

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
      <LabeledInput label="Şube telefonu" placeholder="Örn: 0232 000 00 00" maxLength={15} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      {error !== '' && <ThemedText style={{ color: colors.danger, fontSize: 13 }}>{error}</ThemedText>}
      <Button label="Şubeyi Kaydet" onPress={handleSave} />
      <Button label="Vazgeç" onPress={onDone} variant="ghost" />
    </Card>
  );
}

// ---- HR ekleme formu ----
function AddHRForm({ branch, onDone }: { branch: Branch; onDone: () => void }) {
  const { colors } = useDesign();
  const addHRToBranch = useBranchesStore((s) => s.addHRToBranch);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (firstName.trim().length === 0) return setError('İsim boş olamaz');
    if (lastName.trim().length === 0) return setError('Soyisim boş olamaz');
    if (!EMAIL_REGEX.test(email)) return setError('Geçerli bir e-posta gir');
    if (!isValidPhone(phone)) return setError('Geçerli bir telefon numarası gir');
    setError('');
    addHRToBranch(branch.id, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
    });
    showAlert('İK Eklendi', `${firstName} ${lastName}, ${branch.name} şubesine İK olarak eklendi. Geçici şifre e-posta ile gönderilecek.`);
    onDone();
  };

  return (
    <Card>
      <ThemedText style={styles.formTitle}>{branch.name} — İK Ekle</ThemedText>
      <LabeledInput label="İsim" placeholder="Örn: Ahmet" maxLength={30} value={firstName} onChangeText={setFirstName} />
      <LabeledInput label="Soyisim" placeholder="Örn: Kaya" maxLength={30} value={lastName} onChangeText={setLastName} />
      <LabeledInput label="E-posta" placeholder="Örn: ahmet.kaya@sirket.com" maxLength={60} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <LabeledInput label="Telefon" placeholder="Örn: 05XX XXX XX XX" maxLength={15} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      {error !== '' && <ThemedText style={{ color: colors.danger, fontSize: 13 }}>{error}</ThemedText>}
      <Button label="İK Personelini Ekle" onPress={handleSave} />
      <Button label="Vazgeç" onPress={onDone} variant="ghost" />
    </Card>
  );
}

// ---- Aktif şube kartı ----
function BranchCard({ branch, onAddHR }: { branch: Branch; onAddHR: () => void }) {
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
          <ThemedText style={[styles.branchCity, { color: colors.textMuted }]}>
            📍 {branch.city}
          </ThemedText>
        </View>
        <Pressable onPress={handleDelete} style={styles.deleteButton}>
          <Feather name="trash-2" size={18} color={colors.danger} />
        </Pressable>
      </View>

      <ThemedText style={[styles.branchDetail, { color: colors.textMuted }]}>{branch.address}</ThemedText>
      <ThemedText style={[styles.branchDetail, { color: colors.textMuted }]}>{branch.phone}</ThemedText>

      <View style={styles.branchStats}>
        <View style={[styles.statPill, { backgroundColor: colors.primarySoft }]}>
          <ThemedText style={[styles.statPillText, { color: colors.primary }]}>
            {branch.employeeCount} personel
          </ThemedText>
        </View>
        <View style={[styles.statPill, { backgroundColor: colors.primarySoft }]}>
          <ThemedText style={[styles.statPillText, { color: colors.primary }]}>
            {branch.hrList.length} İK
          </ThemedText>
        </View>
      </View>

      {branch.hrList.map((hr) => (
        <View key={hr.id} style={[styles.hrRow, { borderTopColor: colors.border }]}>
          <ThemedText style={styles.hrName}>
            {hr.firstName} {hr.lastName}
          </ThemedText>
          <ThemedText style={[styles.hrDetail, { color: colors.textMuted }]}>
            {hr.email} · {hr.phone}
          </ThemedText>
        </View>
      ))}

      <Button label="İK Personeli Ekle" onPress={onAddHR} variant="ghost" />
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
  const branches = useBranchesStore((s) => s.branches);
  const deletedAt = useBranchesStore((s) => s.deletedAt);
  const [mode, setMode] = useState<'list' | 'add-branch' | { addHRTo: string }>('list');

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
    const branch = active.find((b) => b.id === mode.addHRTo);
    if (branch) {
      return (
        <Screen>
          <AddHRForm branch={branch} onDone={() => setMode('list')} />
        </Screen>
      );
    }
  }

  return (
    <Screen scroll={false}>
      <FlatList
        data={active}
        keyExtractor={(b) => b.id}
        renderItem={({ item }) => (
          <BranchCard branch={item} onAddHR={() => setMode({ addHRTo: item.id })} />
        )}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Button label="+ Yeni Şube Ekle" onPress={() => setMode('add-branch')} />
        }
        ListHeaderComponentStyle={styles.listHeader}
        ListFooterComponent={
          deleted.length > 0 ? (
            <View style={styles.deletedSection}>
              <ThemedText style={styles.deletedTitle}>Silinen Şubeler</ThemedText>
              {deleted.map((b) => (
                <DeletedBranchCard key={b.id} branch={b} deletedAtMs={deletedAt[b.id]} />
              ))}
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: Space.md, paddingBottom: Space.xl },
  listHeader: { marginBottom: Space.sm },
  formTitle: { fontSize: 17, fontWeight: '700', marginBottom: Space.xs },
  branchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  branchTitleWrap: { flex: 1, gap: 2 },
  branchName: { fontSize: 17, fontWeight: '700' },
  branchCity: { fontSize: 13 },
  deleteButton: { padding: Space.sm },
  branchDetail: { fontSize: 13 },
  branchStats: { flexDirection: 'row', gap: Space.sm, marginTop: Space.xs },
  statPill: { borderRadius: Radius.pill, paddingHorizontal: Space.md, paddingVertical: 4 },
  statPillText: { fontSize: 12, fontWeight: '600' },
  hrRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Space.sm, marginTop: Space.sm, gap: 2 },
  hrName: { fontSize: 14, fontWeight: '600' },
  hrDetail: { fontSize: 12 },
  deletedName: { textDecorationLine: 'line-through' },
  deletedSection: { marginTop: Space.lg, gap: Space.md },
  deletedTitle: { fontSize: 15, fontWeight: '700' },
});