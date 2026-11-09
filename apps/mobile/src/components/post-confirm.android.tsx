import {
  BasicAlertDialog,
  Column,
  Host,
  Row,
  Shape,
  Surface,
  Text,
  TextButton,
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth, paddingAll } from '@expo/ui/jetpack-compose/modifiers';
import { useState } from 'react';

import { useTokenColor } from '@/theme/tokens';

import { postConfirmMessage, postConfirmTitle } from './post-confirm-text';

const corner = 28;

/**
 * ⑫-8 on Android (#196): Material's alert puts its title at the start and its buttons at the end,
 * so the dialog is drawn with the title in the middle and キャンセル and 投稿する spread apart.
 */
export function usePostConfirm(onConfirm: () => void) {
  const [open, setOpen] = useState(false);
  const ink = useTokenColor('--color-ink-primary');
  const secondary = useTokenColor('--color-ink-secondary');
  const rose = useTokenColor('--color-accent-rose');
  const surface = useTokenColor('--color-bg-surface');
  const close = () => {
    setOpen(false);
  };
  const dialog = open ? (
    <Host matchContents>
      <BasicAlertDialog onDismissRequest={close}>
        <Surface
          color={surface}
          shape={Shape.RoundedCorner({
            cornerRadii: {
              topStart: corner,
              topEnd: corner,
              bottomStart: corner,
              bottomEnd: corner,
            },
          })}
        >
          <Column
            modifiers={[paddingAll(24)]}
            horizontalAlignment="center"
            verticalArrangement={{ spacedBy: 16 }}
          >
            <Text color={ink} style={{ typography: 'titleLarge', textAlign: 'center' }}>
              {postConfirmTitle}
            </Text>
            <Text color={secondary} style={{ typography: 'bodyMedium', textAlign: 'center' }}>
              {postConfirmMessage}
            </Text>
            <Row modifiers={[fillMaxWidth()]} horizontalArrangement="spaceEvenly">
              <TextButton onClick={close} colors={{ contentColor: secondary }}>
                <Text>キャンセル</Text>
              </TextButton>
              <TextButton
                onClick={() => {
                  setOpen(false);
                  onConfirm();
                }}
                colors={{ contentColor: rose }}
              >
                <Text>投稿する</Text>
              </TextButton>
            </Row>
          </Column>
        </Surface>
      </BasicAlertDialog>
    </Host>
  ) : null;
  return {
    ask: () => {
      setOpen(true);
    },
    dialog,
  };
}
