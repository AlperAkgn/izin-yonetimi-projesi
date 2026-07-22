import { Alert, Platform } from 'react-native';

export function showAlert(title: string, message: string, onConfirm?: () => void) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    onConfirm?.();
  } else {
    Alert.alert(title, message, [{ text: 'Tamam', onPress: onConfirm }]);
  }
}
export function showConfirm(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void
) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: 'İptal', style: 'cancel' },
      { text: confirmLabel, style: 'destructive', onPress: onConfirm },
    ]);
  }
}