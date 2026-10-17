import type { StyleProp, ViewStyle } from 'react-native';
import { GlassCard } from '../ui/GlassCard';
import { useTheme } from '../ui/ThemeProvider';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  tone?: 'white' | 'mint' | 'gray';
  /** Row layout with icon first. */
  row?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Flat frosted card (translucent fill, 1px border, soft shadow). Tone tints it; the blur is kept for floating layers only. */
export function Card({ children, onPress, tone = 'white', row = false, accessibilityLabel, style }: Props) {
  const { colors } = useTheme();
  const tint = tone === 'mint' ? { backgroundColor: colors.accentTint } : tone === 'gray' ? { backgroundColor: colors.neutral } : null;
  return (
    <GlassCard row={row} onPress={onPress} accessibilityLabel={accessibilityLabel} style={[tint, style]}>
      {children}
    </GlassCard>
  );
}
