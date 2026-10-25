"use client";
import { useState } from "react";
import AdminOnly from "@/components/admin/AdminOnly";
import { useTeam } from "@/components/admin/useTeam";
import { Avatar } from "@/components/admin/charts";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { inputCls, primaryBtnCls } from "@/components/ui/Field";
import { useAuth } from "@/context/AuthContext";
import { OWNER_EMAIL, canEmailInvites, cancelInvite, emailInvite, invite, removeMember, setRole } from "@/lib/firebase/members";
import type { Member, Role } from "@/types";

const ROLES: { value: Role; label: string; icon: string; text: string }[] = [
  { value: "user", label: "Member", icon: "person", text: "Studies with StudyPulse. No admin pages." },
  { value: "admin", label: "Admin", icon: "admin_panel_settings", text: "Also sees everyone's progress and manages people." },
];

const signUpLink = (email: string) => `${window.location.origin}/login/?mode=signup&email=${encodeURIComponent(email)}`;

function RoleSwitch({ value, onChange, disabled, name }: { value: Role; onChange: (r: Role) => void; disabled?: boolean; name: string }) {
  return (
    <div role="radiogroup" aria-label={`Role for ${name}`} className="inline-flex bg-surface-container-lowest border border-outline-variant rounded-lg p-0.5">
      {ROLES.map((r) => (
        <button key={r.value} type="button" role="radio" aria-checked={value === r.value} disabled={disabled}
          data-testid={`role-${r.value}`} onClick={() => value !== r.value && onChange(r.value)}
          className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors disabled:opacity-50 ${value === r.value ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:text-on-surface"}`}>
          {r.label}
        </button>
      ))}
    </div>
  );
}

function CopyButton({ text, label = "Copy sign-up link" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); } catch { window.prompt("Copy this link:", text); } }}
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
      <span aria-hidden="true" className="material-symbols-outlined text-[15px]">{done ? "check" : "link"}</span>{done ? "Copied" : label}
    </button>
  );
}

