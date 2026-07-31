import Feather from '@expo/vector-icons/Feather';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { DateField } from '@/components/date-field';
import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
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
import type { AppUser } from '@/store/usersStore';

const PHONE_REGEX = /^(\+90|0)?5\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Karakter limitleri
const LIMITS = {
  phone: 15,
  email: 60,
  leaveAddress: 200,
} as const;

// Şube formda sorulmaz; eşleşen çalışanın şubesi silinmişse bu etiket yazılır
const UNKNOWN_BRANCH = 'Şube atanmamış';

/** Bakiye/çakışma hesaplarında kullanılan, henüz kaydedilmemiş talebin kimliği */
const DRAFT_ID = '__draft__';

/**
 * Bu genişlikten itibaren ekran "solda form / sağda canlı özet" düzenine geçer.
 * Altında form tek kolon karta düşer (dar tarayıcı penceresi için).
 */
const SPLIT_MIN_WIDTH = 1000;
const SUMMARY_PANE_WIDTH = 340;

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

function validatePhone(value: string) {
  if (value.trim().length === 0) return 'Telefon numarası boş bırakılamaz.';
  return validatePhoneFormat(value);
}

/**
 * İsim/soyisim artık formda sorulmuyor — kayda yazılacak ad yalnızca eşleşen
 * çalışandan okunabildiği için e-posta kayıtlı bir çalışanı bulmak ZORUNDA.
 */
function validateEmail(value: string, matched: AppUser | undefined) {
  if (value.trim().length === 0) return 'E-posta adresi boş bırakılamaz.';
  const format = validateEmailFormat(value);
  if (format) return format;
  return matched ? undefined : 'Bu e-posta ile kayıtlı bir çalışan bulunamadı.';
}

function validateAddress(value: string) {
  return value.trim().length === 0 ? 'İzinde bulunacağı adres boş bırakılamaz.' : undefined;
}

