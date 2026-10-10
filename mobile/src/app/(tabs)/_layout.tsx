import type { ColorValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useT } from '../../store/settings';
import { colors, MIN_TAP } from '../../theme';

type IconName = keyof typeof Ionicons.glyphMap;

const icon = (name: IconName, focusedName: IconName) =>
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Ionicons name={focused ? focusedName : name} size={24} color={color} />;
  };

export default function TabsLayout() {
  const t = useT();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.muted,
        // Icon and label always shown together, label never below 14.
        tabBarLabelStyle: { fontSize: 14, fontWeight: '600' },
        tabBarStyle: { minHeight: MIN_TAP + 16, paddingTop: 6, backgroundColor: colors.white },
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
