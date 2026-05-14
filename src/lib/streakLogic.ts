export function computeStreak(dates: string[], today: string): number {
  if (dates.length === 0) return 0;
  const uniqueDates = Array.from(new Set(dates)).sort().reverse();
  let streak = 0;
  const base = new Date(today);
  for (let i = 0; i < uniqueDates.length; i++) {
    const expected = new Date(base);
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().split("T")[0];
    if (uniqueDates[i] === expectedStr) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export function hasPerfectWeek(dates: string[], today: string): boolean {
  return computeStreak(dates, today) >= 7;
}

export function computeLongestStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const uniqueDates = Array.from(new Set(dates)).sort();
  let longest = 1;
  let current = 1;
  for (let i = 1; i < uniqueDates.length; i++) {
    const prev = new Date(uniqueDates[i - 1]);
    const curr = new Date(uniqueDates[i]);
    const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }
  return longest;
}
