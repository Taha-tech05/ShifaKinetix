import { Redirect, router } from 'expo-router';
import { AppText } from '../../components/AppText';
import { regionLabel } from '../../regions/shoulder';
import { useSession } from '../../store/session';
import { useT } from '../../store/settings';
import { BotBubble, ChipRow } from '../../ui/chat';
import { Chip } from '../../ui/Chip';
import { SceneSheetContent, useSceneStep } from '../../ui/SceneSheetContent';
import { useTheme } from '../../ui/ThemeProvider';

/**
 * P6 (design): "You selected: right shoulder, front" as a confirm bubble with chips: Yes, that's right / Change.
 * The label is the region name only. The small line names the closest structure under the finger as a hint, and the note says
 * this is where the patient tapped, not a diagnosis.
 */
export default function Confirm() {
  const t = useT();
  const { colors } = useTheme();
  const selection = useSession((s) => s.selection);
  const label = selection ? regionLabel(selection.regionId, selection.subRegionId) : null;
  useSceneStep({ stepKey: 'confirm', mode: 'questions', progress: { label: t('scene.phasePoint'), value: 0.2 } });
  if (!selection || !label) return <Redirect href="/report/body" />;

  const hit = selection.hitStructure;
  const hint = hit ? t(hit.kind === 'bone' ? 'confirm.closestBone' : 'confirm.closestSurface', { name: hit.name }) : null;
  return (
    <SceneSheetContent contentKey="confirm" onBack={() => router.back()}>
      <BotBubble label={`${t('confirm.selectedLabel')}: ${label}`}>
        <AppText variant="secondary" color={colors.muted}>
          {t('confirm.selectedLabel')}
        </AppText>
        <AppText variant="h2" color={colors.text}>
          {label}
        </AppText>
        {hint ? (
          <AppText variant="secondary" color={colors.muted}>
            {hint}
          </AppText>
        ) : null}
      </BotBubble>
      <ChipRow>
        <Chip large label={t('confirm.yes')} selected onPress={() => router.push('/report/basics')} />
        <Chip large label={t('common.change')} onPress={() => router.back()} />
      </ChipRow>
      <AppText variant="secondary" color={colors.muted}>
        {t('confirm.notDiagnosis')}
      </AppText>
    </SceneSheetContent>
  );
}
