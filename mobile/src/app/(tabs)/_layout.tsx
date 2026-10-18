import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { useT } from '../../store/settings';
import { GlassNav } from '../../ui/GlassNav';
import type { NavItem } from '../../ui/GlassNav';

const ICONS: Record<string, { icon: NavItem['icon']; active: NavItem['icon']; label: 'tabs.home' | 'tabs.myCare' | 'tabs.exercises' | 'tabs.profile' }> = {
  home: { icon: 'home-outline', active: 'home', label: 'tabs.home' },
  'my-care': { icon: 'medkit-outline', active: 'medkit', label: 'tabs.myCare' },
  exercises: { icon: 'clipboard-outline', active: 'clipboard', label: 'tabs.exercises' },
  profile: { icon: 'person-outline', active: 'person', label: 'tabs.profile' },
};

/** Floating bottom bar (shared component): round icon buttons, the selected tab a labelled pill. */
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
  return <GlassNav items={items} />;
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, animation: 'fade', sceneStyle: { backgroundColor: 'transparent' } }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="my-care" />
      <Tabs.Screen name="exercises" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
