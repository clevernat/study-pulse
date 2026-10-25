import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useStudyCards, useDeckTotals, useReviewDays } from "@/lib/firebase/useFlashcards";
import { useCollection } from "@/lib/firebase/useCollection";
import { buildQueue } from "@/lib/flashcards/queue";
import { dayTotals } from "@/lib/flashcards/reviewDays";
import { getColor } from "@/lib/colorPalette";
import { localDateStr } from "@/lib/dateUtils";
import type { Subject } from "@/types";
import { Button, Card, Dot, Empty, Icon, Loading, Screen, Section, StatRow } from "~/components/ui";
import { colors, space } from "~/theme";

export default function Study() {
  const { decks, cards, logsToday, loading } = useStudyCards();
  const subjects = useCollection<Subject>("subjects").items;
  const totals = useDeckTotals(decks.map((d) => d.id));
  const days = useReviewDays().items;
  const today = localDateStr();
  const now = new Date();

  if (loading) return <Loading />;
  const all = buildQueue(cards, decks, logsToday, now, today);
  const allDue = all.counts.new + all.counts.learning + all.counts.review;
  const t = dayTotals(days.find((d) => d.id === today));

  return (
    <Screen title="Study" subtitle="Flashcards">
      <StatRow stats={[
        { label: "Due now", value: allDue },
        { label: "Answered today", value: t.cards },
        { label: "Correct today", value: t.cards ? `${t.correctPct}%` : "–" },
      ]} />
      {allDue > 0 && <Button testID="study-all" label={`Study all (${allDue})`} icon={{ ios: "play.fill", android: "play_arrow" }} onPress={() => router.push("/review")} />}

      <Section title="Decks">
        {decks.length === 0 && <Empty text="No decks yet. Add decks and cards on the website; they show up here." />}
        {decks.map((deck) => {
          const q = buildQueue(cards, [deck], logsToday, now, today);
          const due = q.counts.new + q.counts.learning + q.counts.review;
          const sub = subjects.find((x) => x.id === deck.subjectId);
          return (
            <Pressable key={deck.id} testID={`deck-${deck.id}`} disabled={due === 0} onPress={() => router.push({ pathname: "/review", params: { deck: deck.id } })}
              accessibilityRole="button" accessibilityLabel={`${deck.name}, ${due} due`} accessibilityState={{ disabled: due === 0 }}>
              {({ pressed }) => (
                <Card style={[s.deck, pressed && { opacity: 0.7 }]}>
                  <Dot color={getColor(sub?.color ?? "violet").dot} size={10} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.name} numberOfLines={1}>{deck.name}</Text>
                    <Text style={s.muted}>{totals[deck.id] ?? "…"} cards{sub ? ` · ${sub.name}` : ""}</Text>
                  </View>
                  <View style={s.counts} accessible accessibilityLabel={`${q.counts.new} new, ${q.counts.learning} learning, ${q.counts.review} review`}>
                    <Text style={[s.count, { color: colors.primary }]}>{q.counts.new}</Text>
                    <Text style={[s.count, { color: colors.error }]}>{q.counts.learning}</Text>
                    <Text style={[s.count, { color: colors.green }]}>{q.counts.review}</Text>
                  </View>
                  {due > 0 && <Icon name={{ ios: "chevron.right", android: "chevron_right" }} size={14} color={colors.outline} />}
                </Card>
              )}
            </Pressable>
          );
        })}
      </Section>
      {decks.length > 0 && <Text style={s.legend}>New · Learning · Review</Text>}
    </Screen>
  );
}

const s = StyleSheet.create({
  deck: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 64 },
  name: { color: colors.text, fontSize: 16, fontWeight: "500" },
  muted: { color: colors.textMuted, fontSize: 13 },
  counts: { flexDirection: "row", gap: space.sm },
  count: { fontSize: 15, fontWeight: "600", fontVariant: ["tabular-nums"], minWidth: 20, textAlign: "right" },
  legend: { color: colors.outline, fontSize: 12, textAlign: "right", marginTop: -space.md },
});
