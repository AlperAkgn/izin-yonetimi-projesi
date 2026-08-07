import Feather from '@expo/vector-icons/Feather';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Avatar, splitFullName } from '@/components/ui/avatar';
import { Radius, Space } from '@/constants/design';
import { useDesign } from '@/hooks/use-design';
import { clockLabel, dayLabel, isSameDay, MAX_FILE_BYTES } from '@/services/messages';
import { useMessagesStore } from '@/store/messagesStore';
import { showAlert } from '@/utils/alert';

import type { Message, PickedFile } from '@/services/messages';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

/**
 * Sabit referans. Sohbetin mesajları henüz çekilmemişken seçici `?? []`
 * yazsaydı her render'da YENİ bir dizi dönerdi; zustand'ın altındaki
 * useSyncExternalStore bunu "durum değişti" sayıp sonsuz render döngüsüne
 * girer (Maximum update depth exceeded).
 */
const NO_MESSAGES: Message[] = [];

/** Dibe bu kadar yakınsak liste "takipte" sayılır; yeni mesaj gelince kayar */
const STICK_TO_BOTTOM_PX = 80;

/** Gömülü panelde satırların okunmaz uzunlukta olmasını engelleyen okuma sütunu */
const READING_WIDTH = 820;

/** Mesaj listesinde tarih değişimini işaretleyen ayraç */
function DayDivider({ label }: { label: string }) {
  const { colors } = useDesign();

  return (
    <View style={styles.dayRow}>
      <View style={[styles.dayLine, { backgroundColor: colors.border }]} />
      <View
        style={[
          styles.dayChip,
          { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
        ]}>
        <ThemedText style={[styles.dayText, { color: colors.textMuted }]}>{label}</ThemedText>
      </View>
      <View style={[styles.dayLine, { backgroundColor: colors.border }]} />
    </View>
  );
}

/**
 * Tek bir sohbet: geçmiş + yazma çubuğu.
 *
 * İki yerde kullanılır — `chat/[id]` sayfası (telefon/dar ekran) ve geniş
 * ekranda Mesajlar sayfasının sağ paneli (`embedded`). Gömülü kullanımda
 * kendi başlığını çizer, sayfa başlığı ve alt güvenli alan payı eklemez.
 */
export function ChatPane({
  conversationId,
  embedded = false,
}: {
  conversationId: string;
  embedded?: boolean;
}) {
  const { colors } = useDesign();
  // Android'de kenardan kenara çizim açık (SDK 54 varsayılanı): yazma çubuğu
  // sistem gezinme çubuğunun altında kalmasın diye alt güvenli alan eklenir.
  const insets = useSafeAreaInsets();

  const conversations = useMessagesStore((s) => s.conversations);
  const conversation = conversations.find((c) => c.id === conversationId);
  const messages = useMessagesStore((s) => s.messagesByConv[conversationId] ?? NO_MESSAGES);
  const openConversation = useMessagesStore((s) => s.openConversation);
  const setActiveConversation = useMessagesStore((s) => s.setActiveConversation);
  const sendMessage = useMessagesStore((s) => s.sendMessage);
  const connected = useMessagesStore((s) => s.connected);

  const [text, setText] = useState('');
  const [pendingFile, setPendingFile] = useState<PickedFile | null>(null);
  const [sending, setSending] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const listRef = useRef<FlatList<Message>>(null);
  /** Kullanıcı geçmişi okumak için yukarı kaydırdıysa yeni mesaj onu dibe fırlatmasın */
  const stickToBottom = useRef(true);
  /** İlk yerleşimde animasyonsuz konumlan — sohbet açılırken kaydırma görünmesin */
  const firstScroll = useRef(true);

  /**
   * Klavye açılınca yazma çubuğunu onun üstüne taşır.
   *
   * KeyboardAvoidingView kullanılmıyor: Android'de "kenardan kenara" çizim
   * açık olduğu için (SDK 54 varsayılanı) klavye açıldığında pencere yeniden
   * boyutlanmıyor, iOS'ta zaten hiç boyutlanmaz. İki durumda da alta klavye
   * kadar boşluk bırakmak gerekiyor.
   *
   * Yükseklik `endCoordinates.height` ile değil EKRAN koordinatıyla ölçülüyor:
   * kenardan kenara modda `height` gezinme çubuğunun kapladığı alanı dışarıda
   * bırakıyor. Ölçülen örnek (Android, 3 tuşlu gezinme): height=310,4 ·
   * screenY=465,1 · screen=823,5 → gerçek mesafe 358,4; aradaki 48dp tam olarak
   * gezinme çubuğu. Ekranın tam yüksekliğinden klavyenin üst kenarını çıkarmak
   * iki durumda da doğru sonucu veriyor. Bu ekranın alt kenarı ekranın alt
   * kenarıyla aynı olduğundan (başlık üstte) başlık telafisi gerekmiyor.
   *
   * Gömülü panelde ölçüm geçersiz: panelin alt kenarı ekranın alt kenarı değil
   * ve o genişlikte (>=1000px) yazılım klavyesi zaten yok.
   */
  useEffect(() => {
    if (embedded) return;

    const isIos = Platform.OS === 'ios';
    const showSub = Keyboard.addListener(
      isIos ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        const screenHeight = Dimensions.get('screen').height;
        const lift = Math.max(
          screenHeight - event.endCoordinates.screenY,
          event.endCoordinates.height,
        );
        setKeyboardHeight(lift);
      },
    );
    const hideSub = Keyboard.addListener(isIos ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setKeyboardHeight(0),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [embedded]);

  // Geçmiş sunucudan yüklenir; ekran açıkken gelen mesajlar rozet artırmaz
  useEffect(() => {
    setActiveConversation(conversationId);
    void openConversation(conversationId);
    return () => setActiveConversation(null);
  }, [conversationId, openConversation, setActiveConversation]);

  /** Kaydırma konumunu izler — "dibe yapışık mıyız?" bilgisi buradan gelir */
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceToEnd = contentSize.height - contentOffset.y - layoutMeasurement.height;
    stickToBottom.current = distanceToEnd <= STICK_TO_BOTTOM_PX;
  };

  /**
   * Yeni mesajda (içerik büyür) ve klavye açılınca (liste kısalır) son mesaja
   * kaydırır. Liste ters çevrilmiyor: `inverted` ile gün ayraçlarının sırası
   * ve boş liste durumu ters dönüyor.
   */
  const scrollToEndIfPinned = () => {
    if (!stickToBottom.current) return;
    listRef.current?.scrollToEnd({ animated: !firstScroll.current });
    firstScroll.current = false;
  };

  const handleSend = async () => {
    if (sending) return;
    const trimmed = text.trim();
    if (trimmed.length === 0 && !pendingFile) return;

    setSending(true);
    // Dosya önce REST ile yüklenir, mesaj STOMP üzerinden ek id'siyle gider;
    // sunucu mesajı bize de yayınladığı için liste kendiliğinden güncellenir.
    const result = await sendMessage(conversationId, trimmed, pendingFile ?? undefined);
    setSending(false);

    if (!result.ok) {
      showAlert('Mesaj gönderilemedi', result.message ?? 'Bilinmeyen bir hata oluştu.');
      return;
    }
    // Kendi mesajımızdan sonra her hâlükârda dibe dön
    stickToBottom.current = true;
    setText('');
    setPendingFile(null);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (result.canceled) return;
    const asset = result.assets[0];
    const size = asset.fileSize ?? 0;
    if (size > MAX_FILE_BYTES) {
      showAlert('Dosya çok büyük', 'Maksimum dosya boyutu 5MB olabilir.');
      return;
    }
    setPendingFile({
      uri: asset.uri,
      name: asset.fileName ?? 'görsel.jpg',
      mimeType: asset.mimeType ?? 'image/jpeg',
      sizeBytes: size,
    });
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    const size = asset.size ?? 0;
    if (size > MAX_FILE_BYTES) {
      showAlert('Dosya çok büyük', 'Maksimum dosya boyutu 5MB olabilir.');
      return;
    }
    setPendingFile({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? 'application/octet-stream',
      sizeBytes: size,
    });
  };

  /** Ek, token'lı indirme bağlantısıyla açılır (backend query token kabul eder) */
  const openAttachment = (uri: string) => {
    void Linking.openURL(uri).catch(() =>
      showAlert('Dosya açılamadı', 'Bağlantı tarayıcıda açılamadı, tekrar dene.'),
    );
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const mine = item.senderId === 'me';
    // Gün ayracı, gününün ilk mesajının üstünde çizilir
    const previous = index > 0 ? messages[index - 1] : null;
    const startsNewDay = previous === null || !isSameDay(previous.createdAt, item.createdAt);

    return (
      <>
        {startsNewDay && <DayDivider label={dayLabel(item.createdAt)} />}
        <View style={[styles.bubbleRow, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
          <View
            style={[
              styles.bubble,
              mine
                ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
                : { backgroundColor: colors.surfaceRaised, borderBottomLeftRadius: 4 },
            ]}>
            {item.attachment && (
              <Pressable
                onPress={() => openAttachment(item.attachment!.uri)}
                accessibilityRole="button"
                accessibilityLabel={`${item.attachment.name} dosyasını aç`}
                style={[
                  styles.attachmentChip,
                  { borderColor: mine ? 'rgba(255,255,255,0.3)' : colors.border },
                ]}>
                <Feather
                  name={item.attachment.type === 'image' ? 'image' : 'file'}
                  size={14}
                  color={mine ? '#fff' : colors.textMuted}
                />
                <ThemedText
                  style={{ color: mine ? '#fff' : colors.text, fontSize: 13, flexShrink: 1 }}
                  numberOfLines={1}>
                  {item.attachment.name}
                </ThemedText>
                <Feather name="download" size={13} color={mine ? '#fff' : colors.textMuted} />
              </Pressable>
            )}
            {item.text.length > 0 && (
              <ThemedText style={{ color: mine ? '#fff' : colors.text, fontSize: 15 }}>
                {item.text}
              </ThemedText>
            )}
            <ThemedText
              style={[
                styles.bubbleTime,
                { color: mine ? 'rgba(255,255,255,0.75)' : colors.textFaint },
              ]}>
              {clockLabel(item.createdAt)}
            </ThemedText>
          </View>
        </View>
      </>
    );
  };

  const [firstName, lastName] = splitFullName(conversation?.name ?? '');

  return (
    <View style={[styles.flex, { paddingBottom: keyboardHeight }]}>
      {/* Gömülü panelde sayfa başlığı yok; kiminle konuşulduğu burada yazar */}
      {embedded && (
        <View style={[styles.paneHeader, { borderBottomColor: colors.border }]}>
          <Avatar firstName={firstName} lastName={lastName} size={40} />
          <View style={styles.flex}>
            <ThemedText style={styles.paneName} numberOfLines={1}>
              {conversation?.name ?? 'Sohbet'}
            </ThemedText>
            {conversation?.role !== undefined && conversation.role !== '' && (
              <ThemedText style={[styles.paneRole, { color: colors.textMuted }]} numberOfLines={1}>
                {conversation.role}
              </ThemedText>
            )}
          </View>
        </View>
      )}

      {!connected && (
        <View style={[styles.offlineBar, { backgroundColor: `${colors.danger}18` }]}>
          <Feather name="wifi-off" size={13} color={colors.danger} />
          <ThemedText style={[styles.offlineText, { color: colors.danger }]}>
            Mesaj sunucusuna bağlanılıyor...
          </ThemedText>
        </View>
      )}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderMessage}
        contentContainerStyle={[styles.messageList, embedded && styles.messageListWide]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onContentSizeChange={scrollToEndIfPinned}
        onLayout={scrollToEndIfPinned}
        keyboardShouldPersistTaps="handled"
      />

      {pendingFile && (
        <View
          style={[
            styles.pendingBar,
            { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
          ]}>
          <Feather
            name={pendingFile.mimeType.startsWith('image/') ? 'image' : 'file'}
            size={16}
            color={colors.primary}
          />
          <ThemedText style={{ flex: 1, fontSize: 13 }} numberOfLines={1}>
            {pendingFile.name}
          </ThemedText>
          <Pressable onPress={() => setPendingFile(null)}>
            <Feather name="x" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      )}

      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            // Klavye açıkken gezinme çubuğu zaten klavyenin altında kalıyor;
            // güvenli alan boşluğu eklenirse arada boşluk oluşur. Gömülü panel
            // ekranın dibine yaslanmadığı için orada da eklenmez.
            paddingBottom: Space.sm + (embedded || keyboardHeight > 0 ? 0 : insets.bottom),
          },
        ]}>
        <Pressable onPress={pickImage} style={styles.iconButton}>
          <Feather name="image" size={22} color={colors.textMuted} />
        </Pressable>
        <Pressable onPress={pickFile} style={styles.iconButton}>
          <Feather name="paperclip" size={22} color={colors.textMuted} />
        </Pressable>
        <TextInput
          style={[styles.textInput, { color: colors.text, backgroundColor: colors.surfaceRaised }]}
          placeholder="Mesaj yaz..."
          placeholderTextColor={colors.textFaint}
          value={text}
          onChangeText={setText}
          multiline
          onKeyPress={(e) => {
            const native = e.nativeEvent as unknown as { key?: string; shiftKey?: boolean };
            if (native.key === 'Enter' && !native.shiftKey) {
              e.preventDefault?.();
              void handleSend();
            }
          }}
          blurOnSubmit={false}
        />
        <Pressable
          onPress={() => void handleSend()}
          accessibilityRole="button"
          accessibilityLabel="Mesajı gönder"
          style={[
            styles.sendButton,
            { backgroundColor: sending ? colors.textFaint : colors.primary },
          ]}>
          <Feather name="send" size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  // Gömülü panel başlığı
  paneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    borderBottomWidth: 1,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
  },
  paneName: { fontSize: 16, fontWeight: '700' },
  paneRole: { fontSize: 12, marginTop: 1 },

  messageList: { padding: Space.md, gap: Space.sm },
  // Geniş panelde baloncuklar uçtan uca yayılmasın
  messageListWide: {
    width: '100%',
    maxWidth: READING_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: Space.lg,
    paddingVertical: Space.lg,
  },

  // Gün ayracı
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    marginTop: Space.sm,
    marginBottom: Space.xs,
  },
  dayLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dayChip: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Space.md,
    paddingVertical: 3,
  },
  dayText: { fontSize: 11, fontWeight: '600' },

  bubbleRow: { flexDirection: 'row' },
  bubble: {
    maxWidth: '78%',
    borderRadius: Radius.lg,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    gap: Space.xs,
  },
  bubbleTime: { fontSize: 10, alignSelf: 'flex-end', marginTop: -2 },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Space.sm,
    paddingVertical: 6,
  },
  offlineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.xs,
    paddingVertical: 6,
  },
  offlineText: { fontSize: 12, fontWeight: '600' },
  pendingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    borderTopWidth: 1,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Space.xs,
    borderTopWidth: 1,
    paddingHorizontal: Space.sm,
    paddingVertical: Space.sm,
  },
  iconButton: { padding: Space.sm },
  textInput: {
    flex: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Space.md,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    maxHeight: 100,
    fontSize: 15,
    // Web'de input'un varsayılan odak çerçevesi baloncuk hattını bozuyor
    ...Platform.select({ web: { outlineStyle: 'none' } as object, default: {} }),
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
