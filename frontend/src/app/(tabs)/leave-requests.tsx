import Feather from '@expo/vector-icons/Feather';
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { DateField } from '@/components/date-field';
import { ThemedText } from '@/components/themed-text';
import { BalanceBar } from '@/components/ui/balance-bar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { LabeledInput } from '@/components/ui/labeled-input';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Radius, Shadow, Space } from '@/constants/design';
import { LEAVE_TYPES, leaveTypeEmoji, statusMeta } from '@/constants/leave';
import { useDesign } from '@/hooks/use-design';
import { DEFAULT_LEAVE_DAYS } from '@/services/branches';
import { useAuthStore } from '@/store/authStore';
import {
  calculateLeaveBalance,
  sortOwnRequests,
  useLeaveRequestsStore,
} from '@/store/leaveRequestsStore';
import { showToast } from '@/store/toastStore';
import { countNetWeekdays, formatDate } from '@/utils/date';
import { normalizePhone } from '@/utils/phone';

import type { LeaveRequest, LeaveType } from '@/store/leaveRequestsStore';

const PHONE_REGEX = /^(\+90|0)?5\d{9}$/;

// Karakter limitleri
const LIMITS = {
  description: 150,
  emergencyContact: 15,
  leaveAddress: 200,
} as const;

/** Taslak talebin bakiye/çakışma hesaplarında kullandığı geçici kimlik */
const DRAFT_ID = '__draft__';

type Tab = 'new' | 'mine';

function isValidPhone(phone: string) {
  const cleaned = phone.replace(/[\s()-]/g, '');
  return PHONE_REGEX.test(cleaned);
}

// ─── Alan doğrulayıcıları ─────────────────────────────────────────
// "Boş bırakılamaz" uyarıları SADECE gönderimde çıkar. Alanlar arasında
// gezerken henüz doldurmadığın her alan için kırmızı mesaj görmek rahatsız
// ediciydi. onBlur'da yalnızca BİÇİM hatası (dolu ama geçersiz) gösteriliyor.

/** onBlur: dolu ama hatalı numarayı anında söyler, boş alana karışmaz */
function validatePhoneFormat(value: string) {
  if (value.trim().length === 0) return undefined;
  return isValidPhone(value) ? undefined : 'Geçerli bir numara gir (örn: 05XX XXX XX XX).';
}

function validateDescription(value: string) {
  return value.trim().length === 0 ? 'Açıklama boş bırakılamaz.' : undefined;
}

function validatePhone(value: string) {
  if (value.trim().length === 0) return 'Acil durum iletişimi boş bırakılamaz.';
  return validatePhoneFormat(value);
}

function validateAddress(value: string) {
  return value.trim().length === 0 ? 'İzinde bulunacağın adres boş bırakılamaz.' : undefined;
}