function PeoplePage() {
  const { user } = useAuth();
  const { rows, invites, loading } = useTeam();
  const [email, setEmail] = useState("");
  const [role, setNewRole] = useState<Role>("user");
  const [error, setError] = useState("");
  const [justInvited, setJustInvited] = useState("");
  const [removing, setRemoving] = useState<Member | null>(null);
  /** Email status per invited address */
  const [mail, setMail] = useState<Record<string, "sending" | "sent" | "failed">>({});

  async function sendMail(em: string) {
    setMail((m) => ({ ...m, [em]: "sending" }));
    const ok = await emailInvite(em);
    setMail((m) => ({ ...m, [em]: ok ? "sent" : "failed" }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return setError("Enter a valid email address.");
    if (rows.some((r) => r.member.email === em)) return setError("This person has already joined.");
    setError("");
    await invite(em, role, user!.email ?? "");
    setJustInvited(em);
    setEmail("");
    if (canEmailInvites) await sendMail(em);
  }

  if (loading) return <div className="flex justify-center h-64 items-center"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>;

  return (
    <div className="flex flex-col gap-6 md:gap-8 max-w-3xl">
      <div>
        <h1 className="font-grotesk font-bold text-2xl md:text-3xl text-on-surface">People</h1>
        <p className="text-sm text-on-surface-variant">Invite people as a member or an admin. Only invited emails can join.</p>
      </div>

      {/* Invite */}
      <section className="glass-card p-5 flex flex-col gap-4">
        <h2 className="font-grotesk font-bold text-lg text-on-surface flex items-center gap-2"><span aria-hidden="true" className="material-symbols-outlined text-primary">person_add</span>Invite someone</h2>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-on-surface-variant font-bold">Their email</span>
            <input data-testid="invite-email" className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@example.com" required autoCapitalize="none" />
          </label>
          <div role="radiogroup" aria-label="Role" className="grid sm:grid-cols-2 gap-2">
            {ROLES.map((r) => (
              <button key={r.value} type="button" role="radio" aria-checked={role === r.value} data-testid={`invite-role-${r.value}`} onClick={() => setNewRole(r.value)}
                className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ${role === r.value ? "border-primary bg-primary/10" : "border-outline-variant hover:border-primary/50"}`}>
                <span aria-hidden="true" className={`material-symbols-outlined ${role === r.value ? "text-primary" : "text-on-surface-variant"}`}>{r.icon}</span>
                <span><span className="block text-sm font-bold text-on-surface">{r.label}</span><span className="block text-xs text-on-surface-variant">{r.text}</span></span>
              </button>
            ))}
          </div>
          {error && <p role="alert" className="text-sm text-error">{error}</p>}
          <button data-testid="invite-send" type="submit" className={`${primaryBtnCls} self-start`}>Invite</button>
        </form>
        {justInvited && (
          <div role="status" data-testid="invite-done" className="rounded-xl bg-secondary/10 border border-secondary/25 p-3 text-sm text-on-surface flex flex-col gap-1">
            <span data-testid="invite-mail-status">
              <b>{justInvited}</b> is invited.{" "}
              {mail[justInvited] === "sending" ? "Sending the invite email…"
                : mail[justInvited] === "sent" ? "We emailed them the sign-up link (it may land in spam)."
                : mail[justInvited] === "failed" ? "The email could not be sent. Copy the link below and send it yourself."
                : "Send them this link."}{" "}
              They can sign up with Google or with email, username and password.
            </span>
            <CopyButton text={signUpLink(justInvited)} />
          </div>
        )}
      </section>

      {/* Waiting invites */}
      {invites.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-grotesk font-bold text-lg text-on-surface">Waiting to join ({invites.length})</h2>
          <ul className="glass-card divide-y divide-outline-variant/50">
            {[...invites].sort((a, b) => b.createdAt - a.createdAt).map((i) => (
              <li key={i.id} data-testid="invite-item" className="flex items-center gap-3 px-4 py-3 flex-wrap">
                <span aria-hidden="true" className="w-8 h-8 rounded-full border border-dashed border-outline-variant flex items-center justify-center text-on-surface-variant"><span className="material-symbols-outlined text-[16px]">mail</span></span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-on-surface truncate">{i.email}</p>
                  <p className="text-xs text-on-surface-variant">{i.role === "admin" ? "Admin" : "Member"} · invited {new Date(i.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                </div>
                {canEmailInvites && (
                  <button onClick={() => sendMail(i.email)} disabled={mail[i.email] === "sending"} data-testid="invite-resend" className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50">
                    <span aria-hidden="true" className="material-symbols-outlined text-[15px]">{mail[i.email] === "sent" ? "mark_email_read" : mail[i.email] === "failed" ? "error" : "send"}</span>
                    {mail[i.email] === "sending" ? "Sending…" : mail[i.email] === "sent" ? "Sent" : mail[i.email] === "failed" ? "Failed, retry" : "Email again"}
                  </button>
                )}
                <CopyButton text={signUpLink(i.email)} label="Copy link" />
                <button onClick={() => cancelInvite(i.email)} aria-label={`Cancel invite for ${i.email}`} data-testid="invite-cancel" className="text-xs text-on-surface-variant hover:text-error">Cancel</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Members */}
      <section className="flex flex-col gap-3">
        <h2 className="font-grotesk font-bold text-lg text-on-surface">Members ({rows.length})</h2>
        <ul className="glass-card divide-y divide-outline-variant/50">
          {rows.map(({ member: m, color }) => {
            const locked = m.email === OWNER_EMAIL || m.id === user?.uid; // never demote or remove the owner or yourself
            return (
              <li key={m.id} data-testid="member-item" className="flex items-center gap-3 px-4 py-3 flex-wrap">
                <Avatar name={m.name} color={color} size={36} />
                <div className="flex-1 min-w-[10rem]">
                  <p className="text-sm font-semibold text-on-surface truncate">{m.name}{m.id === user?.uid && <span className="text-on-surface-variant font-normal"> (you)</span>}</p>
                  <p className="text-xs text-on-surface-variant truncate">{m.email}{m.username ? ` · @${m.username}` : ""}</p>
                </div>
                <RoleSwitch name={m.name} value={m.role} disabled={locked} onChange={(r) => setRole(m.id, r)} />
                <button onClick={() => setRemoving(m)} disabled={locked} aria-label={`Remove ${m.name}`} data-testid="member-remove"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-error disabled:opacity-30 disabled:hover:text-on-surface-variant">
                  <span aria-hidden="true" className="material-symbols-outlined text-[18px]">person_remove</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <ConfirmModal
        open={!!removing}
        title="Remove person"
        description={`Remove ${removing?.name ?? ""}? They lose access right away. Their study data is kept; invite them again to give it back.`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        destructive
        icon="person_remove"
        onConfirm={() => { if (removing) removeMember(removing); setRemoving(null); }}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}

export default function AdminPeoplePage() {
  return <AdminOnly><PeoplePage /></AdminOnly>;
}
