import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

SplashScreen.preventAutoHideAsync();

export function AnimatedSplashOverlay() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return null;
}

export function AnimatedIcon() {
  const scale = useSharedValue(0.7);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.exp) });
    opacity.value = withTiming(1, { duration: 500 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.iconContainer}>
      <Animated.View style={[styles.background, animatedStyle]} />
      <Animated.View style={[styles.imageContainer, animatedStyle]}>
        <Image style={styles.image} source={require('@/assets/images/expo-logo.png')} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 128,
    height: 128,
  },
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: 76,
    height: 71,
  },
  background: {
    borderRadius: 40,
    backgroundColor: '#3C9FFE',
    width: 128,
    height: 128,
    position: 'absolute',
  },
});