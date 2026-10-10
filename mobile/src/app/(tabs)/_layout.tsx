import { Pressable } from 'react-native';
import type { ColorValue, PressableProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useT } from '../../store/settings';
import { colors, shadows } from '../../theme';

type IconName = keyof typeof Ionicons.glyphMap;

const icon = (name: IconName, focusedName: IconName) =>
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Ionicons name={focused ? focusedName : name} size={24} color={color} />;
  };

/** Tab button with a fully rounded filled pill when selected (the default item cannot round its background). */
function TabButton({ children, onPress, onLongPress, style, accessibilityState, accessibilityLabel, testID, ...rest }: PressableProps) {
  // Native passes accessibilityState; web passes aria-selected.
  const selected = !!(accessibilityState?.selected ?? rest['aria-selected']);
  return (
    <Pressable
      accessibilityRole="tab"
      aria-selected={selected}
      accessibilityState={accessibilityState}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[style as object, { borderRadius: 30, backgroundColor: selected ? colors.teal : 'transparent' }]}
    >
      {children}
    </Pressable>
  );
}

/** Floating pill bar: white, radius 36, active tab filled teal with white icon and label (design .nav). */
export default function TabsLayout() {
  const t = useT();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.white,
        tabBarInactiveTintColor: '#4A5B6B',
        tabBarButton: (props) => <TabButton {...props} />,
        tabBarLabelStyle: { fontSize: 14, fontWeight: '600' },
        tabBarItemStyle: { height: 60, marginVertical: 6, marginHorizontal: 2, borderRadius: 30 },
        tabBarStyle: {
          height: 72,
          marginHorizontal: 16,
          marginBottom: 14,
          paddingHorizontal: 8,
          borderRadius: 36,
          borderTopWidth: 0,
          backgroundColor: colors.white,
          ...shadows.nav,
        },
      }}
    >
      <Tabs.Screen name="home" options={{ title: t('tabs.home'), tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen
        name="my-care"
        options={{ title: t('tabs.myCare'), tabBarIcon: icon('heart-outline', 'heart') }}
      />
      <Tabs.Screen
        name="exercises"
        options={{ title: t('tabs.exercises'), tabBarIcon: icon('barbell-outline', 'barbell') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('tabs.profile'), tabBarIcon: icon('person-outline', 'person') }}
      />
    </Tabs>
  );
}
