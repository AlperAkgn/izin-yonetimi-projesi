import Feather from '@expo/vector-icons/Feather';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { BackButton } from '@/components/ui/back-button';
import { Radius, Space } from '@/constants/design';
import { useDesign } from '@/hooks/use-design';
import { MAX_FILE_BYTES, Message, PickedFile } from '@/services/messages';
import { useMessagesStore } from '@/store/messagesStore';
import { showAlert } from '@/utils/alert';

/**
 * Sabit referans. Sohbetin mesajları henüz çekilmemişken seçici `?? []`
 * yazsaydı her render'da YENİ bir dizi dönerdi; zustand'ın altındaki
 * useSyncExternalStore bunu "durum değişti" sayıp sonsuz render döngüsüne
 * girer (Maximum update depth exceeded).
 */
const NO_MESSAGES: Message[] = [];

export default function ChatScreen() {
  const { colors } = useDesign();
  // Android'de kenardan kenara çizim açık (SDK 54 varsayılanı): yazma çubuğu
  // sistem gezinme çubuğunun altında kalmasın diye alt güvenli alan eklenir.
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversations = useMessagesStore((s) => s.conversations);
  const conversation = conversations.find((c) => c.id === id);
  const messages = useMessagesStore((s) => s.messagesByConv[id] ?? NO_MESSAGES);
  const openConversation = useMessagesStore((s) => s.openConversation);
  const setActiveConversation = useMessagesStore((s) => s.setActiveConversation);
  const sendMessage = useMessagesStore((s) => s.sendMessage);
  const connected = useMessagesStore((s) => s.connected);

  const [text, setText] = useState('');
  const [pendingFile, setPendingFile] = useState<PickedFile | null>(null);
  const [sending, setSending] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

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
   */
  useEffect(() => {
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
  }, []);

  // Geçmiş sunucudan yüklenir; ekran açıkken gelen mesajlar rozet artırmaz
  useEffect(() => {
    setActiveConversation(id);
    void openConversation(id);
    return () => setActiveConversation(null);
  }, [id, openConversation, setActiveConversation]);

  const handleSend = async () => {
    if (sending) return;
    const trimmed = text.trim();
    if (trimmed.length === 0 && !pendingFile) return;

    setSending(true);
    // Dosya önce REST ile yüklenir, mesaj STOMP üzerinden ek id'siyle gider;
    // sunucu mesajı bize de yayınladığı için liste kendiliğinden güncellenir.
    const result = await sendMessage(id, trimmed, pendingFile ?? undefined);
    setSending(false);

    if (!result.ok) {
      showAlert('Mesaj gönderilemedi', result.message ?? 'Bilinmeyen bir hata oluştu.');
      return;
    }
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

  const renderMessage = ({ item }: { item: Message }) => {
    const mine = item.senderId === 'me';
    return (
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
              style={[styles.attachmentChip, { borderColor: mine ? 'rgba(255,255,255,0.3)' : colors.border }]}>
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
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: conversation?.name ?? 'Sohbet',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerLeft: () => <BackButton />,
        }}
      />

      <View style={[styles.flex, { paddingBottom: keyboardHeight }]}>
        {!connected && (
          <View style={[styles.offlineBar, { backgroundColor: `${colors.danger}18` }]}>
            <Feather name="wifi-off" size={13} color={colors.danger} />
            <ThemedText style={[styles.offlineText, { color: colors.danger }]}>
              Mesaj sunucusuna bağlanılıyor...
            </ThemedText>
          </View>
        )}

        <FlatList
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
        />

        {pendingFile && (
          <View style={[styles.pendingBar, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
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
              // güvenli alan boşluğu eklenirse arada boşluk oluşur.
              paddingBottom: Space.sm + (keyboardHeight > 0 ? 0 : insets.bottom),
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
            style={[
              styles.sendButton,
              { backgroundColor: sending ? colors.textFaint : colors.primary },
            ]}>
            <Feather name="send" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  messageList: { padding: Space.md, gap: Space.sm },
  bubbleRow: { flexDirection: 'row' },
  bubble: {
    maxWidth: '78%',
    borderRadius: Radius.lg,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    gap: Space.xs,
  },
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
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
