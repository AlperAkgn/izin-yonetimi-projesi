import Feather from '@expo/vector-icons/Feather';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Space } from '@/constants/design';
import { useDesign } from '@/hooks/use-design';
import { Attachment, MAX_FILE_BYTES, Message } from '@/services/messages';
import { useMessagesStore } from '@/store/messagesStore';
import { showAlert } from '@/utils/alert';

export default function ChatScreen() {
  const { colors } = useDesign();
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversations = useMessagesStore((s) => s.conversations);
  const conversation = conversations.find((c) => c.id === id);
  const messages = useMessagesStore((s) => s.messagesByConv[id] ?? []);
  const storeSend = useMessagesStore((s) => s.sendMessage);
  const [text, setText] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<Attachment | null>(null);

  const sendMessage = () => {
    if (text.trim().length === 0 && !pendingAttachment) return;

    // OPTIMISTIC UPDATE: mesajı hemen ekrana ekliyoruz.
    // Backend ekibine not: gerçekte burada socket.emit('message:send', ...) olacak,
    // sunucudan 'message:sent' onayı gelince tempId gerçek id ile değişecek.
    const newMessage: Message = {
      id: `temp-${Date.now()}`,
      conversationId: id,
      senderId: 'me',
      text: text.trim(),
      attachment: pendingAttachment ?? undefined,
      createdAt: new Date().toISOString(),
    };
    storeSend(id, newMessage);
    setText('');
    setPendingAttachment(null);
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
    setPendingAttachment({
      name: asset.fileName ?? 'görsel.jpg',
      uri: asset.uri,
      type: 'image',
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
    setPendingAttachment({
      name: asset.name,
      uri: asset.uri,
      type: 'file',
      sizeBytes: size,
    });
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
            <View style={[styles.attachmentChip, { borderColor: mine ? 'rgba(255,255,255,0.3)' : colors.border }]}>
              <Feather
                name={item.attachment.type === 'image' ? 'image' : 'file'}
                size={14}
                color={mine ? '#fff' : colors.textMuted}
              />
              <ThemedText
                style={{ color: mine ? '#fff' : colors.text, fontSize: 13 }}
                numberOfLines={1}>
                {item.attachment.name}
              </ThemedText>
            </View>
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
        }}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}>
        <FlatList
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
        />

        {pendingAttachment && (
          <View style={[styles.pendingBar, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
            <Feather
              name={pendingAttachment.type === 'image' ? 'image' : 'file'}
              size={16}
              color={colors.primary}
            />
            <ThemedText style={{ flex: 1, fontSize: 13 }} numberOfLines={1}>
              {pendingAttachment.name}
            </ThemedText>
            <Pressable onPress={() => setPendingAttachment(null)}>
              <Feather name="x" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        )}

        <View style={[styles.inputBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
                sendMessage();
              }
            }}
            blurOnSubmit={false}
          />
          <Pressable onPress={sendMessage} style={[styles.sendButton, { backgroundColor: colors.primary }]}>
            <Feather name="send" size={18} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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