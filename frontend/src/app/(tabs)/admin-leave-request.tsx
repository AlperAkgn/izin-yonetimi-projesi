import Feather from '@expo/vector-icons/Feather';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { DateField } from '@/components/date-field';
import { ThemedText } from '@/components/themed-text';
import { BalanceBar } from '@/components/ui/balance-bar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LabeledInput } from '@/components/ui/labeled-input';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Radius, Space } from '@/constants/design';
import { LEAVE_TYPES, leaveTypeEmoji } from '@/constants/leave';
import { useDesign } from '@/hooks/use-design';
import { DEFAULT_LEAVE_DAYS } from '@/services/branches';
import { useBranchesStore } from '@/store/branchesStore';
import {
  calculateLeaveBalance,
  findOverlappingLeaves,
  useLeaveRequestsStore,
} from '@/store/leaveRequestsStore';
import { showToast } from '@/store/toastStore';
import { useUsersStore } from '@/store/usersStore';
import { countNetWeekdays, formatDate } from '@/utils/date';
import { normalizePhone } from '@/utils/phone';

import type { LeaveRequest, LeaveType } from '@/store/leaveRequestsStore';

const PHONE_REGEX = /^(\+90|0)?5\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Karakter limitleri
const LIMITS = {
  firstName: 30,
  lastName: 30,
  phone: 15,
  email: 60,
  leaveAddress: 200,
} as const;

// Şube formda sorulmaz; e-posta ile kayıtlı çalışan bulunamazsa bu etiket yazılır
const UNKNOWN_BRANCH = 'Şube atanmamış';

/** Bakiye/çakışma hesaplarında kullanılan, henüz kaydedilmemiş talebin kimliği */
const DRAFT_ID = '__draft__';

function isValidPhone(phone: string) {
  const cleaned = phone.replace(/[\s()-]/g, '');
  return PHONE_REGEX.test(cleaned);
}

function isValidEmail(email: string) {
  return EMAIL_REGEX.test(email.trim());
}

// ─── Alan doğrulayıcıları ─────────────────────────────────────────
// "Boş bırakılamaz" uyarıları SADECE gönderimde çıkar; alanlar arasında
// gezerken doldurulmamış her alan için kırmızı mesaj görmek rahatsız edici.
// onBlur'da yalnızca BİÇİM hatası (dolu ama geçersiz) gösteriliyor.

function validatePhoneFormat(value: string) {
  if (value.trim().length === 0) return undefined;
  return isValidPhone(value) ? undefined : 'Geçerli bir numara gir (örn: 05XX XXX XX XX).';
}

function validateEmailFormat(value: string) {
  if (value.trim().length === 0) return undefined;
  return isValidEmail(value) ? undefined : 'Geçerli bir e-posta adresi gir.';
}

function validateFirstName(value: string) {
  return value.trim().length === 0 ? 'İsim boş bırakılamaz.' : undefined;
}

function validateLastName(value: string) {
  return value.trim().length === 0 ? 'Soyisim boş bırakılamaz.' : undefined;
}

function validatePhone(value: string) {
  if (value.trim().length === 0) return 'Telefon numarası boş bırakılamaz.';
  return validatePhoneFormat(value);
}

function validateEmail(value: string) {
  if (value.trim().length === 0) return 'E-posta adresi boş bırakılamaz.';
  return validateEmailFormat(value);
}

function validateAddress(value: string) {
  return value.trim().length === 0 ? 'İzinde bulunacağı adres boş bırakılamaz.' : undefined;
}

