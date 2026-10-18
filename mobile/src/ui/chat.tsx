import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useT } from '../store/settings';
import { Chip } from './Chip';
import { useTheme } from './ThemeProvider';
import { font } from './theme';

/** The small "ShifaKinetix" avatar and name above a bot message, so bot and patient are told apart by more than colour. */
function BotLabel() {
  const { colors } = useTheme();
  return (
    <View style={styles.botLabel}>
      <View style={[styles.avatar, { backgroundColor: colors.accentFill }]}>
        <Ionicons name="pulse" size={12} color={colors.onAccent} />
      </View>
      <Text style={[font.caption, { color: colors.muted, fontSize: 12, lineHeight: 16, fontWeight: '700' }]}>ShifaKinetix</Text>
    </View>
  );
}

/**
 * A message from the app: neutral solid bubble with the small ShifaKinetix label.
 * tone "caution" = safety or instruction note (warning tint with a warning icon), "ai" = AI-generated content (own tint and tag),
 * "alert" = red flag only (red).
 */
export function BotBubble({ children, tone = 'normal', label }: { children: React.ReactNode; tone?: 'normal' | 'alert' | 'caution' | 'ai'; label?: string }) {
  const { colors } = useTheme();
  const t = useT();
  const fill = tone === 'caution' ? colors.cautionTint : tone === 'ai' ? colors.aiTint : tone === 'alert' ? colors.dangerTint : colors.bubble;
  const border = tone === 'alert' ? colors.danger : tone === 'caution' ? colors.cautionBase : tone === 'ai' ? colors.ai : colors.glassBorder;
  return (
    <View style={styles.botRow}>
      <View style={[styles.bubble, { backgroundColor: fill, borderColor: border }]} accessible accessibilityLabel={label}>
        <BotLabel />
        {tone === 'caution' ? <Ionicons name="warning-outline" size={20} color={colors.caution} /> : null}
        {typeof children === 'string' ? <Text style={[font.body, { color: colors.text }]}>{children}</Text> : children}
        {tone === 'ai' ? <Chip tone="ai" label={t('scene.aiTag')} icon="sparkles-outline" /> : null}
      </View>
    </View>
  );
}

/** The patient's answer: right-aligned solid accent bubble, with a small check so it reads as "you" without relying on colour. */
export function UserBubble({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.userRow}>
      <View style={[styles.bubble, styles.userBubble, { backgroundColor: colors.accentFill, borderColor: colors.accentFill, flexDirection: 'row', alignItems: 'center' }]}>
        <Ionicons name="checkmark-circle" size={18} color={colors.onAccent} />
        <Text style={[font.body, { color: colors.onAccent, fontWeight: '700', flexShrink: 1 }]}>{text}</Text>
      </View>
    </View>
  );
}

function Dot({ index, still }: { index: number; still: boolean }) {
  const { colors } = useTheme();
  const v = useSharedValue(0.35);
  useEffect(() => {
    if (still) return;
    v.value = withDelay(index * 160, withRepeat(withSequence(withTiming(1, { duration: 320 }), withTiming(0.35, { duration: 320 })), -1));
  }, [index, still, v]);
  const style = useAnimatedStyle(() => ({ opacity: still ? 0.7 : v.value }));
  return <Animated.View style={[styles.dot, { backgroundColor: colors.muted }, style]} />;
}

/** Three pulsing dots in a bot bubble, shown before each new message. Static when the phone asks for reduced motion. */
export function TypingDots({ label, still = false }: { label: string; still?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.botRow}>
      <View style={[styles.bubble, styles.dots, { backgroundColor: colors.bubble, borderColor: colors.glassBorder }]} accessible accessibilityLabel={label} accessibilityLiveRegion="polite">
        {[0, 1, 2].map((i) => (
          <Dot key={i} index={i} still={still} />
        ))}
      </View>
    </View>
  );
}

/** True for a moment each time `key` changes, so the typing dots can show before the new message. Never delays when `skip` is set. */
export function useTypingDelay(key: string, skip: boolean, ms = 320): boolean {
  const [typing, setTyping] = useState(!skip);
  const [seen, setSeen] = useState(key);
  if (seen !== key) {
    setSeen(key);
    setTyping(!skip);
  }
  useEffect(() => {
    if (!typing) return;
    const id = setTimeout(() => setTyping(false), ms);
    return () => clearTimeout(id);
  }, [typing, key, ms]);
  return typing;
}

/** A row of answer chips that wraps. */
export function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.chips}>{children}</View>;
}

const styles = StyleSheet.create({
  botRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  userRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  bubble: { maxWidth: '88%', borderRadius: 22, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, gap: 6 },
  botLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avatar: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  userBubble: { borderBottomEndRadius: 6 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 16 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
