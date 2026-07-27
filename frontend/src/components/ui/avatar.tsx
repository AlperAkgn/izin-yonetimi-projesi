import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

// Ada göre sabit kalan tonlar — aynı çalışan her yerde aynı renkte görünsün
const TONES = ['#2E8FFF', '#8B5CF6', '#EC4899', '#F79009', '#14B8A6', '#22C55E'];

function toneFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return TONES[hash % TONES.length];
}

function initialsOf(firstName: string, lastName: string): string {
  const first = firstName.trim().charAt(0);
  const last = lastName.trim().charAt(0);
  // tr-TR: "i" → "İ" (varsayılan yerelde "I" olurdu)
  return `${first}${last}`.toLocaleUpperCase('tr-TR');
}

/** Baş harf avatarı — fotoğraf yok, isimden türeyen renkli daire */
export function Avatar({
  firstName,
  lastName,
  size = 42,
}: {
  firstName: string;
  lastName: string;
  size?: number;
}) {
  const tone = toneFor(`${firstName}${lastName}`);

  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: `${tone}22`,
          borderColor: `${tone}55`,
        },
      ]}>
      <ThemedText
        style={[
          styles.initials,
          // lineHeight açıkça verilmezse ThemedText'in varsayılanı (24) küçük
          // boyutlarda harfleri dairenin ortasından kaydırıyor
          { color: tone, fontSize: Math.round(size * 0.36), lineHeight: Math.round(size * 0.44) },
        ]}>
        {initialsOf(firstName, lastName)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  initials: {
    fontWeight: '700',
  },
});
