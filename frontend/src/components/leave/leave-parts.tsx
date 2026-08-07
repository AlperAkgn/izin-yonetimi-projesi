import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Radius, Space } from '@/constants/design';
import { leaveTypeEmoji } from '@/constants/leave';
import { useDesign } from '@/hooks/use-design';

import type { FeatherName } from '@/components/ui/icon';
import type { LeaveRequest, LeaveType } from '@/store/leaveRequestsStore';
import type { ReactNode } from 'react';

/**
 * İzin Onay ekranının paylaşılan küçük parçaları.
 *
 * Kart, liste satırı ve detay paneli bu parçaların üçünü de kullanıyor;
 * ekran dosyası 1900 satıra çıkınca buraya ayrıldılar.
 */

const PRESS_SPRING = { damping: 15, stiffness: 300 };

/** Açıklama bu uzunluğu aşarsa 2 satıra kırpılıp "Devamını gör" çıkar */
const DESCRIPTION_CLAMP = 110;

/** Kart/satır giriş animasyonu — gecikme sınırlı, 20. kart bir saniye beklemesin */
export const cardEntering = (index: number) =>
  FadeInDown.delay(Math.min(index, 6) * 50)
    .duration(280)
    .springify()
    .damping(18);

/** Onayla/Reddet düğmesi — dolu (birincil) veya çerçeveli (ikincil) */
export function ActionButton({
  icon,
  label,
  tone,
  tonePressed,
  filled,
  onPress,
}: {
  icon: FeatherName;
  label: string;
  tone: string;
  tonePressed: string;
  filled: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const [hovered, setHovered] = useState(false);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.96, PRESS_SPRING);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, PRESS_SPRING);
      }}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.actionPressable}>
      {({ pressed }) => (
        <Animated.View
          style={[
            styles.actionBtn,
            animatedStyle,
            filled
              ? { backgroundColor: pressed ? tonePressed : tone }
              : {
                  borderWidth: 1,
                  borderColor: tone,
                  backgroundColor: `${tone}${pressed ? '24' : hovered ? '14' : '00'}`,
                },
          ]}>
          <Feather name={icon} size={16} color={filled ? '#fff' : tone} />
          <ThemedText style={[styles.actionBtnText, { color: filled ? '#fff' : tone }]}>
            {label}
          </ThemedText>
        </Animated.View>
      )}
    </Pressable>
  );
}

export function Checkbox({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  const { colors } = useDesign();

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      hitSlop={10}
      style={[
        styles.checkbox,
        {
          backgroundColor: checked ? colors.primary : 'transparent',
          borderColor: checked ? colors.primary : colors.border,
        },
      ]}>
      {checked && <Feather name="check" size={13} color="#fff" />}
    </Pressable>
  );
}

/** Başlıktaki özet kutucuğu */
export function StatChip({
  icon,
  label,
  value,
  color,
}: {
  icon: FeatherName;
  label: string;
  value: number;
  color: string;
}) {
  const { colors } = useDesign();

  return (
    <View style={[styles.statChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.statIcon, { backgroundColor: `${color}18` }]}>
        <Feather name={icon} size={13} color={color} />
      </View>
      <View style={styles.grow}>
        <ThemedText style={[styles.statValue, { color: colors.text }]}>{value}</ThemedText>
        <ThemedText style={[styles.statLabel, { color: colors.textMuted }]} numberOfLines={1}>
          {label}
        </ThemedText>
      </View>
    </View>
  );
}

