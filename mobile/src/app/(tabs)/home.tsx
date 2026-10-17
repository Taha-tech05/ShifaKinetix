import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { I18nManager, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../components/AppText';
import { SosButton } from '../../components/SosButton';
import { StatusChip } from '../../components/StatusChip';
import type { TKey } from '../../i18n';
import { useT } from '../../store/settings';
import { FloatingControl } from '../../ui/FloatingControl';
import { GlassCard } from '../../ui/GlassCard';
import { GradientBackground } from '../../ui/GradientBackground';
import { LanguageMenu } from '../../ui/LanguageMenu';
import { SectionHeader } from '../../ui/SectionHeader';
import { useTheme, useThemePref } from '../../ui/ThemeProvider';
import type { Palette } from '../../ui/theme';

const TILES: { icon: keyof typeof Ionicons.glyphMap; label: TKey; href: string }[] = [
  { icon: 'people-outline', label: 'home.chipDoctors', href: '/book' },
  { icon: 'heart-outline', label: 'home.chipPhysio', href: '/book' },
  { icon: 'document-text-outline', label: 'home.chipRecords', href: '/my-care' },
  { icon: 'barbell-outline', label: 'home.chipExercises', href: '/exercises' },
];

/**
 * Home, laid out like the "Dashboard" of the light reference: title row with the round control and the bell-sized actions,
 * search pill, a big overview card, an upcoming appointment row with "View All", and the Quick Actions tiles.
 */
export default function Home() {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const setPref = useThemePref((s) => s.setPref);
  const insets = useSafeAreaInsets();
  const t = useT();
  const chevron = I18nManager.isRTL ? 'chevron-back' : 'chevron-forward';
  return (
    <View style={styles.root}>
      <GradientBackground />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.body, { paddingBottom: 130 + insets.bottom }]}>
        <View style={styles.top}>
          <FloatingControl icon={scheme === 'dark' ? 'sunny-outline' : 'moon-outline'} label={t('profile.theme')} onPress={() => setPref(scheme === 'dark' ? 'light' : 'dark')} />
          <View style={styles.grow}>
            <AppText variant="h2" numberOfLines={1} accessibilityRole="header">
              {t('home.demoName')}
            </AppText>
            <AppText variant="secondary" color={colors.muted} numberOfLines={1}>
              {t('home.hello', { name: t('home.demoName') })}
            </AppText>
          </View>
          <LanguageMenu />
          <SosButton />
        </View>

        <GlassCard row padding={0} style={styles.search} accessibilityLabel={t('home.searchPlaceholder')}>
          <AppText variant="body" color={colors.muted} style={[styles.grow, styles.searchText]} numberOfLines={1}>
            {t('home.searchPlaceholder')}
          </AppText>
          <Ionicons name="search" size={22} color={colors.muted} style={styles.searchIcon} />
        </GlassCard>

        <GlassCard onPress={() => router.push('/report/intro')} accessibilityLabel={t('home.tileReport')} padding={0} style={styles.overview}>
          <View style={[styles.cardHead, { borderBottomColor: colors.line }]}>
            <AppText variant="bodyStrong">{t('home.tileReport')}</AppText>
            <AppText variant="secondary" color={colors.accentText} style={styles.bold}>
              {t('intro.start')}
            </AppText>
          </View>
          <View style={styles.overviewBody}>
            <View style={styles.big}>
              <Ionicons name="body-outline" size={40} color={colors.onAccent} />
            </View>
            <View style={styles.grow}>
              <AppText variant="secondary" color={colors.muted}>
                {t('intro.title')}
              </AppText>
              <AppText variant="h3">{t('intro.time')}</AppText>
            </View>
            <View style={styles.go}>
              <Ionicons name={I18nManager.isRTL ? 'arrow-back' : 'arrow-forward'} size={20} color={colors.onAccent} />
            </View>
          </View>
        </GlassCard>

        <GlassCard row>
          <View style={styles.disc}>
            <Ionicons name="pulse" size={22} color={colors.accentText} />
          </View>
          <View style={styles.grow}>
            <AppText variant="bodyStrong">{t('home.todaysCare')}</AppText>
            <AppText variant="secondary" color={colors.muted}>
              {t('home.todaysCareBody')}
            </AppText>
          </View>
          <StatusChip status="unknown" label={t('home.inReview')} />
        </GlassCard>

        <SectionHeader title={t('home.upcoming')} actionLabel={t('home.seeAll')} onAction={() => router.push('/my-care')} />
        <GlassCard row onPress={() => router.push('/my-care')} accessibilityLabel={`${t('home.upcomingDoctor')}, ${t('home.upcomingWhen')}`}>
          <View style={styles.avatar}>
            <AppText variant="bodyStrong" color={colors.onAccent}>
              DA
            </AppText>
          </View>
          <View style={styles.grow}>
            <AppText variant="bodyStrong">{t('home.upcomingDoctor')}</AppText>
            <AppText variant="secondary" color={colors.muted}>
              {t('home.upcomingKind')}
            </AppText>
            <View style={styles.when}>
              <Ionicons name="calendar-outline" size={16} color={colors.accentText} />
              <AppText variant="secondary" color={colors.accentText} style={styles.bold}>
                {t('home.upcomingWhen')}
              </AppText>
            </View>
          </View>
          <Ionicons name={chevron} size={20} color={colors.muted} />
        </GlassCard>

        <SectionHeader title={t('home.quickActions')} />
        <View style={styles.tiles}>
          {TILES.map((tile) => (
            <Pressable key={tile.label} accessibilityRole="button" accessibilityLabel={t(tile.label)} onPress={() => router.push(tile.href as never)} style={styles.tile}>
              <View style={styles.tileIcon}>
                <Ionicons name={tile.icon} size={24} color={colors.accentText} />
              </View>
              <AppText variant="secondary" style={styles.tileLabel} numberOfLines={1}>
                {t(tile.label)}
              </AppText>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.page },
    body: { paddingHorizontal: 20, paddingTop: 8, gap: 14 },
    grow: { flex: 1 },
    top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    search: { height: 56, borderRadius: 28 },
    searchText: { marginStart: 20 },
    searchIcon: { marginEnd: 20 },
    overview: { overflow: 'hidden' },
    cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, backgroundColor: colors.accentTint },
    overviewBody: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
    disc: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentTint, alignItems: 'center', justifyContent: 'center' },
    big: { width: 60, height: 60, borderRadius: 22, backgroundColor: colors.accentFill, alignItems: 'center', justifyContent: 'center' },
    go: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentFill, alignItems: 'center', justifyContent: 'center' },
    avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accentFill, alignItems: 'center', justifyContent: 'center' },
    when: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    bold: { fontWeight: '700' },
    tiles: { flexDirection: 'row', gap: 10 },
    tile: { flex: 1, alignItems: 'center', gap: 8, minHeight: 96, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 22, backgroundColor: colors.cardFill, borderWidth: 1, borderColor: colors.glassBorder },
    tileIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accentTint, alignItems: 'center', justifyContent: 'center' },
    tileLabel: { fontWeight: '600', textAlign: 'center' },
  });