export default function AdminLeaveRequestScreen() {
  const { colors } = useDesign();
  const { width } = useWindowDimensions();

  const addRequest = useLeaveRequestsStore((s) => s.addRequest);
  const allRequests = useLeaveRequestsStore((s) => s.requests);

  // Şube adı elle sorulmaz — kayıtlı çalışanın kendi şubesinden türetilir
  const users = useUsersStore((s) => s.users);
  const usersDeletedAt = useUsersStore((s) => s.deletedAt);
  const branches = useBranchesStore((s) => s.branches);

  const stackFields = width < 640; // ikili alanlar dar ekranda alt alta

  // Çalışan bilgileri
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // İzin bilgileri
  const [selectedType, setSelectedType] = useState<LeaveType>('Yıllık');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [leaveAddress, setLeaveAddress] = useState('');

  const [dateError, setDateError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    leaveAddress?: string;
  }>({});

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const netDays = countNetWeekdays(startDate, endDate);

  /** Çalışan e-posta ile eşleştirilir (e-posta sistemde benzersiz) */
  const matchedUser = useMemo(() => {
    const mail = email.trim().toLocaleLowerCase('tr-TR');
    if (mail === '') return undefined;
    return users.find(
      (u) => !(u.id in usersDeletedAt) && u.email.toLocaleLowerCase('tr-TR') === mail,
    );
  }, [users, usersDeletedAt, email]);

  /** İzin kaydına yazılacak şube — eşleşen çalışanın şubesi */
  const resolvedBranch = useMemo(() => {
    if (!matchedUser) return UNKNOWN_BRANCH;
    return branches.find((b) => b.id === matchedUser.branchId)?.name ?? UNKNOWN_BRANCH;
  }, [branches, matchedUser]);

  const entitlement = useMemo(
    () =>
      branches.find((b) => b.id === matchedUser?.branchId)?.defaultLeaveDays ?? DEFAULT_LEAVE_DAYS,
    [branches, matchedUser],
  );

  /** Bakiye ve çakışma, henüz kaydedilmemiş talep üzerinden hesaplanır */
  const draft = useMemo<LeaveRequest>(
    () => ({
      id: DRAFT_ID,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      branch: resolvedBranch,
      leaveType: selectedType,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      netDays,
      description: '',
      status: 'PENDING',
    }),
    [firstName, lastName, resolvedBranch, selectedType, startDate, endDate, netDays],
  );

  const balance = useMemo(
    () => calculateLeaveBalance(allRequests, draft, entitlement),
    [allRequests, draft, entitlement],
  );

  const overlaps = useMemo(() => findOverlappingLeaves(allRequests, draft), [allRequests, draft]);

  // Çalışan eşleşmediyse şube bilinmiyor; bakiye/çakışma yanıltıcı olur
  const showBalance = matchedUser !== undefined && selectedType === 'Yıllık';
  const exceedsBalance = showBalance && netDays > balance.remaining;
  const showOverlaps = matchedUser !== undefined && overlaps.length > 0;

  /** Başlangıç bitişi geçerse bitişi de ileri alıyoruz — aralık geçersiz kalmasın */
  const handleStartChange = (date: Date) => {
    setStartDate(date);
    if (endDate < date) setEndDate(date);
    setDateError('');
  };

  const handleEndChange = (date: Date) => {
    setEndDate(date);
    setDateError('');
  };

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setPhone('');
    setEmail('');
    setSelectedType('Yıllık');
    setStartDate(new Date());
    setEndDate(new Date());
    setLeaveAddress('');
    setDateError('');
    setFieldErrors({});
  };

  const handleSubmit = () => {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    let dateMessage = '';
    if (start < today) dateMessage = 'Geçmiş bir tarih için izin kaydı oluşturamazsın.';
    else if (endDate < startDate) dateMessage = 'Bitiş tarihi başlangıçtan önce olamaz.';

    const nextFieldErrors = {
      firstName: validateFirstName(firstName),
      lastName: validateLastName(lastName),
      phone: validatePhone(phone),
      email: validateEmail(email),
      leaveAddress: validateAddress(leaveAddress),
    };

    setDateError(dateMessage);
    setFieldErrors(nextFieldErrors);

    const hasError =
      dateMessage !== '' || Object.values(nextFieldErrors).some((m) => m !== undefined);
    if (hasError) return;

    const name = `${firstName.trim()} ${lastName.trim()}`;
    const isEmergency = selectedType === 'Acil';

    // Store'a ekle — iş kuralları store içinde uygulanır:
    //   - Acil → AUTO_APPROVED
    //   - Admin oluşturma → APPROVED
    addRequest({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      branch: resolvedBranch,
      leaveType: selectedType,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      netDays,
      description: `Admin tarafından oluşturuldu. İzin adresi: ${leaveAddress.trim()}`,
      createdByAdmin: true,
    });

    resetForm();

    showToast({
      message: `${name} adına ${netDays} günlük ${selectedType} izni oluşturuldu.`,
      tone: isEmergency ? 'danger' : 'success',
    });
  };

  const divider = <View style={[styles.divider, { backgroundColor: colors.border }]} />;

  return (
    <Screen wide>
      <View style={styles.page}>
        <View style={styles.header}>
          <ThemedText type="title">Çalışan İzin Yaz</ThemedText>
          <ThemedText style={[styles.pageSubtitle, { color: colors.textMuted }]}>
            Çalışan adına izin kaydı oluştur — kayıt onay beklemeden işlenir.
          </ThemedText>
        </View>

        <Animated.View entering={FadeInDown.duration(280).springify().damping(18)}>
          <Card>
            {/* ── Çalışan Bilgileri ───────────────────────────────── */}
            <View style={styles.section}>
              <SectionHeader
                icon="user"
                title="Çalışan Bilgileri"
                subtitle="İzin kimin adına oluşturulacak?"
              />

              <View style={[styles.fieldRow, stackFields && styles.fieldRowStacked]}>
                <View style={stackFields ? undefined : styles.field}>
                  <LabeledInput
                    label="İsim"
                    placeholder="Örn: Ahmet"
                    maxLength={LIMITS.firstName}
                    value={firstName}
                    error={fieldErrors.firstName}
                    onChangeText={(text) => {
                      setFirstName(text);
                      if (fieldErrors.firstName) {
                        setFieldErrors((p) => ({ ...p, firstName: undefined }));
                      }
                    }}
                  />
                </View>
                <View style={stackFields ? undefined : styles.field}>
                  <LabeledInput
                    label="Soyisim"
                    placeholder="Örn: Kaya"
                    maxLength={LIMITS.lastName}
                    value={lastName}
                    error={fieldErrors.lastName}
                    onChangeText={(text) => {
                      setLastName(text);
                      if (fieldErrors.lastName) {
                        setFieldErrors((p) => ({ ...p, lastName: undefined }));
                      }
                    }}
                  />
                </View>
              </View>

              <View style={[styles.fieldRow, stackFields && styles.fieldRowStacked]}>
                <View style={stackFields ? undefined : styles.field}>
                  <LabeledInput
                    label="Telefon numarası"
                    placeholder="Örn: 05XX XXX XX XX"
                    keyboardType="phone-pad"
                    maxLength={LIMITS.phone}
                    value={phone}
                    error={fieldErrors.phone}
                    onChangeText={(text) => {
                      setPhone(text);
                      if (fieldErrors.phone) setFieldErrors((p) => ({ ...p, phone: undefined }));
                    }}
                    onBlur={() => {
                      const normalized = normalizePhone(phone);
                      setPhone(normalized);
                      // Boşsa sessiz kalır; "boş bırakılamaz" gönderimde çıkar
                      setFieldErrors((p) => ({ ...p, phone: validatePhoneFormat(normalized) }));
                    }}
                  />
                </View>
                <View style={stackFields ? undefined : styles.field}>
                  <LabeledInput
                    label="E-posta adresi"
                    placeholder="Örn: ahmet.kaya@sirket.com"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    maxLength={LIMITS.email}
                    value={email}
                    error={fieldErrors.email}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
                    }}
                    onBlur={() =>
                      setFieldErrors((p) => ({ ...p, email: validateEmailFormat(email) }))
                    }
                  />
                </View>
              </View>

              {/* Şube sorulmaz — e-posta eşleşirse çalışanın şubesinden okunur */}
              {matchedUser ? (
                <Notice
                  icon="check-circle"
                  color={colors.success}
                  text={`Kayıtlı çalışan · ${resolvedBranch}`}
                />
              ) : isValidEmail(email) ? (
                <Notice
                  icon="alert-circle"
                  color={colors.warning}
                  text="Bu e-posta ile kayıtlı çalışan yok — izin kaydı şubesiz oluşturulacak."
                />
              ) : null}
            </View>

            {divider}

            {/* ── İzin Bilgileri ──────────────────────────────────── */}
            <View style={styles.section}>
              <SectionHeader
                icon="calendar"
                title="İzin Bilgileri"
                subtitle="Tür, tarih aralığı ve izin adresi"
              />

              <View>
                <ThemedText style={[styles.label, { color: colors.textMuted }]}>
                  İzin kategorisi
                </ThemedText>
                <View style={styles.chipRow}>
                  {LEAVE_TYPES.map((type) => {
                    const active = selectedType === type;
                    return (
                      <Pressable
                        key={type}
                        onPress={() => setSelectedType(type)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: active ? colors.primary : 'transparent',
                            borderColor: active ? colors.primary : colors.border,
                          },
                        ]}>
                        <ThemedText
                          style={[
                            styles.chipText,
                            {
                              color: active ? '#fff' : colors.text,
                              fontWeight: active ? '600' : '400',
                            },
                          ]}>
                          {leaveTypeEmoji(type)} {type}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {selectedType === 'Acil' && (
                <Notice
                  icon="alert-triangle"
                  color={colors.danger}
                  text="Acil izinler kaydedildiği anda sistem tarafından otomatik onaylanır."
                />
              )}

              <View style={[styles.fieldRow, stackFields && styles.fieldRowStacked]}>
                <View style={stackFields ? undefined : styles.field}>
                  <ThemedText style={[styles.label, { color: colors.textMuted }]}>
                    Başlangıç
                  </ThemedText>
                  <DateField
                    value={startDate}
                    minimumDate={today}
                    onChange={handleStartChange}
                    borderColor={colors.border}
                  />
                </View>
                <View style={stackFields ? undefined : styles.field}>
                  <ThemedText style={[styles.label, { color: colors.textMuted }]}>Bitiş</ThemedText>
                  <DateField
                    value={endDate}
                    minimumDate={startDate}
                    onChange={handleEndChange}
                    borderColor={colors.border}
                  />
                </View>
              </View>

              {/* Tam genişlik kutu yerine tek satırlık özet */}
              <View style={styles.netDaysRow}>
                <Feather name="clock" size={13} color={colors.textMuted} />
                <ThemedText style={[styles.netDaysText, { color: colors.textMuted }]}>
                  Hafta sonları hariç
                </ThemedText>
                <View style={[styles.dayPill, { backgroundColor: colors.primarySoft }]}>
                  <ThemedText style={[styles.dayPillText, { color: colors.primary }]}>
                    {netDays} gün
                  </ThemedText>
                </View>
              </View>

              {dateError !== '' && (
                <Notice icon="alert-circle" color={colors.danger} text={dateError} />
              )}

              {showBalance && (
                <BalanceBar
                  balance={balance}
                  label="Çalışanın yıllık bakiyesi"
                  hint={
                    netDays > 0
                      ? `Bu kayıt ${netDays} gün düşecek → ${Math.max(balance.remaining - netDays, 0)} gün kalır`
                      : undefined
                  }
                />
              )}

              {exceedsBalance && (
                <Notice
                  icon="alert-triangle"
                  color={colors.danger}
                  text={`Bu kayıt çalışanın kalan bakiyesini ${netDays - balance.remaining} gün aşıyor.`}
                />
              )}

              {showOverlaps && (
                <Notice
                  icon="users"
                  color={colors.warning}
                  text={`Aynı tarihlerde ${resolvedBranch} şubesinden ${overlaps.length} kişi daha izinli.`}
                />
              )}

              <LabeledInput
                label="İzinde bulunacağı adres"
                placeholder="İzin süresince bulunacağı adres"
                multiline
                maxLength={LIMITS.leaveAddress}
                value={leaveAddress}
                error={fieldErrors.leaveAddress}
                onChangeText={(text) => {
                  setLeaveAddress(text);
                  if (fieldErrors.leaveAddress) {
                    setFieldErrors((p) => ({ ...p, leaveAddress: undefined }));
                  }
                }}
                style={styles.textArea}
              />
            </View>

            {divider}

            {/* ── Aksiyon şeridi ──────────────────────────────────── */}
            <View style={styles.section}>
              <View style={[styles.footer, stackFields && styles.footerStacked]}>
                <View style={[styles.footerHint, styles.grow]}>
                  <Feather name="info" size={14} color={colors.textFaint} />
                  <ThemedText style={[styles.footerHintText, { color: colors.textFaint }]}>
                    Admin tarafından oluşturulan izinler onay beklemeden kaydedilir.
                  </ThemedText>
                </View>

                <View style={styles.footerActions}>
                  <View style={stackFields ? styles.footerButtonFlex : styles.footerButton}>
                    <Button label="Formu Temizle" onPress={resetForm} variant="ghost" />
                  </View>
                  <View style={stackFields ? styles.footerButtonFlex : styles.footerButton}>
                    <Button label="Talebi Oluştur" onPress={handleSubmit} />
                  </View>
                </View>
              </View>
            </View>
          </Card>
        </Animated.View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },

  /* ── Sayfa ──────────────────────────────────────────────── */
  // Tek kart: form genişliği okunur bir ölçüde sabitlenip ortalanır
  page: {
    width: '100%',
    maxWidth: 820,
    alignSelf: 'center',
    gap: Space.md,
  },
  header: {
    marginTop: Space.sm,
    gap: Space.xs,
  },
  pageSubtitle: {
    fontSize: 14,
  },

  /* ── Kart içi bölümler ──────────────────────────────────── */
  section: {
    gap: Space.sm,
  },
  // Kartın iki yakasına kadar uzanan ayıraç (kart dolgusunu negatifle telafi eder)
  divider: {
    height: 1,
    marginHorizontal: -Space.xl,
    marginVertical: Space.sm,
  },

  /* ── Alan satırları — iki eşit kolon ────────────────────── */
  fieldRow: {
    flexDirection: 'row',
    gap: Space.md,
    alignItems: 'flex-start',
  },
  fieldRowStacked: {
    flexDirection: 'column',
    gap: Space.sm,
  },
  // Yalnızca satır düzeninde uygulanır — flex:1 (RN'de flexBasis:0) iki kolonu
  // içerikten bağımsız olarak tam eşit böler.
  field: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: Space.xs,
  },
  textArea: {
    minHeight: 72,
    textAlignVertical: 'top',
  },

  /* ── İzin türü çipleri ──────────────────────────────────── */
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  chip: {
    flex: 1,
    minWidth: 140,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
  },
  chipText: {
    fontSize: 14,
  },

  /* ── Net gün satırı ─────────────────────────────────────── */
  netDaysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  netDaysText: {
    flex: 1,
    fontSize: 13,
  },
  dayPill: {
    paddingHorizontal: Space.md,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  dayPillText: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* ── Aksiyon şeridi ─────────────────────────────────────── */
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.lg,
  },
  footerStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: Space.md,
  },
  footerHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  footerHintText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  footerActions: {
    flexDirection: 'row',
    gap: Space.md,
  },
  footerButton: {
    width: 168,
  },
  footerButtonFlex: {
    flex: 1,
  },
});
