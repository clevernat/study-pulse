import type { ReactNode } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { colors, radius, space, tint } from "~/theme";

export type IconName = SymbolViewProps["name"];

export function Icon({ name, size = 20, color = colors.textMuted }: { name: IconName; size?: number; color?: string }) {
  return <SymbolView name={name} size={size} tintColor={color} />;
}

/** A tab screen: scrolls, starts below the status bar, large title on top. */
export function Screen({ title, subtitle, right, children, scroll = true }: {
  title: string; subtitle?: string; right?: ReactNode; children: ReactNode; scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const header = (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
  if (!scroll) {
    return <View style={[styles.screen, { paddingTop: insets.top + space.md }]}>{header}{children}</View>;
  }
  // iOS: the native tab bar adjusts the scroll view for the status bar and tab bar itself.
  // Android: the app draws edge to edge, so add the status bar height here.
  const ios = Platform.OS === "ios";
  return (
    <ScrollView style={styles.screenBg} contentContainerStyle={[styles.content, { paddingTop: (ios ? 0 : insets.top) + space.md, paddingBottom: space.xl }]}
      contentInsetAdjustmentBehavior={ios ? "automatic" : "never"} keyboardShouldPersistTaps="handled">
      {header}
      {children}
    </ScrollView>
  );
}

export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
        {right}
      </View>
      <View style={{ gap: space.sm }}>{children}</View>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

type ButtonKind = "primary" | "secondary" | "ghost" | "danger";
export function Button({ label, onPress, kind = "primary", icon, disabled, busy, testID, style }: {
  label: string; onPress: () => void; kind?: ButtonKind; icon?: IconName; disabled?: boolean; busy?: boolean; testID?: string; style?: StyleProp<ViewStyle>;
}) {
  const fg = kind === "primary" ? colors.onPrimaryStrong : kind === "danger" ? colors.error : colors.text;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled || !!busy }}
      disabled={disabled || busy}
      onPress={() => { Haptics.selectionAsync().catch(() => undefined); onPress(); }}
      style={({ pressed }) => [styles.button, styles[`button_${kind}`], (disabled || busy) && { opacity: 0.5 }, pressed && { opacity: 0.75 }, style]}>
      {busy ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, color = colors.textMuted }: { label: string; color?: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: tint(color) }]}>
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

export function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

export function StatRow({ stats }: { stats: { label: string; value: string | number }[] }) {
  return (
    <View style={styles.statRow}>
      {stats.map((s) => (
        <View key={s.label} style={styles.stat} accessible accessibilityLabel={`${s.label}: ${s.value}`}>
          <Text style={styles.statValue}>{s.value}</Text>
          <Text style={styles.statLabel}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function Loading() {
  return <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>;
}

export const styles = StyleSheet.create({
  screenBg: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.lg },
  content: { paddingHorizontal: space.lg, gap: space.xl },
  header: { flexDirection: "row", alignItems: "center", gap: space.md },
  title: { color: colors.text, fontSize: 30, fontWeight: "700", letterSpacing: -0.5 },
  subtitle: { color: colors.textMuted, fontSize: 15, marginTop: 2 },
  section: { gap: space.sm },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: radius.md, padding: space.md },
  button: { minHeight: 48, borderRadius: radius.md, paddingHorizontal: space.lg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm },
  button_primary: { backgroundColor: colors.primaryStrong },
  button_secondary: { backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.border },
  button_ghost: { backgroundColor: "transparent" },
  button_danger: { backgroundColor: tint(colors.error, 0.12) },
  buttonText: { fontSize: 16, fontWeight: "600" },
  chip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  chipText: { fontSize: 12, fontWeight: "600" },
  empty: { color: colors.outline, fontSize: 14, paddingVertical: space.sm },
  statRow: { flexDirection: "row", gap: space.sm },
  stat: { flex: 1, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: space.md, gap: 2 },
  statValue: { color: colors.text, fontSize: 20, fontWeight: "700", fontVariant: ["tabular-nums"] },
  statLabel: { color: colors.textMuted, fontSize: 12 },
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
});
