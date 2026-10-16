import { Redirect, router } from 'expo-router';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { regionLabel } from '../../regions/shoulder';
import { useSession } from '../../store/session';
import { useT } from '../../store/settings';
import { BotBubble, ChipRow } from '../../ui/chat';
import { Chip } from '../../ui/Chip';
import { SceneSheetContent, useSceneStep } from '../../ui/SceneSheetContent';
import { useTheme } from '../../ui/ThemeProvider';

/**
 * P5 (design): the body fills the screen (it lives in report/_layout) and the sheet shows what was tapped and Next. Exact mode
 * highlights only the structure under the finger. Region mode highlights the whole area. The tap callout names the region.
 */
export default function Body() {
  const t = useT();
  const { colors } = useTheme();
  const mode = useSession((s) => s.mode);
  const selection = useSession((s) => s.selection);
  const label = selection ? regionLabel(selection.regionId, selection.subRegionId) : null;
  useSceneStep({ stepKey: 'body', mode: 'questions', progress: { label: t('scene.phasePoint'), value: 0.1 } });
  if (!mode) return <Redirect href="/report/fork" />;
  return (
    <SceneSheetContent contentKey={label ? 'body-picked' : 'body-empty'} onBack={() => router.back()}>
      <BotBubble>{t('body.title')}</BotBubble>
      <AppText variant="secondary" color={colors.muted}>
        {label ? t('body.tapToChange') : t('body.tapToChoose')}
      </AppText>
      {label ? (
        <>
          <ChipRow>
            <Chip large selected label={label} />
          </ChipRow>
          <Button label={t('common.next')} onPress={() => router.push('/report/confirm')} />
        </>
      ) : null}
    </SceneSheetContent>
  );
}
