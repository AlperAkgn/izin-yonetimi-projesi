import type Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';

/** Feather ikon adları — ikon alan bileşenler bu tipi paylaşır */
export type FeatherName = ComponentProps<typeof Feather>['name'];
