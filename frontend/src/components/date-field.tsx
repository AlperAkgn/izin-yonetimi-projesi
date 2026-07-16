import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type Props = {
  value: Date;
  minimumDate?: Date;
  onChange: (date: Date) => void;
  borderColor: string;
};

export function DateField({ value, minimumDate, onChange, borderColor }: Props) {
  const [show, setShow] = useState(false);

  return (
    <>
      <Pressable
        style={{ borderWidth: 1, borderColor, borderRadius: 8, padding: 12 }}
        onPress={() => setShow(true)}>
        <ThemedText>{value.toLocaleDateString('tr-TR')}</ThemedText>
      </Pressable>
      {show && (
        <DateTimePicker
          value={value}
          mode="date"
          minimumDate={minimumDate}
          onChange={(_, selected) => {
            setShow(Platform.OS === 'ios');
            if (selected) onChange(selected);
          }}
        />
      )}
    </>
  );
}