import { Button, Column, Row, Spacer, Text as NativeText, TextInput } from '@expo/ui';
import { profileInputSchema } from '@starter/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';

import { Feedback } from '@/components/feedback';
import { NativeHost } from '@/components/native-host';
import { Screen } from '@/components/screen';
import { authClient } from '@/lib/api';
import { colors } from '@/theme/colors';

function Editor({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: async () => {
      const result = await authClient.updateUser(profileInputSchema.parse({ name }));
      if (result.error) {
        throw new Error('変更を保存できませんでした。もう一度お試しください。');
      }
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['posts'] }),
        client.invalidateQueries({ queryKey: ['user'] }),
      ]);
      router.back();
    },
  });
  return (
    <Screen>
      <NativeHost matchContents={{ vertical: true }}>
        <Column spacing={24}>
          <TextInput
            accessibilityLabel="表示名"
            placeholder="表示名（40文字以内）"
            style={{ width: '100%', padding: 16, backgroundColor: colors.card, borderRadius: 12 }}
            defaultValue={initialName}
            onChangeText={setName}
            editable={!save.isPending}
            autoComplete="name"
          />
          <Button
            disabled={save.isPending || !profileInputSchema.safeParse({ name }).success}
            onPress={() => {
              save.mutate();
            }}
          >
            <Row style={{ width: '100%', paddingVertical: 8 }}>
              <Spacer />
              <NativeText>{save.isPending ? '保存中' : '保存'}</NativeText>
              <Spacer />
            </Row>
          </Button>
        </Column>
      </NativeHost>
      {save.error ? <Feedback message={save.error.message} /> : null}
    </Screen>
  );
}
export function ProfileEdit() {
  const session = authClient.useSession();
  if (session.isPending) {
    return <Feedback fullScreen loading message="読み込み中" />;
  }
  if (!session.data) {
    return (
      <Feedback
        fullScreen
        message="ログインしてください。"
        onRetry={() => {
          router.replace('/account');
        }}
      />
    );
  }
  return <Editor initialName={session.data.user.name} />;
}
