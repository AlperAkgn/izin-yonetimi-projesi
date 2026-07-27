import { useRef } from 'react';

import { Radius } from '@/constants/design';
import { useDesign } from '@/hooks/use-design';

type Props = {
  value: Date;
  minimumDate?: Date;
  onChange: (date: Date) => void;
  borderColor: string;
};

function toInputValue(date: Date) {
  return date.toISOString().split('T')[0];
}

export function DateField({ value, minimumDate, onChange, borderColor }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const { colors, isDark } = useDesign();

  return (
    <input
      ref={ref}
      type="date"
      value={toInputValue(value)}
      min={minimumDate ? toInputValue(minimumDate) : undefined}
      onKeyDown={(e) => e.preventDefault()}
      onClick={() => ref.current?.showPicker?.()}
      onChange={(e) => {
        if (e.target.value) onChange(new Date(e.target.value));
      }}
      style={{
        border: `1px solid ${borderColor}`,
        borderRadius: Radius.md,
        padding: '12px 16px',
        fontSize: 15,
        fontFamily: 'inherit',
        cursor: 'pointer',
        // Diğer input'larla aynı tema: aksi halde tarayıcı varsayılanı
        // karanlık modda beyaz kutu bırakıyor. colorScheme takvim ikonunu da çevirir.
        width: '100%',
        boxSizing: 'border-box',
        background: colors.surfaceRaised,
        color: colors.text,
        colorScheme: isDark ? 'dark' : 'light',
      }}
    />
  );
}