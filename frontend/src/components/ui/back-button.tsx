import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { useDesign } from '@/hooks/use-design';

export function BackButton() {
  const { colors } = useDesign();

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <Pressable
      onPress={handleBack}
      hitSlop={12}
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.5 : 1 }]}>
      <Feather name="arrow-left" size={22} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: -4,
  },
});
