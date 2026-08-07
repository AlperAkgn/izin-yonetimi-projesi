import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { ChatPane } from '@/components/messages/chat-pane';
import { BackButton } from '@/components/ui/back-button';
import { useDesign } from '@/hooks/use-design';
import { useWideLayout } from '@/hooks/use-columns';
import { useMessagesStore } from '@/store/messagesStore';

/**
 * Sohbetin kendi sayfası — telefon/dar ekran akışı (liste → sohbet).
 *
 * Geniş ekranda sohbet, Mesajlar sayfasının sağ panelinde açılıyor; pencere
 * o genişliğe büyütülürse buradaki sayfa açık kalmasın diye oraya devredilir.
 */
export default function ChatScreen() {
  const { colors } = useDesign();
  const wide = useWideLayout();
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversations = useMessagesStore((s) => s.conversations);
  const conversation = conversations.find((c) => c.id === id);

  useEffect(() => {
    if (wide) router.replace({ pathname: '/messages', params: { focus: id } });
  }, [wide, id]);

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

      <ChatPane conversationId={id} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
