import { View } from 'react-native';
import { useT } from '../store/settings';
import { colors } from '../theme';
import { AppText } from './AppText';
import { ProgressBar } from './ProgressBar';

/** "Step 1 of 5" label above a progress bar, at the top of every flow screen. */
export function StepProgress({ step, total, label }: { step: number; total: number; label?: string }) {
  const t = useT();
  return (
    <View style={{ gap: 8 }}>
      <AppText variant="secondary" color={colors.muted} style={{ fontWeight: '600' }}>
        {label ?? t('flow.step', { n: step, total })}
      </AppText>
      <ProgressBar value={step / total} />
    </View>
  );
}
