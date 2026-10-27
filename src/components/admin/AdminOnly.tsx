"use client";
import { useAuth } from "@/context/AuthContext";
import { EmptyState } from "@/components/ui/Field";

/** Shows its children to admins only. Firestore rules protect the data either way. */
export default function AdminOnly({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <EmptyState icon="lock" title="Admins only" text="Ask an admin if you need access to this page." />;
  return <>{children}</>;
}
