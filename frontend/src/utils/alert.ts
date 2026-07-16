import { Alert, Platform } from 'react-native';

export function showAlert(title: string, message: string, onConfirm?: () => void) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    onConfirm?.();
  } else {
    Alert.alert(title, message, [{ text: 'Tamam', onPress: onConfirm }]);
  }
}