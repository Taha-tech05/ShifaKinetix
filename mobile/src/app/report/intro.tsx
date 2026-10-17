import { router } from 'expo-router';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { useSession } from '../../store/session';
import { useT } from '../../store/settings';
import { BotBubble } from '../../ui/chat';
import { SceneSheetContent, useSceneStep } from '../../ui/SceneSheetContent';
import { useTheme } from '../../ui/ThemeProvider';

/** P4 (design): "Tap where it hurts" over the full-screen body, with the time estimate, Start and the emergency line. */
export default function Intro() {
  const t = useT();
  const { colors } = useTheme();
  const reset = useSession((s) => s.reset);
  useSceneStep({ stepKey: 'intro', mode: 'questions', progress: { label: t('scene.phasePoint'), value: 0.05 } });
  return (
    <SceneSheetContent contentKey="intro" onBack={() => router.back()}>
      <BotBubble>
        <AppText variant="h2">{t('intro.title')}</AppText>
        <AppText variant="secondary" color={colors.muted}>
          {t('intro.time')}
        </AppText>
      </BotBubble>
      <Button
        label={t('intro.start')}
        icon="arrow-forward"
        onPress={() => {
          reset();
          router.push('/report/fork');
        }}
      />
      <AppText variant="secondary" color={colors.muted} style={{ textAlign: 'center' }}>
        {t('notEmergency')}
      </AppText>
    </SceneSheetContent>
  );
}
