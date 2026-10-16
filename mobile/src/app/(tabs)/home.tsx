import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../components/AppText';
import { LanguageToggle } from '../../components/LanguageToggle';
import { SosButton } from '../../components/SosButton';
import type { TKey } from '../../i18n';
import { useT } from '../../store/settings';
import { FloatingControl } from '../../ui/FloatingControl';
import { GlassCard } from '../../ui/GlassCard';
import { GradientBackground } from '../../ui/GradientBackground';
import { useTheme, useThemePref } from '../../ui/ThemeProvider';
import type { Palette } from '../../ui/theme';

const TILES: { icon: keyof typeof Ionicons.glyphMap; label: TKey; href: string }[] = [
  { icon: 'people-outline', label: 'home.chipDoctors', href: '/book' },
  { icon: 'heart-outline', label: 'home.chipPhysio', href: '/book' },
  { icon: 'document-text-outline', label: 'home.chipRecords', href: '/my-care' },
  { icon: 'barbell-outline', label: 'home.chipExercises', href: '/exercises' },
];

/** Home: greeting with theme toggle, search, one primary "Report a symptom" card, quick actions, upcoming appointment. */
export default function Home() {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const setPref = useThemePref((s) => s.setPref);
  const insets = useSafeAreaInsets();
  const t = useT();
  return (
    <View style={styles.root}>
      <GradientBackground />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.body, { paddingBottom: 120 + insets.bottom }]}>
        <View style={styles.top}>
          <LanguageToggle />
          <View style={styles.grow} />
          <SosButton />
        </View>

        <View style={styles.greet}>
          <View style={styles.avatar}>
            <AppText variant="h2" color={colors.onAccent}>
              PA
            </AppText>
          </View>
          <View style={styles.grow}>
            <AppText variant="secondary" color={colors.muted}>
              {t('home.goodMorning')}
            </AppText>
            <AppText variant="h1" style={styles.hello}>
              {t('home.hello', { name: t('home.demoName') })}
            </AppText>
          </View>
          <FloatingControl
            icon={scheme === 'dark' ? 'sunny-outline' : 'moon-outline'}
            label={t('profile.theme')}
            onPress={() => setPref(scheme === 'dark' ? 'light' : 'dark')}
          />
        </View>

        <GlassCard row padding={0} style={styles.search} accessibilityLabel={t('home.searchPlaceholder')}>
          <Ionicons name="search" size={22} color={colors.muted} style={styles.searchIcon} />
          <AppText variant="body" color={colors.muted} style={styles.grow} numberOfLines={1}>
            {t('home.searchPlaceholder')}
          </AppText>
        </GlassCard>

        <GlassCard onPress={() => router.push('/report/intro')} accessibilityLabel={t('home.tileReport')} row style={styles.primary}>
          <View style={styles.primaryIcon}>
            <Ionicons name="alert-circle-outline" size={28} color={colors.onAccent} />
          </View>
          <View style={styles.grow}>
            <AppText variant="h3">{t('home.tileReport')}</AppText>
            <AppText variant="secondary" color={colors.muted}>
              {t('intro.time')}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.accentText} style={styles.mirror} />
        </GlassCard>

        <View style={styles.tiles}>
          {TILES.map((tile) => (
            <Pressable key={tile.label} accessibilityRole="button" accessibilityLabel={t(tile.label)} onPress={() => router.push(tile.href as never)} style={styles.tile}>
              <View style={styles.tileIcon}>
                <Ionicons name={tile.icon} size={26} color={colors.accentText} />
              </View>
              <AppText variant="secondary" style={styles.tileLabel} numberOfLines={1}>
                {t(tile.label)}
              </AppText>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHead}>
          <AppText variant="h3">{t('home.upcoming')}</AppText>
          <Pressable accessibilityRole="button" accessibilityLabel={t('home.seeAll')} onPress={() => router.push('/my-care')} style={styles.see}>
            <AppText variant="secondary" color={colors.accentText} style={styles.bold}>
              {t('home.seeAll')}
            </AppText>
          </Pressable>
        </View>

        <GlassCard style={styles.upcoming}>
          <View style={styles.who}>
            <View style={styles.avatarSmall}>
              <AppText variant="bodyStrong" color={colors.onAccent}>
                DA
              </AppText>
            </View>
            <View style={styles.grow}>
              <AppText variant="h3">{t('home.upcomingDoctor')}</AppText>
              <AppText variant="secondary" color={colors.muted}>
                {t('home.upcomingKind')}
              </AppText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t('home.message')} style={styles.round}>
              <Ionicons name="chatbubble-outline" size={22} color={colors.accentText} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('home.call')} style={styles.round}>
              <Ionicons name="call-outline" size={22} color={colors.accentText} />
            </Pressable>
          </View>
          <View style={styles.when}>
            <Ionicons name="calendar-outline" size={20} color={colors.accentText} />
            <AppText variant="bodyStrong" color={colors.accentText}>
              {t('home.upcomingWhen')}
            </AppText>
          </View>
        </GlassCard>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.page },
    body: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },
    grow: { flex: 1 },
    top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    greet: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accentFill, alignItems: 'center', justifyContent: 'center' },
    hello: { fontSize: 22, lineHeight: 28 },
    search: { height: 56, borderRadius: 28 },
    searchIcon: { marginStart: 18, marginEnd: 8 },
    primary: { paddingVertical: 20 },
    primaryIcon: { width: 56, height: 56, borderRadius: 20, backgroundColor: colors.accentFill, alignItems: 'center', justifyContent: 'center' },
    mirror: {},
    tiles: { flexDirection: 'row', gap: 8 },
    tile: { flex: 1, alignItems: 'center', gap: 8, minHeight: 96 },
    tileIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.glassFill, borderWidth: 1, borderColor: colors.glassBorder, alignItems: 'center', justifyContent: 'center' },
    tileLabel: { fontWeight: '600', textAlign: 'center' },
    sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    see: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 },
    bold: { fontWeight: '700' },
    upcoming: { gap: 12 },
    who: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatarSmall: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentFill, alignItems: 'center', justifyContent: 'center' },
    round: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accentTint, alignItems: 'center', justifyContent: 'center' },
    when: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  });
