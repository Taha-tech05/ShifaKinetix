import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { CautionStrip } from '../../components/CautionStrip';
import { IconTile } from '../../components/IconTile';
import { MovementStage } from '../../components/movement/MovementStage';
import { Screen } from '../../components/Screen';
import { StepProgress } from '../../components/StepProgress';
import { MOVEMENT_COUNT, routeAfterMovement } from '../../flow/intake';
import { SafeGuard } from '../../flow/SafeGuard';
import { MOVEMENTS, localized } from '../../movement/movements';
import { buildMovementResult } from '../../movement/result';
import { sideOfRegion } from '../../regions/shoulder';
import { useSession } from '../../store/session';
import { useT } from '../../store/settings';
import { colors } from '../../theme';

/**
 * One guided movement: caution line, slow demo on the mannequin, the instruction, "I tried it" or "Skip".
 * Only after the verdict SAFE, and only in region mode. Skip is stored as state "unknown", never as "no pain".
 */
export default function MovementScreen() {
  const t = useT();
  const params = useLocalSearchParams<{ i?: string }>();
  const mode = useSession((s) => s.mode);
  const side = sideOfRegion(useSession((s) => s.selection?.regionId));
  const recordMovement = useSession((s) => s.recordMovement);
  const [cameraNote, setCameraNote] = useState(false);
  const [touching, setTouching] = useState(false);
  const i = Math.max(0, Math.min(MOVEMENT_COUNT - 1, Number(params.i ?? 0) || 0));
  const movement = MOVEMENTS[i];

  return (
    <SafeGuard>
      {mode !== 'region' ? (
        <Redirect href="/report/followup" />
      ) : (
        <Screen
          scrollEnabled={!touching}
          onBack={() => router.back()}
          banner={<CautionStrip text={localized(movement.caution)} />}
          footer={
            <>
              <Button label={t('movement.tried')} onPress={() => router.push(`/report/feel?i=${i}`)} />
              <Button
                variant="text"
                label={t('movement.skip')}
                onPress={() => {
                  recordMovement(buildMovementResult(movement.id, { kind: 'skip' }));
                  router.replace(routeAfterMovement(i) as never);
                }}
              />
            </>
          }
        >
          <StepProgress step={i + 1} total={MOVEMENT_COUNT} label={t('movement.of', { n: i + 1, total: MOVEMENT_COUNT })} />
          <AppText variant="h1" color={colors.navy}>
            {localized(movement.name)}
          </AppText>
          <MovementStage movement={movement} side={side} height={360} onInteract={setTouching} />
          <Card row>
            <IconTile icon="information-circle-outline" tone="teal" />
            <AppText variant="body" style={styles.col}>
              {localized(movement.instruction)}
            </AppText>
          </Card>
          {movement.cameraMeasurable ? (
            <View style={styles.camera}>
              <Button variant="outline" icon="camera-outline" label={t('movement.camera')} onPress={() => setCameraNote(true)} />
              {cameraNote ? (
                <AppText variant="secondary" color={colors.muted}>
                  {t('movement.cameraNote')}
                </AppText>
              ) : null}
            </View>
          ) : null}
        </Screen>
      )}
    </SafeGuard>
  );
}

const styles = StyleSheet.create({
  col: { flex: 1 },
  camera: { gap: 8 },
});