/** Özet panelindeki tek satır — solda etiket, sağda değer */
function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  const { colors } = useDesign();

  return (
    <View style={styles.summaryRow}>
      <ThemedText style={[styles.summaryLabel, { color: colors.textMuted }]}>{label}</ThemedText>
      <ThemedText
        style={[
          styles.summaryValue,
          strong ? styles.summaryValueStrong : null,
          { color: strong ? colors.primary : colors.text },
        ]}
        numberOfLines={1}>
        {value}
      </ThemedText>
    </View>
  );
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

  /** Geniş ekranda form + özet paneli, dar ekranda tek kolon kart */
  const split = width >= SPLIT_MIN_WIDTH;
  const stackFields = width < 640; // ikili alanlar dar ekranda alt alta

  // Çalışan bilgileri — isim/soyisim sorulmaz, e-posta eşleşmesinden okunur
  const [email, setEmail] = useState('');

  // İzin bilgileri
  const [selectedType, setSelectedType] = useState<LeaveType>('Yıllık');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [leaveAddress, setLeaveAddress] = useState('');
  const [phone, setPhone] = useState('');

  const [dateError, setDateError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
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
      firstName: matchedUser?.firstName ?? '',
      lastName: matchedUser?.lastName ?? '',
      branch: resolvedBranch,
      leaveType: selectedType,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      netDays,
      description: '',
      status: 'PENDING',
    }),
    [matchedUser, resolvedBranch, selectedType, startDate, endDate, netDays],
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
      phone: validatePhone(phone),
      email: validateEmail(email, matchedUser),
      leaveAddress: validateAddress(leaveAddress),
    };

    setDateError(dateMessage);
    setFieldErrors(nextFieldErrors);

    const hasError =
      dateMessage !== '' || Object.values(nextFieldErrors).some((m) => m !== undefined);
    // matchedUser kontrolü validateEmail içinde de var; burada tip daraltmak için
    if (hasError || !matchedUser) return;

    const name = `${matchedUser.firstName} ${matchedUser.lastName}`;
    const isEmergency = selectedType === 'Acil';

    // Store'a ekle — iş kuralları store içinde uygulanır:
    //   - Acil → AUTO_APPROVED
    //   - Admin oluşturma → APPROVED
    addRequest({
      firstName: matchedUser.firstName,
      lastName: matchedUser.lastName,
      branch: resolvedBranch,
      leaveType: selectedType,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      netDays,
      // Telefon artık izin bilgisi — kayıtta durmazsa girilmesinin anlamı kalmıyor
      description: `Admin tarafından oluşturuldu. İzin adresi: ${leaveAddress.trim()} · İletişim: ${phone.trim()}`,
      createdByAdmin: true,
    });

    resetForm();

    showToast({
      message: `${name} adına ${netDays} günlük ${selectedType} izni oluşturuldu.`,
      tone: isEmergency ? 'danger' : 'success',
    });
  };

  const divider = <View style={[styles.divider, { backgroundColor: colors.border }]} />;

  // ── Bakiye ve uyarılar ─────────────────────────────────────────
  // Dar ekranda formun içinde akar, geniş ekranda sağdaki özet panelinde
  // toplanır: kullanıcı formu doldururken sonucu hep aynı yerde görür.
  const insights = (
    <>
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
    </>
  );

  // ── Form bölümleri — iki düzende de aynı alanlar ───────────────
  const employeeSection = (
    <View style={styles.section}>
      <SectionHeader
        icon="user"
        title="Çalışan Bilgileri"
        subtitle="Çalışan e-posta adresiyle bulunur"
      />

      {/* İsim/soyisim sorulmaz — eşleşen çalışanın kaydından okunur */}
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
        onBlur={() => setFieldErrors((p) => ({ ...p, email: validateEmailFormat(email) }))}
      />

      {/* Şube de sorulmaz — eşleşen çalışanın şubesinden okunur */}
      {matchedUser ? (
        <View
          style={[
            styles.employeeCard,
            { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
          ]}>
          <Avatar firstName={matchedUser.firstName} lastName={matchedUser.lastName} size={40} />
          <View style={styles.grow}>
            <ThemedText style={[styles.employeeName, { color: colors.text }]} numberOfLines={1}>
              {matchedUser.firstName} {matchedUser.lastName}
            </ThemedText>
            <View style={styles.employeeMetaRow}>
              <Feather name="map-pin" size={11} color={colors.textMuted} />
              <ThemedText
                style={[styles.employeeMeta, { color: colors.textMuted }]}
                numberOfLines={1}>
                {resolvedBranch}
              </ThemedText>
            </View>
          </View>
          <View style={[styles.matchPill, { backgroundColor: `${colors.success}18` }]}>
            <Feather name="check" size={12} color={colors.success} />
            <ThemedText style={[styles.matchPillText, { color: colors.success }]}>
              Eşleşti
            </ThemedText>
          </View>
        </View>
      ) : isValidEmail(email) ? (
        <Notice
          icon="alert-circle"
          color={colors.warning}
          text="Bu e-posta ile kayıtlı çalışan yok — izin yalnızca kayıtlı bir çalışan adına oluşturulabilir."
        />
      ) : null}
    </View>
  );

  const leaveSection = (
    <View style={styles.section}>
      <SectionHeader
        icon="calendar"
        title="İzin Bilgileri"
        subtitle="Tür, tarih aralığı, adres ve iletişim"
      />

      <View>
        <ThemedText style={[styles.label, { color: colors.textMuted }]}>İzin kategorisi</ThemedText>
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
          <ThemedText style={[styles.label, { color: colors.textMuted }]}>Başlangıç</ThemedText>
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

      {dateError !== '' && <Notice icon="alert-circle" color={colors.danger} text={dateError} />}

      {/* Geniş ekranda bunlar sağdaki özet panelinde duruyor */}
      {!split && insights}

      <View style={[styles.fieldRow, stackFields && styles.fieldRowStacked]}>
        <View style={stackFields ? undefined : styles.field}>
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
        {/* İzin süresince ulaşılacak numara — çalışan kimliği değil, izin bilgisi */}
        <View style={stackFields ? undefined : styles.field}>
          <LabeledInput
            label="İletişim telefonu"
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
      </View>
    </View>
  );

  const pageTitle = (
    <View style={styles.header}>
      <ThemedText type="title">Çalışan İzin Yaz</ThemedText>
      <ThemedText style={[styles.pageSubtitle, { color: colors.textMuted }]}>
        Çalışan adına izin kaydı oluştur — kayıt onay beklemeden işlenir.
      </ThemedText>
    </View>
  );

  // ── Geniş ekran: solda form kartları, sağda canlı özet ─────────
  // Özet paneli formla birlikte kaymaz; kaydet düğmesi hep göz önünde.
  const summaryPanel = (
    <Card>
      <View style={styles.summaryHead}>
        <View style={[styles.summaryIcon, { backgroundColor: colors.primarySoft }]}>
          <Feather name="clipboard" size={16} color={colors.primary} />
        </View>
        <ThemedText style={styles.summaryTitle}>Talep Özeti</ThemedText>
      </View>

      {matchedUser ? (
        <View style={styles.summaryEmployee}>
          <Avatar firstName={matchedUser.firstName} lastName={matchedUser.lastName} size={38} />
          <View style={styles.grow}>
            <ThemedText style={[styles.employeeName, { color: colors.text }]} numberOfLines={1}>
              {matchedUser.firstName} {matchedUser.lastName}
            </ThemedText>
            <View style={styles.employeeMetaRow}>
              <Feather name="map-pin" size={11} color={colors.textMuted} />
              <ThemedText
                style={[styles.employeeMeta, { color: colors.textMuted }]}
                numberOfLines={1}>
                {resolvedBranch}
              </ThemedText>
            </View>
          </View>
        </View>
      ) : (
        <View style={[styles.summaryPlaceholder, { borderColor: colors.border }]}>
          <Feather name="user-plus" size={15} color={colors.textFaint} />
          <ThemedText style={[styles.summaryPlaceholderText, { color: colors.textFaint }]}>
            Çalışan henüz seçilmedi
          </ThemedText>
        </View>
      )}

      {divider}

      <SummaryRow label="İzin türü" value={`${leaveTypeEmoji(selectedType)} ${selectedType}`} />
      <SummaryRow label="Başlangıç" value={formatDate(startDate)} />
      <SummaryRow label="Bitiş" value={formatDate(endDate)} />
      <SummaryRow label="Net gün" value={`${netDays} gün`} strong />

      {(showBalance || exceedsBalance || showOverlaps) && divider}
      {insights}

      {divider}

      <Button label="Talebi Oluştur" onPress={handleSubmit} />
      <Button label="Formu Temizle" onPress={resetForm} variant="ghost" />

      <View style={styles.footerHint}>
        <Feather name="info" size={13} color={colors.textFaint} />
        <ThemedText style={[styles.footerHintText, { color: colors.textFaint }]}>
          Admin tarafından oluşturulan izinler onay beklemeden kaydedilir.
        </ThemedText>
      </View>
    </Card>
  );

  const wideLayout = (
    <View style={styles.widePage}>
      {pageTitle}

      <View style={styles.wideSplit}>
        <ScrollView
          style={styles.grow}
          contentContainerStyle={styles.formColumn}
          keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeInDown.duration(280).springify().damping(18)}>
            <Card>{employeeSection}</Card>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(60).duration(280).springify().damping(18)}>
            <Card>{leaveSection}</Card>
          </Animated.View>
        </ScrollView>

        <View style={styles.summaryPane}>
          <ScrollView
            contentContainerStyle={styles.summaryContent}
            showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeInDown.delay(120).duration(280).springify().damping(18)}>
              {summaryPanel}
            </Animated.View>
          </ScrollView>
        </View>
      </View>
    </View>
  );

  // ── Dar ekran: tek kolon, aksiyonlar kartın dibinde ────────────
  const narrowLayout = (
    <View style={styles.page}>
      {pageTitle}

      <Animated.View entering={FadeInDown.duration(280).springify().damping(18)}>
        <Card>
          {employeeSection}

          {divider}

          {leaveSection}

          {divider}

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
  );

  // Geniş düzende kaydırmayı sol kolon üstleniyor — Screen'inki kapalı
  return (
    <Screen scroll={!split} wide>
      {split ? wideLayout : narrowLayout}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },

  /* ── Sayfa ──────────────────────────────────────────────── */
  // Dar ekran: tek kart, okunur bir genişlikte sabitlenip ortalanır
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

  /* ── Geniş ekran düzeni (>= SPLIT_MIN_WIDTH) ─────────────────
     Sayfa ekranın iki yakasına açılır; üst sınır yalnızca ultra geniş
     monitörlerde form alanlarının gereksiz uzamasını engeller. */
  widePage: {
    flex: 1,
    width: '100%',
    maxWidth: 1600,
    alignSelf: 'center',
    paddingHorizontal: Space.xl,
    paddingTop: Space.xl,
    paddingBottom: Space.xl,
    gap: Space.md,
  },
  wideSplit: {
    flex: 1,
    flexDirection: 'row',
    gap: Space.lg,
  },
  formColumn: {
    gap: Space.md,
    paddingBottom: Space.lg,
  },
  summaryPane: {
    width: SUMMARY_PANE_WIDTH,
  },
  summaryContent: {
    paddingBottom: Space.lg,
  },

  /* ── Özet paneli ────────────────────────────────────────── */
  summaryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    marginBottom: Space.xs,
  },
  summaryIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  summaryEmployee: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  summaryPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
  },
  summaryPlaceholderText: {
    fontSize: 13,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.md,
  },
  summaryLabel: {
    fontSize: 13,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  summaryValueStrong: {
    fontSize: 15,
    fontWeight: '700',
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
    // fieldRow'daki flex-start satır düzeni için; kolona dönünce ezilmezse
    // alanlar tam genişliğe uzamayıp içerikleri kadar daralıyor
    alignItems: 'stretch',
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

  /* ── Eşleşen çalışan kartı ──────────────────────────────── */
  // İsim formda yazılmadığı için iznin kime yazıldığı burada doğrulanır
  employeeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
  },
  employeeName: {
    fontSize: 15,
    fontWeight: '700',
  },
  employeeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  employeeMeta: {
    fontSize: 12,
    flexShrink: 1,
  },
  matchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Space.md,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  matchPillText: {
    fontSize: 12,
    fontWeight: '700',
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

  /* ── Aksiyon şeridi (dar ekran) ─────────────────────────── */
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
