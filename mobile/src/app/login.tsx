import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { Button, Card, Icon } from "~/components/ui";
import { colors, radius, space } from "~/theme";

const WRONG = "Email or password is wrong. If you use Google on the website, set a password there first (Settings → Phone app sign-in).";
const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": WRONG,
  "auth/user-not-found": WRONG,
  "auth/wrong-password": WRONG,
  "auth/invalid-email": "This email address is not valid.",
  "auth/too-many-requests": "Too many tries. Wait a minute and try again.",
  "auth/network-request-failed": "No internet connection.",
};

export default function Login() {
  const { signIn, resetPassword } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async () => {
    setMessage(null);
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      setMessage({ ok: false, text: MESSAGES[code] ?? "Could not sign in. Try again." });
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email.trim()) return setMessage({ ok: false, text: "Type your email first." });
    try {
      await resetPassword(email);
      setMessage({ ok: true, text: "We sent you an email to set a new password." });
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      setMessage({ ok: false, text: MESSAGES[code] ?? "Could not send the email. Try again." });
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[s.page, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + space.xl }]} keyboardShouldPersistTaps="handled">
        <View style={s.brand}>
          <View style={s.logo}><Icon name={{ ios: "waveform.path.ecg", android: "monitor_heart" }} size={28} color={colors.primary} /></View>
          <Text style={s.title}>StudyPulse</Text>
          <Text style={s.subtitle}>Sign in to see your plan, cards and timer.</Text>
        </View>

        <Card style={{ gap: space.md, padding: space.lg }}>
          <Text style={s.label} nativeID="email-label">Email</Text>
          <TextInput testID="login-email" accessibilityLabelledBy="email-label" style={s.input} value={email} onChangeText={setEmail}
            autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress"
            placeholder="you@example.com" placeholderTextColor={colors.outline} returnKeyType="next" />
          <Text style={s.label} nativeID="password-label">Password</Text>
          <TextInput testID="login-password" accessibilityLabelledBy="password-label" style={s.input} value={password} onChangeText={setPassword}
            secureTextEntry autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={submit} />
          <Button testID="login-submit" label="Sign in" onPress={submit} busy={busy} disabled={!email || !password} />
          <Button label="Forgot password?" kind="ghost" onPress={forgot} />
          {message && <Text accessibilityLiveRegion="polite" style={[s.message, { color: message.ok ? colors.green : colors.error }]}>{message.text}</Text>}
        </Card>

        <Text style={s.help}>
          Use the same account as the website. If you sign in with Google there, open the website → Settings → Phone app sign-in, and set a password.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: space.lg, gap: space.xl },
  brand: { alignItems: "center", gap: space.sm },
  logo: { width: 56, height: 56, borderRadius: 16, backgroundColor: colors.raised, borderColor: colors.border, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 28, fontWeight: "700" },
  subtitle: { color: colors.textMuted, fontSize: 15, textAlign: "center" },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  input: { backgroundColor: colors.raised, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, minHeight: 48, color: colors.text, fontSize: 16 },
  message: { fontSize: 14, lineHeight: 20 },
  help: { color: colors.outline, fontSize: 13, lineHeight: 19, textAlign: "center" },
});
