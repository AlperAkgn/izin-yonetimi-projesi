import { Platform } from 'react-native';

/**
 * YERLEŞİM ÖLÇÜLERİ — tek kaynak.
 *
 * Bu sayılar önce üç ayrı ekranda elle tanımlıydı (`SPLIT_MIN_WIDTH`,
 * `LIST_PANE_WIDTH`, dağınık `maxWidth: 480`). Eşiği değiştirmek için üç
 * dosyayı birden bulmak gerekiyordu.
 */

/**
 * Bu genişlikten itibaren yönetici/İK ekranları masaüstü düzenine geçer.
 * Altında telefon/tablet görünümü korunur — personel uygulamayı buradan
 * kullandığı için o dal bilinçli olarak değiştirilmiyor.
 * Kod tarafında `useWideLayout()` (hooks/use-columns.ts) ile okunur.
 */
export const WIDE_MIN_WIDTH = 1000;

/** Geniş ekranda soldaki seçici liste sütunu (İzin Onay, Mesajlar) */
export const LIST_PANE_WIDTH = 380;

/** Geniş ekranda sağdaki canlı özet sütunu (Çalışan İzin Yaz) */
export const SUMMARY_PANE_WIDTH = 340;

/** Dar ekranda içeriğin ortalandığı okuma sütunu */
export const NARROW_MAX_WIDTH = 480;

/** `Screen wide` (Panel gibi ızgara ekranları) için içerik üst sınırı */
export const CONTENT_WIDE_MAX_WIDTH = 1200;

/**
 * Kendi iskeletini çizen liste+detay sayfalarının üst sınırı (İzin Onay,
 * Mesajlar). `Screen`'inkinden geniş: iki sütun yan yana duruyor.
 */
export const PAGE_MAX_WIDTH = 1600;

/** Sohbet baloncuklarının yayıldığı okuma sütunu (geniş ekran) */
export const CHAT_READING_WIDTH = 820;

/**
 * Web'de TextInput'un varsayılan odak çerçevesi, kendi kenarlıklı kutumuzun
 * içinde ikinci bir çizgi olarak görünüyor. Stil dizisine yayılarak kullanılır.
 */
export const webInputReset = Platform.select({
  web: { outlineStyle: 'none' } as object,
  default: {},
});
