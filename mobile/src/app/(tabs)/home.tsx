import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Chip } from '../../components/Chip';
import { IconTile } from '../../components/IconTile';
import type { Tone } from '../../components/IconTile';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import type { TKey } from '../../i18n';
import { useT } from '../../store/settings';
import { colors, gradients, shadows } from '../../theme';

const TILES: { icon: keyof typeof Ionicons.glyphMap; tone: Tone; label: TKey; href: string }[] = [
  { icon: 'alert-circle-outline', tone: 'danger', label: 'home.tileReport', href: '/report/intro' },
  { icon: 'calendar-outline', tone: 'navy', label: 'home.tileBook', href: '/book' },
  { icon: 'body-outline', tone: 'safe', label: 'home.tileExercises', href: '/exercises' },
  { icon: 'heart-outline', tone: 'teal', label: 'home.tileMyCare', href: '/my-care' },
];

const CHIPS: { icon: keyof typeof Ionicons.glyphMap; label: TKey; href: string }[] = [
  { icon: 'people-outline', label: 'home.chipDoctors', href: '/book' },
  { icon: 'pulse', label: 'home.chipExercises', href: '/exercises' },
  { icon: 'heart-outline', label: 'home.chipPhysio', href: '/book' },
  { icon: 'document-text-outline', label: 'home.chipRecords', href: '/my-care' },
];

/** Home (design P3): gradient header with greeting, search and Today's care, then service tiles. */
export default function Home() {
  const t = useT();
  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[...gradients.hero]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <ScreenHeader hero />
          <View style={styles.pad}>
            <View style={styles.greet}>
              <LinearGradient colors={[...gradients.avatar]} style={styles.avatar}>
                <AppText variant="h2" color={colors.white}>
                  PA
                </AppText>
              </LinearGradient>
              <View style={styles.col}>
                <AppText variant="secondary" color="rgba(255,255,255,0.75)">
                  {t('home.goodMorning')}
                </AppText>
                <AppText variant="h1" color={colors.white} style={styles.hello}>
                  {t('home.hello', { name: t('home.demoName') })}
                </AppText>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={t('home.notifications')} style={styles.bell}>
                <Ionicons name="notifications-outline" size={24} color={colors.white} />
              </Pressable>
            </View>

            <View style={styles.search}>
              <Ionicons name="search" size={22} color={colors.muted} />
              <AppText variant="body" color={colors.muted} style={styles.col} numberOfLines={1}>
                {t('home.searchPlaceholder')}
              </AppText>
              <Pressable accessibilityRole="button" accessibilityLabel={t('home.filter')} style={styles.filter}>
                <Ionicons name="options-outline" size={24} color={colors.teal} />
              </Pressable>
            </View>

            <View style={styles.care}>
              <IconTile icon="pulse" tone="teal" style={styles.careIcon} />
              <View style={styles.col}>
                <AppText variant="h3" color={colors.white}>
                  {t('home.todaysCare')}
                </AppText>
                <AppText variant="secondary" color="rgba(255,255,255,0.75)">
                  {t('home.todaysCareBody')}
                </AppText>
              </View>
              <StatusChip status="unknown" label={t('home.inReview')} />
            </View>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.tiles}>
            {TILES.map((tile) => (
              <Pressable
                key={tile.label}
                accessibilityRole="button"
                accessibilityLabel={t(tile.label)}
                onPress={() => router.push(tile.href as never)}
                style={styles.tile}
              >
                <IconTile icon={tile.icon} tone={tile.tone} />
                <AppText variant="secondary" color={colors.navy} style={styles.tileLabel}>
                  {t(tile.label)}
                </AppText>
              </Pressable>
            ))}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {CHIPS.map((c, i) => (
              <Chip key={c.label} icon={c.icon} label={t(c.label)} selected={i === 1} onPress={() => router.push(c.href as never)} />
            ))}
          </ScrollView>

          <View style={styles.sectionHead}>
            <View style={styles.label}>
              <AppText variant="secondary" color={colors.tealDark} style={styles.labelText}>
                {t('home.upcoming').toUpperCase()}
              </AppText>
            </View>
            <Pressable accessibilityRole="button" onPress={() => router.push('/my-care')} style={styles.see}>
              <AppText variant="secondary" color={colors.linkTeal} style={styles.bold}>
                {t('home.seeAll')}
              </AppText>
            </Pressable>
          </View>

          <LinearGradient colors={[...gradients.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.upcoming}>
            <View style={styles.when}>
              <Ionicons name="calendar-outline" size={22} color={colors.white} />
              <AppText variant="bodyStrong" color={colors.white}>
                {t('home.upcomingWhen')}
              </AppText>
            </View>
            <View style={styles.who}>
              <LinearGradient colors={[...gradients.avatar]} style={styles.avatarSmall}>
                <AppText variant="bodyStrong" color={colors.white}>
                  DA
                </AppText>
              </LinearGradient>
              <View style={styles.col}>
                <AppText variant="h3" color={colors.white}>
                  {t('home.upcomingDoctor')}
                </AppText>
                <AppText variant="secondary" color={colors.white}>
                  {t('home.upcomingKind')}
                </AppText>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={t('home.message')} style={styles.round}>
                <Ionicons name="chatbubble-outline" size={22} color={colors.white} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={t('home.call')} style={styles.round}>
                <Ionicons name="call-outline" size={22} color={colors.white} />
              </Pressable>
            </View>
          </LinearGradient>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  hero: { borderBottomStartRadius: 34, borderBottomEndRadius: 34, paddingBottom: 24 },
  pad: { paddingHorizontal: 20, gap: 12 },
  col: { flex: 1 },
  greet: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  hello: { fontSize: 22, lineHeight: 28 },
  bell: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingStart: 14,
    paddingEnd: 4,
    borderRadius: 20,
    backgroundColor: colors.white,
    ...shadows.card,
  },
  filter: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.tealTint, alignItems: 'center', justifyContent: 'center' },
  care: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  careIcon: { backgroundColor: 'rgba(255,255,255,0.16)' },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 110, gap: 16 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, alignItems: 'center', gap: 6, minHeight: 96 },
  tileLabel: { fontWeight: '600', textAlign: 'center' },
  chips: { gap: 8, paddingEnd: 20 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { height: 30, paddingHorizontal: 10, borderRadius: 8, backgroundColor: colors.tealTint, justifyContent: 'center' },
  labelText: { fontWeight: '700', letterSpacing: 0.3 },
  see: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 },
  bold: { fontWeight: '700' },
  upcoming: { borderRadius: 24, padding: 18, gap: 12, ...shadows.button },
  when: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarSmall: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  round: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
