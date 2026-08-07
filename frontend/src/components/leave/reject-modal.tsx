import Feather from '@expo/vector-icons/Feather';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Radius, Shadow, Space } from '@/constants/design';
import { NARROW_MAX_WIDTH } from '@/constants/layout';
import { useDesign } from '@/hooks/use-design';

import type { LeaveRequest } from '@/store/leaveRequestsStore';

/** Ret modalında tek dokunuşla doldurulabilen hazır gerekçeler */
const REJECT_PRESETS: { label: string; reason: string }[] = [
  {
    label: 'Yoğun dönem',
    reason: 'Talep edilen tarihlerde iş yoğunluğu nedeniyle izin verilememektedir.',
  },
  { label: 'Bakiye yetersiz', reason: 'Kalan izin bakiyesi bu talep için yeterli değil.' },
  {
    label: 'Tarih çakışması',
    reason: 'Aynı tarihlerde ekipten başka bir çalışanın izni onaylanmış durumda.',
  },
  { label: 'Geç bildirim', reason: 'Talep, izin başlangıcına çok yakın bir tarihte iletildi.' },
];

const MAX_REJECT_REASON = 300;

/**
 * Ret gerekçesi modalı.
 *
 * Modalın kendisi onay adımıdır — üstüne bir de sistem onay kutusu açmıyoruz.
 * Doğrulama ve sunucu hatası da modal içinde satır olarak gösteriliyor.
 */
export function RejectModal({
  visible,
  target,
  onClose,
  onReject,
}: {
  visible: boolean;
  target: LeaveRequest | null;
  onClose: () => void;
  /** Sunucu çağrısı; hata mesajı dönerse modal açık kalıp mesajı gösterir */
  onReject: (item: LeaveRequest, reason: string) => Promise<{ ok: boolean; message?: string }>;
}) {
  const { colors } = useDesign();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Her açılışta temiz başla — önceki talebin gerekçesi taşınmasın
  useEffect(() => {
    if (visible) {
      setReason('');
      setError('');
      setSubmitting(false);
    }
  }, [visible]);

  const confirm = async () => {
    if (!target || submitting) return;

    const trimmed = reason.trim();
    if (trimmed.length === 0) {
      setError('Reddetme nedeni boş bırakılamaz.');
      return;
    }

    setSubmitting(true);
    const result = await onReject(target, trimmed);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.message ?? 'Talep reddedilemedi.');
      return;
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View
          entering={FadeInDown.duration(220).springify().damping(20)}
          style={[
            styles.content,
            { backgroundColor: colors.surface, borderColor: colors.border },
            Shadow.card,
          ]}>
          <View style={styles.header}>
            <View style={[styles.icon, { backgroundColor: `${colors.danger}18` }]}>
              <Feather name="x-circle" size={18} color={colors.danger} />
            </View>
            <View style={styles.grow}>
              <ThemedText style={[styles.title, { color: colors.text }]}>Talebi Reddet</ThemedText>
              {target && (
                <ThemedText style={[styles.subtitle, { color: colors.textMuted }]}>
                  {target.firstName} {target.lastName} — {target.leaveType} izni
                </ThemedText>
              )}
            </View>
          </View>

          <ThemedText style={[styles.fieldLabel, { color: colors.textMuted }]}>
            Hazır gerekçeler
          </ThemedText>
          <View style={styles.presetRow}>
            {REJECT_PRESETS.map((preset) => {
              const active = reason === preset.reason;
              return (
                <Pressable
                  key={preset.label}
                  onPress={() => {
                    setReason(preset.reason);
                    setError('');
                  }}
                  accessibilityRole="button"
                  style={[
                    styles.presetChip,
                    {
                      backgroundColor: active ? colors.primary : 'transparent',
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}>
                  <ThemedText
                    style={[styles.presetChipText, { color: active ? '#fff' : colors.text }]}>
                    {preset.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <ThemedText style={[styles.fieldLabel, { color: colors.textMuted }]}>
            Reddetme nedeni
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: colors.surfaceRaised,
                borderColor: error ? colors.danger : colors.border,
              },
            ]}
            placeholder="Ret nedenini açıklayınız..."
            placeholderTextColor={colors.textFaint}
            multiline
            maxLength={MAX_REJECT_REASON}
            value={reason}
            onChangeText={(text) => {
              setReason(text);
              if (error) setError('');
            }}
            autoFocus
          />
          <ThemedText style={[styles.charCount, { color: colors.textFaint }]}>
            {reason.length}/{MAX_REJECT_REASON}
          </ThemedText>

          {error !== '' && <Notice icon="alert-circle" color={colors.danger} text={error} />}

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              style={[styles.cancelBtn, { borderColor: colors.border }]}>
              <ThemedText style={[styles.cancelText, { color: colors.textMuted }]}>
                Vazgeç
              </ThemedText>
            </Pressable>
            <View style={styles.grow}>
              <Button label="Reddet" onPress={confirm} loading={submitting} />
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: Space.xl,
  },
  content: {
    width: '100%',
    maxWidth: NARROW_MAX_WIDTH,
    alignSelf: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Space.xl,
    gap: Space.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    marginBottom: Space.xs,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 13 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: Space.sm,
    marginBottom: Space.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: 14,
    fontSize: 15,
    minHeight: 96,
    textAlignVertical: 'top',
  },
  charCount: { fontSize: 11, textAlign: 'right' },
  actions: {
    flexDirection: 'row',
    gap: Space.md,
    marginTop: Space.sm,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontSize: 16, fontWeight: '600' },

  // Hazır ret gerekçeleri
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  presetChip: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Space.md,
    paddingVertical: 7,
  },
  presetChipText: { fontSize: 12, fontWeight: '600' },
});