/** Başlangıç → Bitiş aralığı ve net gün rozeti */
export function DateRangeBox({ item }: { item: LeaveRequest }) {
  const { colors } = useDesign();

  return (
    <View
      style={[styles.dateBox, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
      <View style={styles.dateRange}>
        <View>
          <ThemedText style={[styles.dateLabel, { color: colors.textFaint }]}>Başlangıç</ThemedText>
          <ThemedText style={[styles.dateValue, { color: colors.text }]}>
            {item.startDate}
          </ThemedText>
        </View>
        <Feather name="arrow-right" size={14} color={colors.textFaint} />
        <View>
          <ThemedText style={[styles.dateLabel, { color: colors.textFaint }]}>Bitiş</ThemedText>
          <ThemedText style={[styles.dateValue, { color: colors.text }]}>{item.endDate}</ThemedText>
        </View>
      </View>

      <View style={[styles.dayPill, { backgroundColor: colors.primarySoft }]}>
        <ThemedText style={[styles.dayPillText, { color: colors.primary }]}>
          {item.netDays} gün
        </ThemedText>
      </View>
    </View>
  );
}

/**
 * Uzun açıklamaları 2 satıra kırpar. Satır sayısını ölçmek yerine karakter
 * eşiği kullanıyoruz: onTextLayout react-native-web'de tetiklenmiyor, ölçüme
 * bağlansaydı web'de "Devamını gör" hiç görünmezdi.
 */
export function ExpandableText({ text }: { text: string }) {
  const { colors } = useDesign();
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > DESCRIPTION_CLAMP;

  return (
    <View style={styles.descWrap}>
      <ThemedText
        style={[styles.cardDescription, { color: colors.textMuted }]}
        numberOfLines={isLong && !expanded ? 2 : undefined}>
        {text}
      </ThemedText>
      {isLong && (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Açıklamayı kısalt' : 'Açıklamanın tamamını göster'}
          hitSlop={8}>
          <ThemedText style={[styles.moreLink, { color: colors.primary }]}>
            {expanded ? 'Daha az göster' : 'Devamını gör'}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

/** Kartın üst satırı: (seçim kutusu) + avatar + isim/şube + sağdaki içerik */
export function CardHeader({
  item,
  leading,
  children,
}: {
  item: LeaveRequest;
  leading?: ReactNode;
  children?: ReactNode;
}) {
  const { colors } = useDesign();

  return (
    <View style={styles.cardHeader}>
      {leading}
      <Avatar firstName={item.firstName} lastName={item.lastName} size={38} />
      <View style={styles.grow}>
        <ThemedText style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
          {item.firstName} {item.lastName}
        </ThemedText>
        <View style={styles.branchRow}>
          <Feather name="map-pin" size={11} color={colors.textMuted} />
          <ThemedText style={[styles.cardBranch, { color: colors.textMuted }]} numberOfLines={1}>
            {item.branch}
          </ThemedText>
        </View>
      </View>
      {children}
    </View>
  );
}

export function TypeBadge({ type }: { type: LeaveType }) {
  const { colors } = useDesign();

  return (
    <View style={[styles.typeBadge, { backgroundColor: colors.primarySoft }]}>
      <ThemedText style={[styles.typeBadgeText, { color: colors.primary }]}>
        {leaveTypeEmoji(type)} {type}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },

  // Onayla / Reddet
  actionPressable: { flex: 1 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    paddingVertical: 12,
    borderRadius: Radius.md,
  },
  actionBtnText: { fontSize: 15, fontWeight: '700' },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Özet kutucuğu
  statChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    minWidth: 0,
  },
  statIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: 17, fontWeight: '700', lineHeight: 21 },
  statLabel: { fontSize: 11, lineHeight: 15 },

  // Tarih aralığı
  // surfaceRaised açık modda surface ile aynı beyaz — kenarlık olmadan kutu kaybolur
  dateBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Space.md,
    borderWidth: 1,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    borderRadius: Radius.md,
  },
  dateRange: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  dateLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    lineHeight: 14,
  },
  dateValue: { fontSize: 14, fontWeight: '600', lineHeight: 19 },
  dayPill: { paddingHorizontal: Space.md, paddingVertical: 4, borderRadius: Radius.pill },
  dayPillText: { fontSize: 13, fontWeight: '700' },

  // Açıklama
  descWrap: { gap: 2 },
  cardDescription: { fontSize: 14, lineHeight: 20 },
  moreLink: { fontSize: 13, fontWeight: '600' },

  // Kart başlığı
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  cardName: { fontSize: 16, fontWeight: '700' },
  branchRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  cardBranch: { fontSize: 13, flexShrink: 1 },

  typeBadge: {
    paddingHorizontal: Space.md,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
  typeBadgeText: { fontSize: 12, fontWeight: '600' },
});

/** Kart ve panelde paylaşılan durum/rozet stilleri — dışarıdan da kullanılıyor */
export const sharedLeaveStyles = StyleSheet.create({
  grow: { flex: 1 },
  branchRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  cardBranch: { fontSize: 13, flexShrink: 1 },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Space.md,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  processedAt: { fontSize: 12 },

  // ACİL — tam genişlik kırmızı banner
  emergencyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    paddingHorizontal: Space.md,
    paddingVertical: Space.md,
    borderRadius: Radius.sm,
  },
  emergencyBannerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    borderRadius: Radius.sm,
    alignSelf: 'flex-start',
  },
  adminBadgeText: { fontSize: 12, fontWeight: '700' },

  rejectionBox: {
    borderRadius: Radius.sm,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    gap: 2,
  },
  rejectionLabel: { fontSize: 12, fontWeight: '700' },
  rejectionText: { fontSize: 13, lineHeight: 18 },
});
