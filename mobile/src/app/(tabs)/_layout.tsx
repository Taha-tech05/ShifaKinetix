import { router, Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { useT } from '../../store/settings';
import { GlassNav } from '../../ui/GlassNav';
import type { NavItem } from '../../ui/GlassNav';

const ICONS: Record<string, { icon: NavItem['icon']; active: NavItem['icon']; label: 'tabs.home' | 'tabs.myCare' | 'tabs.exercises' | 'tabs.profile' }> = {
  home: { icon: 'home-outline', active: 'home', label: 'tabs.home' },
  'my-care': { icon: 'heart-outline', active: 'heart', label: 'tabs.myCare' },
  exercises: { icon: 'barbell-outline', active: 'barbell', label: 'tabs.exercises' },
  profile: { icon: 'person-outline', active: 'person', label: 'tabs.profile' },
};

/** Floating glass bottom bar (shared component) with a raised centre "+" that starts symptom reporting. */
function TabBar({ state, navigation }: BottomTabBarProps) {
  const t = useT();
  const items: NavItem[] = state.routes.map((route, i) => {
    const meta = ICONS[route.name];
    return {
      key: route.key,
      label: t(meta.label),
      icon: meta.icon,
      activeIcon: meta.active,
      active: state.index === i,
      onPress: () => {
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (state.index !== i && !event.defaultPrevented) navigation.navigate(route.name, route.params);
      },
    };
  });
  return <GlassNav items={items} centerLabel={t('home.tileReport')} onCenter={() => router.push('/report/intro')} />;
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="my-care" />
      <Tabs.Screen name="exercises" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
