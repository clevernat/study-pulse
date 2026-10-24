"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { subscribeCollection } from "./firestore";

/** Live list of users/{uid}/{col}. `loading` is true until the first snapshot. */
export function useCollection<T extends { id: string }>(col: string) {
  const { user } = useAuth();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user) return;
    return subscribeCollection<T>(user.uid, col, (list) => {
      setItems(list);
      setLoading(false);
    });
  }, [user, col]);
  return { items, loading, uid: user?.uid ?? "" };
}
