import { useRef } from 'react';

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
        borderRadius: 10,
        padding: 12,
        fontSize: 16,
        fontFamily: 'inherit',
        cursor: 'pointer',
      }}
    />
  );
}