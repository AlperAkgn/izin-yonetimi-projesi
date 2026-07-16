import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

const LEAVE_TYPES = ['Yıllık', 'Sağlık', 'Mazeret', 'Acil'] as const;
type LeaveType = (typeof LEAVE_TYPES)[number];

function countNetWeekdays(start: Date, end: Date) {
  if (end < start) return 0;
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getDay(); // 0 = Pazar, 6 = Cumartesi
    if (day !== 0 && day !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export default function LeaveRequestsScreen() {
  const theme = useTheme();

  const [selectedType, setSelectedType] = useState<LeaveType>('Yıllık');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [description, setDescription] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [error, setError] = useState('');
 
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const netDays = countNetWeekdays(startDate, endDate);

  const PHONE_REGEX = /^(\+90|0)?5\d{9}$/;

  function isValidPhone(phone: string) {
    const cleaned = phone.replace(/[\s()-]/g, '');
    return PHONE_REGEX.test(cleaned);
  }

  const resetForm = () => {
    setSelectedType('Yıllık');
    setStartDate(new Date());
    setEndDate(new Date());
    setDescription('');
    setEmergencyContact('');
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
    setError('');

    console.log('İzin talebi:', { type: selectedType, startDate, endDate, netDays, description, emergencyContact });

    Alert.alert('Başarılı', 'İzin talebiniz başarıyla oluşturuldu.', [
      { text: 'Tamam', onPress: resetForm },
    ]);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <ThemedText type="title">Yeni İzin Talebi</ThemedText>

      <ThemedText type="subtitle" style={styles.label}>
        İzin Kategorisi
      </ThemedText>
      <ThemedView style={styles.chipRow}>
        {LEAVE_TYPES.map((type) => (
          <Pressable
            key={type}
            onPress={() => setSelectedType(type)}
            style={[
              styles.chip,
              { borderColor: theme.text },
              selectedType === type && { backgroundColor: theme.text },
            ]}>
            <ThemedText
              style={selectedType === type ? { color: theme.background } : { color: theme.text }}>
              {type}
            </ThemedText>
          </Pressable>
        ))}
      </ThemedView>

      <ThemedText type="subtitle" style={styles.label}>
        Başlangıç Tarihi
      </ThemedText>
      <Pressable
        style={[styles.dateButton, { borderColor: theme.text }]}
        onPress={() => setShowStartPicker(true)}>
        <ThemedText>{startDate.toLocaleDateString('tr-TR')}</ThemedText>
      </Pressable>
      {showStartPicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          minimumDate={new Date()}
          onChange={(_, selected) => {
            setShowStartPicker(Platform.OS === 'ios');
            if (selected) setStartDate(selected);
          }}
        />
      )}

      <ThemedText type="subtitle" style={styles.label}>
        Bitiş Tarihi
      </ThemedText>
      <Pressable
        style={[styles.dateButton, { borderColor: theme.text }]}
        onPress={() => setShowEndPicker(true)}>
        <ThemedText>{endDate.toLocaleDateString('tr-TR')}</ThemedText>
      </Pressable>
      {showEndPicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          minimumDate={startDate}
          onChange={(_, selected) => {
            setShowEndPicker(Platform.OS === 'ios');
            if (selected) setEndDate(selected);
          }}
        />
      )}

      <ThemedText type="small" style={styles.netDaysHint}>
        Hafta sonları hariç net {netDays} gün düşülecek
      </ThemedText>

      <ThemedText type="subtitle" style={styles.label}>
        Açıklama
      </ThemedText>
      <TextInput
        style={[styles.textArea, { color: theme.text, borderColor: theme.text }]}
        placeholder="İzin sebebini kısaca yaz"
        placeholderTextColor={theme.textSecondary ?? '#888'}
        multiline
        numberOfLines={3}
        value={description}
        onChangeText={setDescription}
      />

      <ThemedText type="subtitle" style={styles.label}>
        Acil Durum İletişim
      </ThemedText>
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.text }]}
        placeholder="Telefon numarası"
        placeholderTextColor={theme.textSecondary ?? '#888'}
        keyboardType="phone-pad"
        value={emergencyContact}
        onChangeText={setEmergencyContact}
      />
      
      {error !== '' && <ThemedText style={styles.error}>{error}</ThemedText>}

      <Pressable style={styles.submitButton} onPress={handleSubmit}>
        <ThemedText style={styles.submitText}>Talebi Gönder</ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  
  scroll: { flex: 1 },
  container: { padding: 20, gap: 6, paddingBottom: 60 },
  label: { marginTop: 14, marginBottom: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dateButton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  netDaysHint: { marginTop: 4, opacity: 0.7 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  error: { color: '#e11d48', marginTop: 8 },
  submitButton: {
    backgroundColor: '#208AEF',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  submitText: { color: '#fff', fontWeight: '600' },
});