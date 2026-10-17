import { router } from 'expo-router';
import { useState } from 'react';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { RadioCard } from '../../components/RadioCard';
import { forkResult } from '../../flow/intake';
import type { ForkChoice } from '../../flow/intake';
import { useSession } from '../../store/session';
import { useT } from '../../store/settings';
import { BotBubble } from '../../ui/chat';
import { SceneSheetContent, useSceneStep } from '../../ui/SceneSheetContent';
import { useTheme } from '../../ui/ThemeProvider';

/** First question of the flow (design P29): can the patient point to the exact spot? "Not sure" gives region mode. */
export default function Fork() {
  const t = useT();
  const { colors } = useTheme();
  const [picked, setPicked] = useState<ForkChoice | null>(null);
  const setMode = useSession((s) => s.setMode);
  const recordAnswer = useSession((s) => s.recordAnswer);
  useSceneStep({ stepKey: 'fork', mode: 'questions', progress: { label: t('scene.phasePoint'), value: 0.1 } });
  return (
    <SceneSheetContent contentKey="fork" onBack={() => router.back()}>
      <BotBubble>
        <AppText variant="bodyStrong">{t('fork.title')}</AppText>
        <AppText variant="secondary" color={colors.muted}>
          {t('fork.subtitle')}
        </AppText>
      </BotBubble>
      <RadioCard icon="locate-outline" title={t('fork.exact')} sub={t('fork.exactSub')} selected={picked === 'exact'} onPress={() => setPicked('exact')} />
      <RadioCard icon="body-outline" tone="navy" title={t('fork.region')} sub={t('fork.regionSub')} selected={picked === 'region'} onPress={() => setPicked('region')} />
      <RadioCard icon="help-circle-outline" tone="navy" title={t('fork.unsure')} sub={t('fork.unsureSub')} selected={picked === 'unsure'} onPress={() => setPicked('unsure')} />
      <Button
        label={t('common.next')}
        disabled={!picked}
        onPress={() => {
          if (!picked) return;
          const r = forkResult(picked);
          setMode(r.mode);
          recordAnswer(r.answer);
          router.push('/report/body');
        }}
      />
    </SceneSheetContent>
  );
}
