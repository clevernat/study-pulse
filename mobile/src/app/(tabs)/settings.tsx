import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { useAuth } from "@/context/AuthContext";
import { saveUserPreferences } from "@/lib/firebase/firestore";
import { useTimerStore } from "@/store/timerStore";
import { Button, Card, Icon, Screen, Section } from "~/components/ui";
import { DateTimeField, SwitchRow } from "~/components/form";
import { usePhoneSettings } from "~/lib/phone-settings";
import { ensurePermission, Notifications } from "~/lib/notifications";
import { colors, space } from "~/theme";

const WEBSITE = "https://studypulse-tracker-app.web.app";

export default function Settings() {
  const { user, logOut } = useAuth();
  const phone = usePhoneSettings();
  const focus = useTimerStore((s) => s.pomodoroLength);
  const shortBreak = useTimerStore((s) => s.shortBreak);
  const longBreak = useTimerStore((s) => s.longBreak);

  // Same as the website: saved to your account, so every device uses the new lengths.
  const setLengths = (f: number, sb: number, lb: number) => {
    const ts = useTimerStore.getState();
    if (ts.state === "idle") ts.setDurations(f, sb, lb);
    else useTimerStore.setState({ pomodoroLength: f, shortBreak: sb, longBreak: lb });
    if (user) saveUserPreferences(user.uid, { pomodoroLength: f, shortBreak: sb, longBreak: lb });
  };

  const turnOnReminders = async (on: boolean) => {
    if (on && !(await ensurePermission())) {
      Alert.alert("Notifications are off", "Allow notifications for this app in your phone's Settings, then try again.");
      return;
    }
    phone.set({ remindersOn: on });
  };

  const sendTest = async () => {
    if (!Notifications) return Alert.alert("Notifications are not available", "They do not work in this test version of the app on this phone.");
    const off = () => Alert.alert("Notifications are off", "Allow notifications for this app in your phone's Settings, then try again.");
    if (!(await ensurePermission())) return off();
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title: "StudyPulse test", body: "Reminders work on this phone." },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 },
      });
      Alert.alert("Test sent", "Lock your phone. The test arrives in 5 seconds.");
    } catch {
      off();
    }
  };

  const signOut = () => Alert.alert("Sign out?", undefined, [
    { text: "Cancel", style: "cancel" },
    { text: "Sign out", style: "destructive", onPress: () => logOut() },
  ]);

  return (
    <Screen title="Settings">
      <Card style={s.profile}>
        <View style={s.avatar}><Text style={s.avatarText}>{(user?.email ?? "?").slice(0, 1).toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.strong} numberOfLines={1}>{user?.displayName || "Signed in"}</Text>
          <Text style={s.muted} numberOfLines={1}>{user?.email}</Text>
        </View>
      </Card>

      <Section title="Timer lengths (all devices)">
        <Card style={{ gap: space.sm }}>
          <Stepper label="Focus" value={focus} min={5} max={120} step={5} onChange={(v) => setLengths(v, shortBreak, longBreak)} />
          <Stepper label="Short break" value={shortBreak} min={1} max={30} step={1} onChange={(v) => setLengths(focus, v, longBreak)} />
          <Stepper label="Long break" value={longBreak} min={5} max={60} step={5} onChange={(v) => setLengths(focus, shortBreak, v)} />
        </Card>
      </Section>

      <Section title="Notifications on this phone">
        <Card style={{ gap: space.sm }}>
          <SwitchRow testID="settings-reminders" label="Reminders" hint="Tasks, exams, classes, study blocks and habits, for the next 2 weeks"
            value={phone.remindersOn} onChange={turnOnReminders} />
          {phone.remindersOn && (
            <View style={{ paddingBottom: space.sm, gap: space.sm }}>
              <SwitchRow label="Daily plan" hint="A morning summary of your day" value={!!phone.dailySummaryTime}
                onChange={(on) => phone.set({ dailySummaryTime: on ? "08:00" : "" })} />
              {!!phone.dailySummaryTime && <DateTimeField mode="time" label="Daily plan time" value={phone.dailySummaryTime} onChange={(v) => phone.set({ dailySummaryTime: v })} />}
            </View>
          )}
          <SwitchRow label="Timer alerts" hint="When a focus or break ends, even if the app is closed" value={phone.timerAlertsOn}
            onChange={async (on) => { if (on) await ensurePermission(); phone.set({ timerAlertsOn: on }); }} />
          <Button label="Send a test notification" kind="secondary" onPress={sendTest} style={{ marginTop: space.sm }} />
        </Card>
      </Section>

      <Section title="More">
        <Card style={{ gap: 0, paddingVertical: space.xs }}>
          <Row label="Open the website" hint="Subjects, decks, exams, timetable, reports" icon={{ ios: "safari", android: "open_in_browser" }}
            onPress={() => WebBrowser.openBrowserAsync(WEBSITE)} />
        </Card>
      </Section>

      <Button label="Sign out" kind="danger" onPress={signOut} testID="settings-sign-out" />
      <Text style={s.version}>StudyPulse {Constants.expoConfig?.version ?? ""}</Text>
    </Screen>
  );
}

function Stepper({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  const btn = (delta: number, icon: "minus" | "plus") => {
    const next = Math.min(max, Math.max(min, value + delta));
    return (
      <Pressable onPress={() => next !== value && onChange(next)} disabled={next === value} hitSlop={6}
        accessibilityRole="button" accessibilityLabel={`${icon === "plus" ? "More" : "Less"} ${label}`}
        style={[s.stepBtn, next === value && { opacity: 0.3 }]}>
        <Icon name={{ ios: icon, android: icon === "plus" ? "add" : "remove" }} size={16} color={colors.text} />
      </Pressable>
    );
  };
  return (
    <View style={s.stepper} accessible={false}>
      <Text style={[s.strong, { flex: 1 }]}>{label}</Text>
      {btn(-step, "minus")}
      <Text style={s.stepValue} accessibilityLabel={`${label}: ${value} minutes`}>{value} min</Text>
      {btn(step, "plus")}
    </View>
  );
}

function Row({ label, hint, icon, onPress }: { label: string; hint?: string; icon: import("~/components/ui").IconName; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}>
      <Icon name={icon} size={20} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={s.strong}>{label}</Text>
        {hint ? <Text style={s.muted}>{hint}</Text> : null}
      </View>
      <Icon name={{ ios: "arrow.up.right", android: "open_in_new" }} size={14} color={colors.outline} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  profile: { flexDirection: "row", alignItems: "center", gap: space.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.raisedHigh, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.primary, fontSize: 18, fontWeight: "700" },
  strong: { color: colors.text, fontSize: 16 },
  muted: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  stepper: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 48 },
  stepBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.raised, borderColor: colors.border, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  stepValue: { color: colors.text, fontSize: 16, fontVariant: ["tabular-nums"], minWidth: 64, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 56 },
  version: { color: colors.outline, fontSize: 12, textAlign: "center" },
});
