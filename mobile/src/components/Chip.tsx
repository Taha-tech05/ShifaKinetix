import { Chip as GlassChip } from '../ui/Chip';
import type { Ionicons } from '@expo/vector-icons';

interface Props {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  selected?: boolean;
  onPress?: () => void;
}

/** Category chip: pill, 48 high, glass fill; selected is filled with the accent colour. */
export function Chip(props: Props) {
  return <GlassChip {...props} />;
}
