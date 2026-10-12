import { router } from 'expo-router';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { MoveSafelyNote } from '../components/MoveSafelyNote';
import { Screen } from '../components/Screen';
import { useT } from '../store/settings';
import { colors } from '../theme';

interface Props {
  title?: string;
  /** Movement and exercise screens must show the safety note. */
  movement?: boolean;
  onBack?: () => void;
}

/** Stand-in for screens that belong to the full project. */
export function FullProjectPlaceholder({ title, movement = false, onBack }: Props) {
  const t = useT();
  return (
    <Screen title={title ?? t('placeholder.title')} onBack={onBack}>
      <Card tone="gray">
        <AppText variant="h2" color={colors.navy}>
          {t('common.fullProject')}
        </AppText>
        <AppText variant="body">{t('common.fullProjectBody')}</AppText>
      </Card>
      {movement ? <MoveSafelyNote /> : null}
      <Button label={t('common.goHome')} variant="outline" onPress={() => router.replace('/home')} />
    </Screen>
  );
}
