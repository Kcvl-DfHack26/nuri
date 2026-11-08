import { Alert } from 'react-native';

export const postConfirmTitle = 'レシピを投稿しますか？';
export const postConfirmMessage = 'サムネイルと手順が、だれでも見られるように公開されます。';

/**
 * ⑫-8 (#182, #196): asks before the post is sent. Pressing 投稿する is the explicit choice to send
 * the thumbnail and steps. iOS's standard alert already centers the title and puts its two buttons
 * side by side; Android draws its own dialog (post-confirm.android.tsx).
 */
export function usePostConfirm(onConfirm: () => void) {
  const ask = () => {
    Alert.alert(postConfirmTitle, postConfirmMessage, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '投稿する', onPress: onConfirm },
    ]);
  };
  return { ask, dialog: null };
}