// ─── Kendi talep kartı ────────────────────────────────────────────
function MyRequestCard({ item, index }: { item: LeaveRequest; index: number }) {
  const { colors } = useDesign();
  const meta = statusMeta(item.status);

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 6) * 50)
        .duration(280)
        .springify()
        .damping(18)}
      layout={LinearTransition.springify().damping(18)}
      style={[
        styles.myCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
        Shadow.card,
      ]}>
      <View style={[styles.statusStripe, { backgroundColor: meta.color }]} />

      <View style={styles.myCardHead}>
        <View style={[styles.typeBadge, { backgroundColor: colors.primarySoft }]}>
          <ThemedText style={[styles.typeBadgeText, { color: colors.primary }]}>
            {leaveTypeEmoji(item.leaveType)} {item.leaveType}
          </ThemedText>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${meta.color}18` }]}>
          <Feather name={meta.icon} size={12} color={meta.color} />
          {/* "Otomatik Onaylandı" uzun; dar kartta ikondan kopup alt satıra düşmesin */}
          <ThemedText style={[styles.statusBadgeText, { color: meta.color }]} numberOfLines={1}>
            {meta.label}
          </ThemedText>
        </View>
      </View>

      <View style={styles.myCardDates}>
        <Feather name="calendar" size={13} color={colors.textFaint} />
        <ThemedText style={[styles.myCardDateText, { color: colors.text }]} numberOfLines={1}>
          {item.startDate} → {item.endDate}
        </ThemedText>
        <View style={[styles.dayPill, { backgroundColor: colors.primarySoft }]}>
          <ThemedText style={[styles.dayPillText, { color: colors.primary }]}>
            {item.netDays} gün
          </ThemedText>
        </View>
      </View>

      <ThemedText style={[styles.myCardDescription, { color: colors.textMuted }]} numberOfLines={2}>
        {item.description}
      </ThemedText>

      {item.status === 'REJECTED' && item.rejectionReason && (
        <View style={[styles.rejectionBox, { backgroundColor: `${colors.danger}12` }]}>
          <ThemedText style={[styles.rejectionLabel, { color: colors.danger }]}>
            Ret nedeni
          </ThemedText>
          <ThemedText style={[styles.rejectionText, { color: colors.textMuted }]}>
            {item.rejectionReason}
          </ThemedText>
        </View>
      )}

      {item.processedAt && (
        <ThemedText style={[styles.processedAt, { color: colors.textFaint }]}>
          İşlem: {item.processedAt}
        </ThemedText>
      )}
    </Animated.View>
  );
}

// ─── Ekran ────────────────────────────────────────────────────────
export default function LeaveRequestsScreen() {
  const { colors } = useDesign();
  const { width } = useWindowDimensions();
  const stackFields = width < 640; // ikili alanlar dar ekranda alt alta
  /**
   * Telefon boyutu. Bu ekranı personel yalnızca mobilde kullanıyor; burada
   * yatay dolgular daraltılıp alanlara yer açılıyor (24+24 = 48px'lik kenar
   * boşluğu 320-430px'lik ekranda formu belirgin şekilde sıkıştırıyordu).
   */
  const compact = width < 480;

  const [tab, setTab] = useState<Tab>('new');

  const createRequest = useLeaveRequestsStore((s) => s.createRequest);
  const mine = useLeaveRequestsStore((s) => s.mine);
  const fetchMine = useLeaveRequestsStore((s) => s.fetchMine);
  const loadingMine = useLeaveRequestsStore((s) => s.loadingMine);
  const mineError = useLeaveRequestsStore((s) => s.mineError);
  const authUser = useAuthStore((s) => s.user);

  // Talepler sunucudan gelir (GET /api/LeaveRequests/my)
  useEffect(() => {
    void fetchMine();
  }, [fetchMine]);

  const [selectedType, setSelectedType] = useState<LeaveType>('Yıllık');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [description, setDescription] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [leaveAddress, setLeaveAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [dateError, setDateError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    description?: string;
    emergencyContact?: string;
    leaveAddress?: string;
  }>({});

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const netDays = countNetWeekdays(startDate, endDate);

  /** Yıllık izin hakkı /api/Users/me'den gelir; yoksa sistem varsayılanı */
  const entitlement = authUser?.entitlement ?? DEFAULT_LEAVE_DAYS;

  const myRequests = useMemo(() => sortOwnRequests(mine), [mine]);

  /** Bakiye hesabı henüz kaydedilmemiş talep üzerinden yapılır */
  const draft = useMemo<LeaveRequest>(
    () => ({
      id: DRAFT_ID,
      userId: authUser?.id ?? '',
      branchId: authUser?.branchId ?? '',
      firstName: '',
      lastName: '',
      branch: authUser?.branchName ?? '',
      annualLeaveCount: entitlement,
      leaveType: selectedType,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      netDays,
      description: '',
      status: 'PENDING',
    }),
    [authUser, entitlement, selectedType, startDate, endDate, netDays],
  );

  const balance = useMemo(
    () => calculateLeaveBalance(mine, draft, entitlement),
    [mine, draft, entitlement],
  );

  // Backend izin limitini tüm onaylı türler üzerinden düşer; bakiye şeridi
  // yine de öncelikle yıllık izinde gösterilir (diğerleri istisnai durumlar)
  const consumesBalance = selectedType === 'Yıllık';
  const afterRequest = Math.max(balance.remaining - netDays, 0);
  const exceedsBalance = consumesBalance && netDays > balance.remaining;

  // ── Tarih davranışı ────────────────────────────────────────────
  /** Başlangıç bitişi geçerse bitişi de ileri alıyoruz — aralık hiç geçersiz kalmasın */
  const handleStartChange = (date: Date) => {
    setStartDate(date);
    if (endDate < date) setEndDate(date);
    setDateError('');
  };

  const handleEndChange = (date: Date) => {
    setEndDate(date);
    setDateError('');
  };

  // ── Form ───────────────────────────────────────────────────────
  const resetForm = () => {
    setSelectedType('Yıllık');
    setStartDate(new Date());
    setEndDate(new Date());
    setDescription('');
    setEmergencyContact('');
    setLeaveAddress('');
    setDateError('');
    setFieldErrors({});
  };

  const handleSubmit = async () => {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    let dateMessage = '';
    if (start < today) dateMessage = 'Geçmiş bir tarih için izin talebi oluşturamazsın.';
    else if (endDate < startDate) dateMessage = 'Bitiş tarihi başlangıçtan önce olamaz.';

    const nextFieldErrors = {
      description: validateDescription(description),
      emergencyContact: validatePhone(emergencyContact),
      leaveAddress: validateAddress(leaveAddress),
    };

    setDateError(dateMessage);
    setFieldErrors(nextFieldErrors);

    const hasError =
      dateMessage !== '' || Object.values(nextFieldErrors).some((m) => m !== undefined);
    if (hasError || submitting) return;

    setSubmitting(true);
    const result = await createRequest({
      leaveType: selectedType,
      startDate,
      endDate,
      description: description.trim(),
      emergencyContact: normalizePhone(emergencyContact),
      leaveAddress: leaveAddress.trim(),
    });
    setSubmitting(false);

    // Sunucu reddederse (tarih çakışması, iş günü yok vb.) form olduğu
    // gibi kalır — kullanıcı düzeltip tekrar gönderebilsin.
    if (!result.ok) {
      setDateError(result.message ?? 'Talep oluşturulamadı.');
      return;
    }

    const created = result.request!;
    resetForm();
    // Gönderdikten sonra listeye geçiyoruz: talep gerçekten kaydedildi mi
    // sorusunun cevabı hemen ekranda olsun.
    setTab('mine');

    if (created.status === 'REJECTED') {
      // Backend limit aşımını kayıt anında reddeder (kayıt yine oluşur)
      showToast({
        message: created.rejectionReason ?? 'Talep, izin hakkını aştığı için reddedildi.',
        tone: 'danger',
      });
    } else {
      showToast({
        message:
          created.status === 'AUTO_APPROVED'
            ? `${created.netDays} günlük acil izin oluşturuldu ve otomatik onaylandı.`
            : `${created.netDays} günlük ${created.leaveType} talebin onaya gönderildi.`,
        tone: created.status === 'AUTO_APPROVED' ? 'danger' : 'success',
      });
    }
  };

  const balanceStrip = (
    <BalanceBar
      balance={balance}
      label="Yıllık izin bakiyen"
      variant="card"
      hint={
        tab === 'new' && consumesBalance && netDays > 0
          ? `Bu talep ${netDays} gün düşecek → ${afterRequest} gün kalır`
          : undefined
      }
    />
  );

  return (
    <Screen scroll={false}>
      <View style={[styles.headerWrap, compact && styles.headerWrapCompact]}>
        <View style={styles.titleBlock}>
          <ThemedText type="title">İzinlerim</ThemedText>
          {/* Telefonda alt başlık atlanıyor — hemen altındaki sekmeler zaten
              aynı şeyi söylüyor, ekranın üstünü boşuna dolduruyordu */}
          {!compact && (
            <ThemedText style={[styles.pageSubtitle, { color: colors.textMuted }]}>
              Yeni talep oluştur veya mevcut taleplerini takip et.
            </ThemedText>
          )}
        </View>

        {balanceStrip}

        <SegmentedTabs
          tabs={[
            { key: 'new', label: 'Yeni Talep' },
            { key: 'mine', label: 'Taleplerim', badge: myRequests.length },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {tab === 'new' ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.formContent, compact && styles.contentCompact]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator>
          {/* Tek uzun kart yerine ayrı bloklar: telefonda ekrana zaten bir kart
              sığıyor, kart içi ayıraçlar bölümleri belli etmiyordu */}
          <Card style={compact ? styles.cardCompact : undefined}>
            {/* ── İzin Bilgileri ─────────────────────────────── */}
            <View style={styles.section}>
              <SectionHeader
                icon="calendar"
                title="İzin Bilgileri"
                subtitle="Tür ve tarih aralığı"
              />

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

              {/* Acil izin onay sürecini tamamen atlıyor — talebi gönderen bunu bilmeli */}
              {selectedType === 'Acil' && (
                <Notice
                  icon="alert-triangle"
                  color={colors.danger}
                  text="Acil izinler onaya düşmez; kaydedildiği anda sistem tarafından otomatik onaylanır."
                />
              )}

              {/* Tarihler her ekran boyutunda yan yana: aralık ancak ikisi bir
                  arada görününce okunuyor, alt alta olunca bağ kopuyordu */}
              <View style={[styles.fieldRow, compact && styles.fieldRowTight]}>
                <View style={styles.field}>
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
                <View style={styles.field}>
                  <ThemedText style={[styles.label, { color: colors.textMuted }]}>
                    Bitiş
                  </ThemedText>
                  <DateField
                    value={endDate}
                    minimumDate={startDate}
                    onChange={handleEndChange}
                    borderColor={colors.border}
                  />
                </View>
              </View>

              {/* Eski tam genişlik banner yerine tek satırlık özet */}
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

              {exceedsBalance && (
                <Notice
                  icon="alert-triangle"
                  color={colors.danger}
                  text={`Bu talep kalan bakiyeni ${netDays - balance.remaining} gün aşıyor.`}
                />
              )}

            </View>
          </Card>

          <Card style={compact ? styles.cardCompact : undefined}>
            {/* ── Detaylar ───────────────────────────────────── */}
            <View style={styles.section}>
              <SectionHeader
                icon="file-text"
                title="Detaylar"
                subtitle="Açıklama, adres ve acil durum iletişimi"
              />

              <View style={[styles.fieldRow, stackFields && styles.fieldRowStacked]}>
                <View style={stackFields ? undefined : styles.field}>
                  <LabeledInput
                    label="Açıklama"
                    placeholder="İzin sebebini kısaca yaz"
                    multiline
                    maxLength={LIMITS.description}
                    value={description}
                    error={fieldErrors.description}
                    onChangeText={(text) => {
                      setDescription(text);
                      if (fieldErrors.description) {
                        setFieldErrors((p) => ({ ...p, description: undefined }));
                      }
                    }}
                    style={styles.textArea}
                  />
                </View>
                <View style={stackFields ? undefined : styles.field}>
                  <LabeledInput
                    label="İzinde bulunacağın adres"
                    placeholder="İzin süresince bulunacağın adres"
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
              </View>

              {/* Üstteki iki alanın toplam genişliği boyunca uzanır.
                  Telefonda kutu yüksekliği de diğer ikisiyle eşitleniyor —
                  tek satırlık alan kısa kalınca bölüm dağınık duruyordu. */}
              <View>
                <LabeledInput
                  label="Acil durum iletişim"
                  placeholder="05XX XXX XX XX"
                  keyboardType="phone-pad"
                  style={compact ? styles.compactBox : undefined}
                  maxLength={LIMITS.emergencyContact}
                  value={emergencyContact}
                  error={fieldErrors.emergencyContact}
                  onChangeText={(text) => {
                    setEmergencyContact(text);
                    if (fieldErrors.emergencyContact) {
                      setFieldErrors((p) => ({ ...p, emergencyContact: undefined }));
                    }
                  }}
                  onBlur={() => {
                    const normalized = normalizePhone(emergencyContact);
                    setEmergencyContact(normalized);
                    // Boşsa sessiz kalır; "boş bırakılamaz" gönderimde çıkar
                    setFieldErrors((p) => ({
                      ...p,
                      emergencyContact: validatePhoneFormat(normalized),
                    }));
                  }}
                />
              </View>
            </View>
          </Card>

          {/* ── Aksiyon satırı ───────────────────────────────── */}
          <Card style={compact ? styles.cardCompact : undefined}>
            <View style={[styles.formFooter, stackFields && styles.formFooterStacked]}>
              <View style={styles.footerSummary}>
                <ThemedText style={[styles.footerSummaryLabel, { color: colors.textMuted }]}>
                  Talep özeti
                </ThemedText>
                <ThemedText style={[styles.footerSummaryValue, { color: colors.text }]}>
                  {leaveTypeEmoji(selectedType)} {selectedType} · {netDays} gün
                </ThemedText>
              </View>

              {compact ? (
                // Telefonda yan yana iki düğme dar kalıyor — asıl eylem üstte,
                // tam genişlikte; temizle altında ikincil olarak duruyor
                <View style={styles.footerActionsStacked}>
                  <Button label="Talebi Gönder" onPress={handleSubmit} loading={submitting} />
                  <Button label="Formu Temizle" onPress={resetForm} variant="ghost" />
                </View>
              ) : (
                <View style={styles.footerActions}>
                  <View style={stackFields ? styles.footerButtonFlex : styles.footerButton}>
                    <Button label="Formu Temizle" onPress={resetForm} variant="ghost" />
                  </View>
                  <View style={stackFields ? styles.footerButtonFlex : styles.footerButton}>
                    <Button label="Talebi Gönder" onPress={handleSubmit} loading={submitting} />
                  </View>
                </View>
              )}
            </View>
          </Card>
        </ScrollView>
      ) : (
        <FlatList
          data={myRequests}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => <MyRequestCard item={item} index={index} />}
          style={styles.flex}
          contentContainerStyle={[styles.listContent, compact && styles.contentCompact]}
          refreshControl={
            <RefreshControl refreshing={loadingMine} onRefresh={() => void fetchMine()} />
          }
          ListHeaderComponent={
            mineError ? (
              <Notice icon="alert-circle" color={colors.danger} text={mineError} />
            ) : undefined
          }
          ListEmptyComponent={
            loadingMine ? null : (
              <EmptyState
                icon="calendar"
                title="Henüz talebin yok"
                description="Oluşturduğun izin talepleri ve durumları burada listelenir."
              />
            )
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  /* ── Sabit başlık ───────────────────────────────────────── */
  headerWrap: {
    width: '100%',
    maxWidth: 820,
    alignSelf: 'center',
    paddingHorizontal: Space.xl,
    paddingTop: Space.xl,
    paddingBottom: Space.sm,
    gap: Space.md,
  },
  titleBlock: {
    gap: Space.xs,
  },
  pageSubtitle: {
    fontSize: 14,
  },

  /* ── Telefon ölçüleri ───────────────────────────────────── */
  // Kenar boşlukları 24 → 16: alanlara her yandan 8px yer açılıyor
  headerWrapCompact: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.lg,
    gap: Space.sm,
  },
  contentCompact: {
    paddingHorizontal: Space.lg,
  },
  cardCompact: {
    padding: Space.lg,
  },

  /* ── Form ───────────────────────────────────────────────── */
  formContent: {
    width: '100%',
    maxWidth: 820,
    alignSelf: 'center',
    paddingHorizontal: Space.xl,
    paddingTop: Space.xs,
    paddingBottom: Space.xl,
    gap: Space.md,
  },
  section: {
    gap: Space.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: Space.xs,
  },
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
  // Telefonda yan yana duran alanlara aradan biraz daha yer açar
  fieldRowTight: {
    gap: Space.sm,
  },
  // flex:1 (RN'de flexBasis:0) iki kolonu içerikten bağımsız eşit böler
  field: {
    flex: 1,
    minWidth: 0,
  },
  textArea: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  // Tek satırlık alanı çok satırlılarla aynı yükseklikte tutar; metin
  // ortada kalsın diye hizalama açıkça veriliyor (Android varsayılanı üst)
  compactBox: {
    minHeight: 72,
    textAlignVertical: 'center',
  },

  /* ── İzin türü çipleri ──────────────────────────────────── */
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  chip: {
    flex: 1,
    // 120: küçük telefonlarda (320px) da 2'şerli ızgara bozulmasın diye.
    // flex:1 olduğu için geniş ekranda çipler yine satırı doldurup büyüyor.
    minWidth: 120,
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

  /* ── Kart içi aksiyon satırı ────────────────────────────── */
  formFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.lg,
  },
  formFooterStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: Space.md,
  },
  footerSummary: {
    flex: 1,
    gap: 2,
  },
  footerSummaryLabel: {
    fontSize: 11,
  },
  footerSummaryValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  footerActions: {
    flexDirection: 'row',
    gap: Space.md,
  },
  footerActionsStacked: {
    gap: Space.sm,
  },
  footerButton: {
    width: 168,
  },
  footerButtonFlex: {
    flex: 1,
  },

  /* ── Taleplerim listesi ─────────────────────────────────── */
  listContent: {
    width: '100%',
    maxWidth: 820,
    alignSelf: 'center',
    paddingHorizontal: Space.xl,
    paddingTop: Space.xs,
    paddingBottom: Space.xxl,
    gap: Space.md,
  },
  myCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Space.lg,
    gap: Space.sm,
    overflow: 'hidden',
  },
  statusStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  myCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  typeBadge: {
    paddingHorizontal: Space.md,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Space.md,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    // Uzun durum etiketi kartı zorlamak yerine rozeti daraltsın
    flexShrink: 1,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  myCardDates: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  myCardDateText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  myCardDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  rejectionBox: {
    borderRadius: Radius.sm,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    gap: 2,
  },
  rejectionLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  rejectionText: {
    fontSize: 13,
    lineHeight: 18,
  },
  processedAt: {
    fontSize: 11,
  },
});
