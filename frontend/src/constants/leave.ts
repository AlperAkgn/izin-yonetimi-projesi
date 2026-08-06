import { Palette } from '@/constants/design';

import type { FeatherName } from '@/components/ui/icon';
import type { LeaveStatus, LeaveType } from '@/store/leaveRequestsStore';

/** Formlarda ve filtrelerde gösterilen sıra */
export const LEAVE_TYPES: LeaveType[] = ['Yıllık', 'Sağlık', 'Mazeret', 'Acil'];

/** Backend enum'u → arayüz etiketi (tanınmayan değer "Mazeret" sayılır) */
export function leaveTypeFromApi(apiType: string): LeaveType {
  switch (apiType) {
    case 'ANNUAL':
      return 'Yıllık';
    case 'SICK':
      return 'Sağlık';
    case 'UNPAID':
      return 'Ücretsiz';
    case 'EMERGENCY':
      return 'Acil';
    default:
      return 'Mazeret';
  }
}

/** İzin türünün çip/rozet üzerinde kullanılan simgesi */
export function leaveTypeEmoji(type: string): string {
  switch (type) {
    case 'Yıllık':
      return '🏖️';
    case 'Sağlık':
      return '🏥';
    case 'Mazeret':
      return '📋';
    case 'Acil':
      return '🚨';
    default:
      return '📄';
  }
}

/** Dağılım grafiklerinde türü ayırt eden renk */
export function leaveTypeColor(type: string): string {
  switch (type) {
    case 'Yıllık':
      return Palette.primary;
    case 'Sağlık':
      return Palette.success;
    case 'Mazeret':
      return Palette.warning;
    case 'Acil':
      return Palette.danger;
    default:
      return Palette.canceled;
  }
}

export type StatusMeta = { icon: FeatherName; label: string; color: string };

/** Durumun ikonu, etiketi ve rengi — kart ve rozetlerin tek kaynağı */
export function statusMeta(status: LeaveStatus): StatusMeta {
  switch (status) {
    case 'APPROVED':
      return { icon: 'check-circle', label: 'Onaylandı', color: Palette.success };
    case 'REJECTED':
      return { icon: 'x-circle', label: 'Reddedildi', color: Palette.danger };
    case 'AUTO_APPROVED':
      // Acil kartlarında tepede zaten "ACİL" şeridi var — rozette tekrarlamıyoruz
      return { icon: 'zap', label: 'Otomatik Onaylandı', color: Palette.danger };
    case 'CANCELED':
      return { icon: 'slash', label: 'İptal Edildi', color: Palette.canceled };
    default:
      return { icon: 'clock', label: 'Beklemede', color: Palette.warning };
  }
}
