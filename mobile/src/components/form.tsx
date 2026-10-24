import { useState, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import * as Haptics from "expo-haptics";
import { colors, radius, space, tint } from "~/theme";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text style={f.label}>{label}</Text>
      {children}
    </View>
  );
}

/** One choice from a short list, as a row of chips (scrolls sideways when long). */
export function ChipPicker<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: string; color?: string }[]; value: T; onChange: (v: T) => void; label: string;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.value === value;
        const color = o.color ?? colors.primary;
        return (
          <Pressable key={o.value} onPress={() => { Haptics.selectionAsync().catch(() => undefined); onChange(o.value); }}
            accessibilityRole="radio" accessibilityState={{ selected: on }}
            style={[f.chip, on && { backgroundColor: tint(color, 0.18), borderColor: color }]}>
            {o.color ? <View style={[f.chipDot, { backgroundColor: o.color }]} /> : null}
            <Text style={[f.chipText, on && { color: colors.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function SwitchRow({ label, hint, value, onChange, testID }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; testID?: string }) {
  return (
    // The whole row toggles (like iOS Settings); the switch only shows the state.
    <Pressable testID={testID} style={f.switchRow} onPress={() => { Haptics.selectionAsync().catch(() => undefined); onChange(!value); }}
      accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label} accessibilityHint={hint}>
      <View style={{ flex: 1 }}>
        <Text style={f.rowLabel}>{label}</Text>
        {hint ? <Text style={f.hint}>{hint}</Text> : null}
      </View>
      <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Switch value={value} trackColor={{ true: colors.primaryStrong, false: colors.border }} thumbColor={Platform.OS === "android" ? colors.text : undefined} />
      </View>
    </Pressable>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
export const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const toTimeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Date ("YYYY-MM-DD") or time ("HH:MM") picker: compact native control on iOS, a button that opens the dialog on Android. */
export function DateTimeField({ mode, value, onChange, label }: { mode: "date" | "time"; value: string; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const asDate = mode === "date" ? new Date(`${value}T12:00:00`) : new Date(`2000-01-01T${value}:00`);
  const set = (d?: Date) => d && onChange(mode === "date" ? toDateStr(d) : toTimeStr(d));
  if (Platform.OS === "ios") {
    return <DateTimePicker value={asDate} mode={mode} display="compact" themeVariant="dark" accentColor={colors.primary}
      onChange={(_e, d) => set(d)} style={{ alignSelf: "flex-start" }} testID={`picker-${mode}`} />;
  }
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={f.androidButton} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`}>
        <Text style={f.rowLabel}>{mode === "date" ? asDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : value}</Text>
      </Pressable>
      {open && <DateTimePicker value={asDate} mode={mode} is24Hour onChange={(e, d) => { setOpen(false); if (e.type === "set") set(d); }} />}
    </>
  );
}

export const f = StyleSheet.create({
  label: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  input: { backgroundColor: colors.raised, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, minHeight: 48, color: colors.text, fontSize: 16 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.raised, paddingHorizontal: space.md, minHeight: 36 },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { color: colors.textMuted, fontSize: 14, fontWeight: "500" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 48 },
  rowLabel: { color: colors.text, fontSize: 16 },
  hint: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  androidButton: { alignSelf: "flex-start", backgroundColor: colors.raised, borderColor: colors.border, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: space.md, minHeight: 40, justifyContent: "center" },
});
