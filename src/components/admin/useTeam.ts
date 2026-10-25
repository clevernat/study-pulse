"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { subscribeAllProgress, subscribeInvites, subscribeMembers } from "@/lib/firebase/members";
import { alignedDays, signals, type Signal } from "@/lib/progress";
import { localDateStr } from "@/lib/dateUtils";
import { memberColor } from "./charts";
import type { Invite, Member, Progress } from "@/types";

export interface TeamRow {
  member: Member;
  progress: Progress | null;
  /** Last 14 days ending today, oldest first */
  days: number[];
  last7: number;
  prev7: number;
  color: string;
  signals: Signal[];
}

/** Everyone who joined, with their progress summary. Admins only (rules enforce it). */
export function useTeam() {
  const { isAdmin } = useAuth();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  useEffect(() => {
    if (!isAdmin) return;
    const a = subscribeMembers(setMembers), b = subscribeAllProgress(setProgress), c = subscribeInvites(setInvites);
    return () => { a(); b(); c(); };
  }, [isAdmin]);

  const today = localDateStr();
  const rows = useMemo<TeamRow[]>(() => (members ?? []).map((m) => {
    const p = progress.find((x) => x.id === m.id) ?? null;
    const days = p ? alignedDays(p, today) : Array(14).fill(0);
    const sum = (a: number[]) => a.reduce((n, v) => n + v, 0);
    return { member: m, progress: p, days, last7: sum(days.slice(7)), prev7: sum(days.slice(0, 7)), color: memberColor(m.id), signals: p ? signals(p, Date.now()) : [] };
  }).sort((a, b) => b.last7 - a.last7 || a.member.name.localeCompare(b.member.name)), [members, progress, today]);

  return { rows, invites, today, loading: isAdmin && members === null };
}
