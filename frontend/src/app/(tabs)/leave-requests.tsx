import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Radius, Space } from '@/constants/design';
import { useDesign } from '@/hooks/use-design';
import { useAuthStore } from '@/store/authStore';
import { useLeaveRequestsStore } from '@/store/leaveRequestsStore';
import { showAlert } from '@/utils/alert';
import { normalizePhone } from '@/utils/phone';

import type { LeaveType } from '@/store/leaveRequestsStore';

const LEAVE_TYPES: LeaveType[] = ['Yıllık', 'Sağlık', 'Mazeret', 'Acil'];

const PHONE_REGEX = /^(\+90|0)?5\d{9}$/;

function isValidPhone(phone: string) {
  const cleaned = phone.replace(/[\s()-]/g, '');
  return PHONE_REGEX.test(cleaned);
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

// Karakter limitleri
const LIMITS = {
  description: 150,
  emergencyContact: 15,
  leaveAddress: 200,
} as const;

/** Karakter sayacı bileşeni */
function CharCounter({ current, max, color }: { current: number; max: number; color: string }) {
  return (
    <ThemedText style={[styles.charCounter, { color }]}>
      {current}/{max}
    </ThemedText>
  );
}

export default function LeaveRequestsScreen() {
  const { colors } = useDesign();
  const addRequest = useLeaveRequestsStore((s) => s.addRequest);
  const authUser = useAuthStore((s) => s.user);

  const [selectedType, setSelectedType] = useState<LeaveType>('Yıllık');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [description, setDescription] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [leaveAddress, setLeaveAddress] = useState('');
  const [error, setError] = useState('');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const netDays = countNetWeekdays(startDate, endDate);

  const resetForm = () => {
    setSelectedType('Yıllık');
    setStartDate(new Date());
    setEndDate(new Date());
    setDescription('');
    setEmergencyContact('');
    setLeaveAddress('');
  };

  const handleSubmit = () => {
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
    if (description.trim().length === 0) {
      setError('Açıklama boş bırakılamaz');
      return;
    }
    if (!isValidPhone(emergencyContact)) {
      setError('Geçerli bir telefon numarası gir (örn: 05XX XXX XX XX)');
      return;
    }
    if (leaveAddress.trim().length === 0) {
      setError('İzinde bulunacağınız adres boş bırakılamaz');
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

    // Store'a ekle — İzin Onay ekranında anlık listelenir
    addRequest({
      firstName: authUser?.name?.split(' ')[0] ?? 'Bilinmeyen',
      lastName: authUser?.name?.split(' ').slice(1).join(' ') ?? '',
      branch: authUser?.branchName ?? 'Bilinmeyen Şube',
      leaveType: selectedType,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      netDays,
      description: description.trim(),
      createdByAdmin: false,
    });

    console.log('İzin talebi store\'a eklendi:', {
      type: selectedType,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      netDays,
      description,
      emergencyContact,
      leaveAddress: leaveAddress.trim(),
    });

    showAlert('Talep oluşturuldu', 'İzin talebin başarıyla oluşturuldu.\n\nİzin Onay ekranında "Bekleyen Talepler" sekmesinde görüntüleyebilirsiniz.', resetForm);
  };

  return (
    <Screen>
      <ThemedText type="title" style={styles.pageTitle}>
        Yeni İzin Talebi
      </ThemedText>

      <Card>
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
            Hafta sonları hariç net {netDays} gün düşülecek
          </ThemedText>
        </View>

        <ThemedText style={[styles.label, { color: colors.textMuted }]}>Açıklama</ThemedText>
        <TextInput
          style={[
            styles.textArea,
            { color: colors.text, backgroundColor: colors.surfaceRaised, borderColor: colors.border },
          ]}
          placeholder="İzin sebebini kısaca yaz"
          placeholderTextColor={colors.textFaint}
          multiline
          value={description}
          onChangeText={setDescription}
          maxLength={LIMITS.description}
        />
        <CharCounter current={description.length} max={LIMITS.description} color={colors.textFaint} />

        <ThemedText style={[styles.label, { color: colors.textMuted }]}>Acil durum iletişim</ThemedText>
        <TextInput
          style={[
            styles.input,
            { color: colors.text, backgroundColor: colors.surfaceRaised, borderColor: colors.border },
          ]}
          placeholder="05XX XXX XX XX"
          placeholderTextColor={colors.textFaint}
          keyboardType="phone-pad"
          value={emergencyContact}
          onChangeText={setEmergencyContact}
          onBlur={() => setEmergencyContact(normalizePhone(emergencyContact))}
          maxLength={LIMITS.emergencyContact}
        />
        <CharCounter current={emergencyContact.length} max={LIMITS.emergencyContact} color={colors.textFaint} />

        <ThemedText style={[styles.label, { color: colors.textMuted }]}>İzinde Bulunacağınız Adres</ThemedText>
        <TextInput
          style={[
            styles.textArea,
            { color: colors.text, backgroundColor: colors.surfaceRaised, borderColor: colors.border },
          ]}
          placeholder="İzin süresince bulunacağınız adres"
          placeholderTextColor={colors.textFaint}
          multiline
          value={leaveAddress}
          onChangeText={setLeaveAddress}
          maxLength={LIMITS.leaveAddress}
        />
        <CharCounter current={leaveAddress.length} max={LIMITS.leaveAddress} color={colors.textFaint} />

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

  /* ── Karakter sayacı ────────────────────────────────────── */
  charCounter: {
    fontSize: 11,
    textAlign: 'right',
    marginTop: 2,
  },
});