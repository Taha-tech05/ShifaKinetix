import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../theme';
import { AppText } from './AppText';

interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
}

/** Segmented control (design .seg): grey track, selected segment is a white raised pill. */
export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.track}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[styles.seg, on && styles.on]}
          >
            <AppText variant="secondary" color={on ? colors.navy : colors.disabledText} style={styles.label}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', backgroundColor: colors.neutralTint, borderRadius: 20, padding: 4 },
  seg: { flex: 1, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  on: {
    backgroundColor: colors.white,
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  label: { fontWeight: '600' },
});
