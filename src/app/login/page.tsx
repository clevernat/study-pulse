"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

function friendlyError(code: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Invalid email or password. Please try again.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    case "auth/popup-closed-by-user":
      return "Google sign-in was cancelled.";
    case "auth/network-request-failed":
      return "Network error. Please check your connection.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { signIn, signUp, signInWithGoogle } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
      router.push("/");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setError(friendlyError(code));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setSubmitting(true);
    try {
      await signInWithGoogle();
      router.push("/");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setError(friendlyError(code));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden px-4">
      {/* Background decoration */}
      <div
        className="absolute -left-48 -top-48 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(124,58,237,0.07) 0%, transparent 70%)" }}
      />
      <div
        className="absolute -right-48 -bottom-48 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(64,239,183,0.05) 0%, transparent 70%)" }}
      />

      <div className="w-full max-w-md relative z-10">
        {/* Card */}
        <div className="bg-[#12121a] border border-[#252535] rounded-2xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <h1 className="font-grotesk text-[32px] font-bold text-primary tracking-tighter leading-none">
              StudyPulse
            </h1>
            <p className="text-on-surface-variant text-sm font-inter mt-1">Your Academic Edge</p>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-[#0e0e11] rounded-xl p-1 mb-6">
            <button
              type="button"
              onClick={() => { setMode("signin"); setError(""); }}
              className={`flex-1 py-2 rounded-lg text-sm font-inter font-semibold transition-all ${
                mode === "signin"
                  ? "bg-primary-container text-on-primary-container"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode("signup"); setError(""); }}
              className={`flex-1 py-2 rounded-lg text-sm font-inter font-semibold transition-all ${
                mode === "signup"
                  ? "bg-primary-container text-on-primary-container"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-on-surface-variant text-sm font-inter mb-1 block">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="bg-[#0e0e11] border border-outline-variant rounded-lg px-4 py-3 text-on-surface w-full focus:outline-none focus:border-primary transition-colors font-inter text-sm placeholder:text-on-surface-variant/40"
              />
            </div>
            <div>
              <label className="text-on-surface-variant text-sm font-inter mb-1 block">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "Min. 6 characters" : "Enter your password"}
                required
                className="bg-[#0e0e11] border border-outline-variant rounded-lg px-4 py-3 text-on-surface w-full focus:outline-none focus:border-primary transition-colors font-inter text-sm placeholder:text-on-surface-variant/40"
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-error text-sm font-inter bg-error/10 border border-error/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary-container text-on-primary-container py-3 rounded-xl font-bold font-inter text-sm mt-1 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="w-4 h-4 rounded-full border-2 border-on-primary-container border-t-transparent animate-spin" />
              ) : null}
              {mode === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-outline-variant" />
            <span className="text-on-surface-variant text-xs font-inter">or</span>
            <div className="flex-1 h-px bg-outline-variant" />
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={submitting}
            className="w-full border border-outline-variant text-on-surface py-3 rounded-xl font-inter font-semibold text-sm hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2045C17.64 8.5663 17.5827 7.9527 17.4764 7.3636H9V10.845H13.8436C13.635 11.97 13.0009 12.9231 12.0477 13.5613V15.8195H14.9564C16.6582 14.2527 17.64 11.9454 17.64 9.2045Z" fill="#4285F4"/>
              <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5613C11.2418 14.1013 10.2109 14.4204 9 14.4204C6.65591 14.4204 4.67182 12.8372 3.96409 10.71H0.957275V13.0418C2.43818 15.9831 5.48182 18 9 18Z" fill="#34A853"/>
              <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.5931 3.68182 9C3.68182 8.4068 3.78409 7.8299 3.96409 7.29V4.9581H0.957275C0.347727 6.1731 0 7.5477 0 9C0 10.4522 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
              <path d="M9 3.5795C10.3214 3.5795 11.5077 4.0336 12.4405 4.9259L15.0218 2.3445C13.4632 0.8918 11.4259 0 9 0C5.48182 0 2.43818 2.0168 0.957275 4.9581L3.96409 7.29C4.67182 5.1627 6.65591 3.5795 9 3.5795Z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-center gap-8 mt-6">
          {[
            { stat: "10K+", label: "Students" },
            { stat: "4.9★", label: "Rating" },
            { stat: "100%", label: "Free" },
          ].map(({ stat, label }) => (
            <div key={label} className="text-center">
              <div className="font-jetbrains font-semibold text-primary text-sm">{stat}</div>
              <div className="text-on-surface-variant text-xs font-inter mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
