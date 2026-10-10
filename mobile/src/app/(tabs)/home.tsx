import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import type { TKey } from '../../i18n';
import { useT } from '../../store/settings';
import { colors, MIN_TAP, radius, spacing } from '../../theme';

const TILES: { icon: keyof typeof Ionicons.glyphMap; label: TKey; href: string }[] = [
  { icon: 'body', label: 'home.tileShoulder', href: '/report/intro' },
  { icon: 'barbell', label: 'home.tileExercises', href: '/exercises' },
  { icon: 'trending-up', label: 'home.tileProgress', href: '/my-care' },
  { icon: 'help-circle', label: 'home.tileHelp', href: '/help' },
];

export default function Home() {
  const t = useT();
  return (
    <Screen>
      <AppText variant="display" color={colors.navy}>
        {t('home.greeting')}
      </AppText>

      <View style={styles.search}>
        <Ionicons name="search" size={20} color={colors.muted} />
        <TextInput
          accessibilityLabel={t('common.search')}
          placeholder={t('home.searchPlaceholder')}
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.tiles}>
        {TILES.map((tile) => (
          <Pressable
            key={tile.label}
            accessibilityRole="button"
            accessibilityLabel={t(tile.label)}
            onPress={() => router.push(tile.href as never)}
            style={styles.tile}
          >
            <Ionicons name={tile.icon} size={26} color={colors.teal} />
            <AppText variant="secondary" color={colors.navy} style={styles.tileLabel} numberOfLines={1}>
              {t(tile.label)}
            </AppText>
          </Pressable>
        ))}
      </View>

      <Card tone="mint" style={styles.banner}>
        <AppText variant="h1" color={colors.navy}>
          {t('home.report')}
        </AppText>
        <AppText variant="body" color={colors.navy}>
          {t('home.reportSub')}
        </AppText>
        <Button label={t('home.report')} onPress={() => router.push('/report/intro')} />
      </Card>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
        <Card
          style={styles.hCard}
          accessibilityLabel={t('home.book')}
          onPress={() => router.push('/book' as never)}
        >
          <Ionicons name="calendar" size={28} color={colors.teal} />
          <AppText variant="h3" color={colors.navy}>
            {t('home.book')}
          </AppText>
          <AppText variant="secondary" color={colors.muted}>
            {t('home.bookSub')}
          </AppText>
        </Card>
        <Card
          style={styles.hCard}
          accessibilityLabel={t('home.continueCare')}
          onPress={() => router.push('/my-care')}
        >
          <Ionicons name="heart" size={28} color={colors.teal} />
          <AppText variant="h3" color={colors.navy}>
            {t('home.continueCare')}
          </AppText>
          <AppText variant="secondary" color={colors.muted}>
            {t('home.continueCareSub')}
          </AppText>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: MIN_TAP + 8,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, minHeight: MIN_TAP, fontSize: 16, color: colors.ink, textAlign: 'auto' },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    minHeight: 84,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.sm,
  },
  tileLabel: { fontWeight: '600' },
  banner: { gap: spacing.md },
  cards: { gap: spacing.md, paddingBottom: spacing.sm },
  hCard: { width: 240, gap: spacing.sm },
});
