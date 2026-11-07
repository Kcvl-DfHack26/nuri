import { Column, Icon, Spacer } from '@expo/ui';
import { useState } from 'react';
import { Image } from 'react-native';

import { NativeHost } from '@/components/native-host';
import { apiAssetUrl } from '@/lib/api';
import { colors } from '@/theme/colors';
import { avatarSize } from '@/theme/metrics';

export function Avatar({
  size = avatarSize,
  image,
}: {
  size?: number;
  image?: string | null | undefined;
}) {
  const [failedUri, setFailedUri] = useState<string>();
  const uri = image ? apiAssetUrl(image) : image;
  if (uri && uri !== failedUri) {
    return (
      <Image
        accessible={false}
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => {
          setFailedUri(uri);
        }}
      />
    );
  }
  return (
    <NativeHost
      accessible={false}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.background,
      }}
    >
      <Column alignment="center" style={{ width: '100%', height: '100%' }}>
        <Spacer />
        <Icon
          name={Icon.select({
            ios: 'person.fill',
            android: import('@expo/material-symbols/person.xml'),
          })}
          size={size * 0.5}
          color={colors.secondary}
        />
        <Spacer />
      </Column>
    </NativeHost>
  );
}
