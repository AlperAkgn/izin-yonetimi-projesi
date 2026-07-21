import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Radius, Space } from '@/constants/design';
import { useDesign } from '@/hooks/use-design';
import { useLeaveRequestsStore } from '@/store/leaveRequestsStore';
import { showAlert } from '@/utils/alert';

import type { LeaveType } from '@/store/leaveRequestsStore';

const LEAVE_TYPES: LeaveType[] = ['Yıllık', 'Sağlık', 'Mazeret', 'Acil'];

const PHONE_REGEX = /^(\+90|0)?5\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidPhone(phone: string) {
  const cleaned = phone.replace(/[\s()-]/g, '');
  return PHONE_REGEX.test(cleaned);
}

function isValidEmail(email: string) {
  return EMAIL_REGEX.test(email.trim());
}

function countNetWeekdays(start: Date, end: Date) {
  if (end < start) return 0;
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export default function AdminLeaveRequestScreen() {
  const { colors } = useDesign();
  const addRequest = useLeaveRequestsStore((s) => s.addRequest);

  // Çalışan bilgileri
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [branch, setBranch] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // İzin bilgileri
  const [selectedType, setSelectedType] = useState<LeaveType>('Yıllık');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [leaveAddress, setLeaveAddress] = useState('');

  const [error, setError] = useState('');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const netDays = countNetWeekdays(startDate, endDate);

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setBranch('');
    setPhone('');
    setEmail('');
    setSelectedType('Yıllık');
    setStartDate(new Date());
    setEndDate(new Date());
    setLeaveAddress('');
    setError('');
  };

  const handleSubmit = () => {
    if (firstName.trim().length === 0) {
      setError('İsim alanı boş bırakılamaz');
      return;
    }
    if (lastName.trim().length === 0) {
      setError('Soyisim alanı boş bırakılamaz');
      return;
    }
    if (branch.trim().length === 0) {
      setError('Şube alanı boş bırakılamaz');
      return;
    }
    if (!isValidPhone(phone)) {
      setError('Geçerli bir telefon numarası gir (örn: 05XX XXX XX XX)');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Geçerli bir e-posta adresi gir');
      return;
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    if (start < today) {
      setError('Geçmiş bir tarih için izin talebi oluşturamazsın');
      return;
    }
    if (endDate < startDate) {
      setError('Bitiş tarihi başlangıçtan önce olamaz');
      return;
    }
    if (leaveAddress.trim().length === 0) {
      setError('İzinde bulunacağı adres boş bırakılamaz');
      return;
    }

    setError('');

    // Tarihleri DD.MM.YYYY formatına çevir
    const formatDate = (d: Date): string => {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}.${mm}.${yyyy}`;
    };

    // Store'a ekle — iş kuralları store içinde uygulanır:
    //   - Acil → AUTO_APPROVED
    //   - Admin oluşturma → APPROVED
    addRequest({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      branch: branch.trim(),
      leaveType: selectedType,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      netDays,
      description: `Admin tarafından oluşturuldu. İzin adresi: ${leaveAddress.trim()}`,
      createdByAdmin: true,
    });

    console.log('Admin izin talebi store\'a eklendi:', {
      employee: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        branch: branch.trim(),
        phone: phone.trim(),
        email: email.trim(),
      },
      leave: {
        type: selectedType,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        netDays,
        leaveAddress: leaveAddress.trim(),
      },
    });

    showAlert(
      'Talep oluşturuldu',
      `${firstName.trim()} ${lastName.trim()} adına izin talebi başarıyla oluşturuldu.\n\nİzin Onay ekranında "İşlem Görenler" sekmesinde görüntüleyebilirsiniz.`,
      resetForm,
    );
  };

  return (
    <Screen>
      <ThemedText type="title" style={styles.pageTitle}>
        Çalışan İzin Yaz
      </ThemedText>

      {/* Çalışan Bilgileri */}
      <Card>
        <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
          Çalışan Bilgileri
        </ThemedText>

        <ThemedText style={[styles.label, { color: colors.textMuted }]}>İsim</ThemedText>
        <TextInput
          style={[
            styles.input,
            { color: colors.text, backgroundColor: colors.surfaceRaised, borderColor: colors.border },
          ]}
          placeholder="Çalışanın adı"
          placeholderTextColor={colors.textFaint}
          value={firstName}
          onChangeText={setFirstName}
        />

        <ThemedText style={[styles.label, { color: colors.textMuted }]}>Soyisim</ThemedText>
        <TextInput
          style={[
            styles.input,
            { color: colors.text, backgroundColor: colors.surfaceRaised, borderColor: colors.border },
          ]}
          placeholder="Çalışanın soyadı"
          placeholderTextColor={colors.textFaint}
          value={lastName}
          onChangeText={setLastName}
        />

        <ThemedText style={[styles.label, { color: colors.textMuted }]}>Şube</ThemedText>
        <TextInput
          style={[
            styles.input,
            { color: colors.text, backgroundColor: colors.surfaceRaised, borderColor: colors.border },
          ]}
          placeholder="Şube adı"
          placeholderTextColor={colors.textFaint}
          value={branch}
          onChangeText={setBranch}
        />

        <ThemedText style={[styles.label, { color: colors.textMuted }]}>Telefon Numarası</ThemedText>
        <TextInput
          style={[
            styles.input,
            { color: colors.text, backgroundColor: colors.surfaceRaised, borderColor: colors.border },
          ]}
          placeholder="05XX XXX XX XX"
          placeholderTextColor={colors.textFaint}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />

        <ThemedText style={[styles.label, { color: colors.textMuted }]}>E-posta Adresi</ThemedText>
        <TextInput
          style={[
            styles.input,
            { color: colors.text, backgroundColor: colors.surfaceRaised, borderColor: colors.border },
          ]}
          placeholder="ornek@firma.com"
          placeholderTextColor={colors.textFaint}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
      </Card>

      {/* İzin Bilgileri */}
      <Card>
        <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
          İzin Bilgileri
        </ThemedText>

        <ThemedText style={[styles.label, { color: colors.textMuted }]}>İzin kategorisi</ThemedText>
        <View style={styles.chipRow}>
          {LEAVE_TYPES.map((type) => {
            const active = selectedType === type;
            return (
              <Pressable
                key={type}
                onPress={() => setSelectedType(type)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.primary : 'transparent',
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}>
                <ThemedText
                  style={{ color: active ? '#fff' : colors.text, fontWeight: active ? '600' : '400' }}>
                  {type}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.dateRow}>
          <View style={styles.dateCol}>
            <ThemedText style={[styles.label, { color: colors.textMuted }]}>Başlangıç</ThemedText>
            <DateField
              value={startDate}
              minimumDate={new Date()}
              onChange={setStartDate}
              borderColor={colors.border}
            />
          </View>
          <View style={styles.dateCol}>
            <ThemedText style={[styles.label, { color: colors.textMuted }]}>Bitiş</ThemedText>
            <DateField
              value={endDate}
              minimumDate={startDate}
              onChange={setEndDate}
              borderColor={colors.border}
            />
          </View>
        </View>

        <View style={[styles.netDaysBox, { backgroundColor: colors.primarySoft }]}>
          <ThemedText style={[styles.netDaysText, { color: colors.primary }]}>
            Hafta sonları hariç toplam {netDays} gün
          </ThemedText>
        </View>

        <ThemedText style={[styles.label, { color: colors.textMuted }]}>İzinde Bulunacağı Adres</ThemedText>
        <TextInput
          style={[
            styles.textArea,
            { color: colors.text, backgroundColor: colors.surfaceRaised, borderColor: colors.border },
          ]}
          placeholder="İzin süresince bulunacağı adres"
          placeholderTextColor={colors.textFaint}
          multiline
          value={leaveAddress}
          onChangeText={setLeaveAddress}
        />
      </Card>

      {/* Hata mesajı ve gönder butonu */}
      <Card>
        {error !== '' && (
          <ThemedText style={[styles.error, { color: colors.danger }]}>{error}</ThemedText>
        )}

        <Button label="Talebi Gönder" onPress={handleSubmit} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: {
    fontSize: 13,
    marginTop: Space.sm,
  },

  pageTitle: {
    marginTop: Space.sm,
    marginBottom: Space.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: Space.xs,
  },
  label: {
    fontSize: 13,
    marginBottom: Space.xs,
    marginTop: Space.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm,
  },
  dateRow: {
    flexDirection: 'row',
    gap: Space.md,
  },
  dateCol: {
    flex: 1,
  },
  netDaysBox: {
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    marginTop: Space.md,
  },
  netDaysText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: 14,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: 14,
    fontSize: 16,
    minHeight: 90,
    textAlignVertical: 'top',
  },
});
