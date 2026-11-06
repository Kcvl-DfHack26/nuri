import type { IconProps } from '@expo/ui';

import { Button, Icon, Row, Spacer, Text } from '@expo/ui';

import { iconSize } from '@/theme/metrics';

export function AuthButton({
  label,
  icon,
  disabled,
  onPress,
}: {
  label: string;
  icon: IconProps['name'];
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Button variant="outlined" disabled={disabled} onPress={onPress} style={{ width: '100%' }}>
      <Row alignment="center" spacing={12} style={{ width: '100%', paddingVertical: 10 }}>
        <Spacer />
        <Icon name={icon} size={iconSize} />
        <Text>{label}</Text>
        <Spacer />
      </Row>
    </Button>
  );
}
