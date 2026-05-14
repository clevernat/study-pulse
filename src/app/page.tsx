"use client";

import Link from "next/link";

// ── Smooth scroll helper ──────────────────────────────────────────────────────

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

// ── Navbar ────────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <nav
      className="fixed top-0 w-full z-50"
      style={{
        background: "rgba(19,19,22,0.80)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderBottom: "1px solid #252535",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <span
          className="text-xl font-bold select-none"
          style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#d2bbff" }}
        >
          StudyPulse
        </span>

        {/* Center nav */}
        <div className="hidden md:flex items-center gap-8">
          {[
            { label: "Features", id: "features" },
            { label: "How It Works", id: "how-it-works" },
            { label: "Stats", id: "stats" },
          ].map(({ label, id }) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className="text-sm transition-colors"
              style={{ color: "#ccc3d8", fontFamily: "'Inter', sans-serif" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#d2bbff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#ccc3d8")}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="hidden sm:inline-flex px-4 py-2 rounded-full text-sm font-medium transition-all"
            style={{
              color: "#d2bbff",
              border: "1px solid rgba(210,187,255,0.25)",
              fontFamily: "'Inter', sans-serif",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(210,187,255,0.6)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(210,187,255,0.25)";
            }}
          >
            Sign In
          </Link>
          <Link
            href="/login"
            className="px-3 sm:px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap"
            style={{
              background: "#7c3aed",
              color: "#fff",
              fontFamily: "'Inter', sans-serif",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#6d28d9";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#7c3aed";
            }}
          >
            <span className="hidden sm:inline">Get Started Free</span>
            <span className="sm:hidden">Get Started</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ── App Mockup ─────────────────────────────────────────────────────────────────

function AppMockup() {
  const barHeights = [55, 75, 38, 90, 62, 22, 35];
  const barDays = ["M", "T", "W", "T", "F", "S", "S"];

  const heatmapRows = 7;
  const heatmapCols = 13;
  const intensities = [0,1,2,0,3,1,2,4,1,0,2,3,1,0,2,1,3,2,0,4,1,2,0,1,3,2,1,0,2,4,1,3,0,2,1,4,2,0,1,3,2,1,4,0,2,1,3,0,2,1,4,2,3,1,0,2,4,1,2,0,3,1,2,4,0,1,3,2,1,4,2,0,3,1,2,4,0,1,3,2,1,4,2,3,0,2,1,4,3,2,1];

  function heatColor(i: number) {
    if (i === 0) return "#1a1a2e";
    if (i === 1) return "rgba(64,239,183,0.2)";
    if (i === 2) return "rgba(64,239,183,0.4)";
    if (i === 3) return "rgba(64,239,183,0.7)";
    return "#40efb7";
  }

  return (
    <div
      className="w-full max-w-4xl mx-auto mt-10 sm:mt-16 rounded-2xl overflow-hidden"
      style={{
        background: "#12121a",
        border: "1px solid #252535",
        boxShadow: "0 0 80px rgba(124,58,237,0.2), 0 40px 80px rgba(0,0,0,0.6)",
      }}
    >
      {/* Window chrome */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ background: "#0e0e14", borderBottom: "1px solid #252535" }}
      >
        <div className="w-3 h-3 rounded-full" style={{ background: "#ff5f57" }} />
        <div className="w-3 h-3 rounded-full" style={{ background: "#febc2e" }} />
        <div className="w-3 h-3 rounded-full" style={{ background: "#28c840" }} />
        <div
          className="ml-4 text-xs px-8 py-1 rounded"
          style={{
            background: "#1a1a24",
            color: "#555570",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          studypulse.app/dashboard
        </div>
      </div>

      {/* App layout */}
      <div className="flex" style={{ minHeight: "380px" }}>
        {/* Mini sidebar */}
        <div
          className="hidden sm:flex flex-col gap-3 p-4 pt-6"
          style={{
            width: "56px",
            background: "#0e0e14",
            borderRight: "1px solid #252535",
          }}
        >
          {["dashboard", "timer", "history_edu", "insights", "track_changes", "settings"].map((icon, i) => (
            <div
              key={icon}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: i === 0 ? "rgba(124,58,237,0.2)" : "transparent",
              }}
            >
              <span
                className="text-base"
                style={{
                  fontFamily: "'Material Symbols Outlined'",
                  color: i === 0 ? "#d2bbff" : "#444460",
                  fontSize: "18px",
                }}
              >
                {icon}
              </span>
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 p-5 flex flex-col gap-4">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div>
              <div
                className="font-bold text-base"
                style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#e5e1e6" }}
              >
                Welcome back, Alex
              </div>
              <div
                className="text-xs mt-0.5"
                style={{ fontFamily: "'Inter', sans-serif", color: "#666680" }}
              >
                Thursday, May 14, 2026
              </div>
            </div>
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{
                background: "rgba(64,239,183,0.1)",
                color: "#40efb7",
                fontFamily: "'JetBrains Mono', monospace",
                border: "1px solid rgba(64,239,183,0.2)",
              }}
            >
              <span style={{ fontFamily: "'Material Symbols Outlined'", fontSize: "14px" }}>local_fire_department</span>
              12 Day Streak
            </div>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "WEEKLY EFFORT", value: "14.2h", icon: "schedule", color: "#d2bbff", bg: "rgba(210,187,255,0.1)" },
              { label: "DAILY AVERAGE", value: "2.4h", icon: "insights", color: "#40efb7", bg: "rgba(64,239,183,0.1)" },
              { label: "FOCUS SCORE", value: "87%", icon: "track_changes", color: "#ffb95f", bg: "rgba(255,185,95,0.1)" },
            ].map(({ label, value, icon, color, bg }) => (
              <div
                key={label}
                className="rounded-xl p-3 flex items-center gap-3"
                style={{ background: "#12121a", border: "1px solid #252535" }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: bg }}
                >
                  <span style={{ fontFamily: "'Material Symbols Outlined'", color, fontSize: "16px" }}>{icon}</span>
                </div>
                <div>
                  <div
                    className="font-bold text-sm"
                    style={{ fontFamily: "'JetBrains Mono', monospace", color: "#e5e1e6" }}
                  >
                    {value}
                  </div>
                  <div
                    className="text-[9px] uppercase tracking-widest mt-0.5"
                    style={{ fontFamily: "'Inter', sans-serif", color: "#555570" }}
                  >
                    {label}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Chart + heatmap row */}
          <div className="grid grid-cols-5 gap-3 flex-1">
            {/* Bar chart */}
            <div
              className="col-span-3 rounded-xl p-4 flex flex-col gap-2"
              style={{ background: "#12121a", border: "1px solid #252535" }}
            >
              <div
                className="text-xs font-bold"
                style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#e5e1e6" }}
              >
                Weekly Study Hours
              </div>
              <div className="flex items-end gap-1.5 flex-1 mt-1" style={{ minHeight: "80px" }}>
                {barHeights.map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex items-end" style={{ height: "72px" }}>
                      <div
                        className="w-full rounded-t"
                        style={{
                          height: `${h}%`,
                          background: h === 90 ? "#40efb7" : "rgba(210,187,255,0.4)",
                          transition: "height 0.3s",
                        }}
                      />
                    </div>
                    <span
                      className="text-[8px]"
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        color: h === 90 ? "#40efb7" : "#444460",
                      }}
                    >
                      {barDays[i]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Heatmap */}
            <div
              className="col-span-2 rounded-xl p-4 flex flex-col gap-2"
              style={{ background: "#12121a", border: "1px solid #252535" }}
            >
              <div
                className="text-xs font-bold"
                style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#e5e1e6" }}
              >
                90-Day Velocity
              </div>
              <div
                className="grid gap-[2px] mt-1"
                style={{ gridTemplateColumns: `repeat(${heatmapCols}, 1fr)` }}
              >
                {Array.from({ length: heatmapRows * heatmapCols }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-[2px]"
                    style={{
                      aspectRatio: "1",
                      background: heatColor(intensities[i % intensities.length]),
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 pt-28 pb-16 sm:pb-24 overflow-hidden"
      style={{ background: "#131316" }}
    >
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(124,58,237,0.3), transparent)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center max-w-5xl w-full">
        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 text-sm font-medium"
          style={{
            background: "rgba(124,58,237,0.15)",
            border: "1px solid rgba(124,58,237,0.4)",
            color: "#d2bbff",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          <span style={{ color: "#7c3aed" }}>✦</span>
          AI-Powered Study Intelligence
        </div>

        {/* Headline */}
        <h1
          className="font-bold leading-[1.05] tracking-tight mb-6"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: "clamp(36px, 7vw, 72px)",
          }}
        >
          <span style={{ color: "#e5e1e6" }}>Study Smarter.</span>
          <br />
          <span style={{ color: "#e5e1e6" }}>Track Everything.</span>
          <br />
          <span style={{ color: "#d2bbff" }}>Achieve More.</span>
        </h1>

        {/* Subheadline */}
        <p
          className="max-w-2xl mb-8 sm:mb-10 leading-relaxed px-2 sm:px-0"
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "clamp(15px, 2.5vw, 20px)",
            color: "#ccc3d8",
          }}
        >
          The AI-powered study tracker that transforms how students learn. Log sessions,
          visualize progress, and build unstoppable momentum.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 mb-10 sm:mb-14 w-full sm:w-auto">
          <Link
            href="/login"
            className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 rounded-full font-bold text-base sm:text-lg transition-all text-center"
            style={{
              background: "#7c3aed",
              color: "#fff",
              fontFamily: "'Inter', sans-serif",
              boxShadow: "0 0 40px rgba(124,58,237,0.4)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#6d28d9";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 60px rgba(124,58,237,0.6)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#7c3aed";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 40px rgba(124,58,237,0.4)";
            }}
          >
            Start Tracking Free →
          </Link>
          <button
            onClick={() => scrollTo("how-it-works")}
            className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 rounded-full font-bold text-base sm:text-lg transition-all"
            style={{
              background: "transparent",
              color: "#d2bbff",
              border: "1px solid rgba(210,187,255,0.3)",
              fontFamily: "'Inter', sans-serif",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(210,187,255,0.7)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(210,187,255,0.3)";
            }}
          >
            See How It Works
          </button>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap justify-center gap-6 sm:gap-8 mb-4">
          {[
            { value: "10,000+", label: "Students" },
            { value: "4.9★", label: "Rating" },
            { value: "2.4h", label: "Avg Daily" },
            { value: "94%", label: "Hit Goals" },
          ].map(({ value, label }) => (
            <div key={label} className="flex flex-col items-center">
              <span
                className="font-bold text-xl"
                style={{ fontFamily: "'JetBrains Mono', monospace", color: "#d2bbff" }}
              >
                {value}
              </span>
              <span
                className="text-xs uppercase tracking-widest mt-0.5"
                style={{ fontFamily: "'Inter', sans-serif", color: "#666680" }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* App mockup */}
        <AppMockup />
      </div>
    </section>
  );
}

// ── Features ──────────────────────────────────────────────────────────────────

const features = [
  {
    icon: "timer",
    title: "Pomodoro Focus Timer",
    desc: "Deep work sessions with the proven Pomodoro technique. Built-in break reminders keep you sharp.",
    color: "#d2bbff",
    bg: "rgba(210,187,255,0.1)",
  },
  {
    icon: "grid_on",
    title: "90-Day Heatmap",
    desc: "GitHub-style activity heatmap shows your consistency at a glance. Never break the streak.",
    color: "#40efb7",
    bg: "rgba(64,239,183,0.1)",
  },
  {
    icon: "track_changes",
    title: "Goal Tracking",
    desc: "Set daily, weekly, and monthly targets. SVG progress rings show exactly where you stand.",
    color: "#ffb95f",
    bg: "rgba(255,185,95,0.1)",
  },
  {
    icon: "insights",
    title: "Smart Analytics",
    desc: "Deep-dive reports on your study patterns. Know which subjects need more attention.",
    color: "#d2bbff",
    bg: "rgba(210,187,255,0.1)",
  },
  {
    icon: "subject",
    title: "Subject Management",
    desc: "Organize your coursework by subject. Track hours logged and focus scores per topic.",
    color: "#40efb7",
    bg: "rgba(64,239,183,0.1)",
  },
  {
    icon: "history_edu",
    title: "Session Logging",
    desc: "Every study session recorded and filterable. Full audit trail of your academic journey.",
    color: "#ffb95f",
    bg: "rgba(255,185,95,0.1)",
  },
];

function Features() {
  return (
    <section id="features" className="py-20 sm:py-32 px-4 sm:px-6" style={{ background: "#131316" }}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2
            className="font-bold mb-4"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "clamp(32px, 4vw, 48px)",
              color: "#e5e1e6",
            }}
          >
            Everything you need to excel
          </h2>
          <p
            className="max-w-xl mx-auto"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "18px",
              color: "#ccc3d8",
            }}
          >
            Built for serious students who treat learning as a performance sport.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ icon, title, desc, color, bg }) => (
            <div
              key={title}
              className="p-6 rounded-xl transition-all duration-300 group"
              style={{
                background: "#12121a",
                border: "1px solid #252535",
                cursor: "default",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(210,187,255,0.3)";
                (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "#252535";
                (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{ background: bg }}
              >
                <span
                  style={{
                    fontFamily: "'Material Symbols Outlined'",
                    color,
                    fontSize: "24px",
                  }}
                >
                  {icon}
                </span>
              </div>
              <h3
                className="font-bold text-lg mb-2"
                style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#e5e1e6" }}
              >
                {title}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ fontFamily: "'Inter', sans-serif", color: "#888899" }}
              >
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── How It Works ──────────────────────────────────────────────────────────────

const steps = [
  {
    num: "01",
    icon: "add_circle",
    title: "Create Your Subjects",
    desc: "Add your courses and subjects. Assign colors and categories to organize your academic world.",
  },
  {
    num: "02",
    icon: "play_circle",
    title: "Start a Focus Session",
    desc: "Hit start on the Pomodoro timer. StudyPulse tracks your focus, logs your time, and scores your productivity.",
  },
  {
    num: "03",
    icon: "trending_up",
    title: "Watch Your Growth",
    desc: "Visualize 90 days of progress. Hit your goals. Watch your streak grow. Become unstoppable.",
  },
];

function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="py-20 sm:py-32 px-4 sm:px-6"
      style={{
        background: "#0e0e11",
        borderTop: "1px solid #252535",
        borderBottom: "1px solid #252535",
      }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2
            className="font-bold mb-4"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "clamp(32px, 4vw, 48px)",
              color: "#e5e1e6",
            }}
          >
            From zero to academic elite in 3 steps
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map(({ num, icon, title, desc }) => (
            <div
              key={num}
              className="p-8 rounded-2xl relative overflow-hidden"
              style={{ background: "#12121a", border: "1px solid #252535" }}
            >
              {/* Corner shimmer */}
              <div
                className="absolute top-0 left-0 w-32 h-32 pointer-events-none"
                style={{
                  background: "radial-gradient(circle at 0% 0%, rgba(124,58,237,0.12), transparent 70%)",
                }}
              />

              {/* Step number */}
              <div
                className="font-bold leading-none mb-4 select-none"
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: "80px",
                  color: "rgba(210,187,255,0.12)",
                  lineHeight: 1,
                }}
              >
                {num}
              </div>

              {/* Icon */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{ background: "rgba(124,58,237,0.15)" }}
              >
                <span
                  style={{
                    fontFamily: "'Material Symbols Outlined'",
                    color: "#d2bbff",
                    fontSize: "24px",
                  }}
                >
                  {icon}
                </span>
              </div>

              <h3
                className="font-bold text-xl mb-3"
                style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#e5e1e6" }}
              >
                {title}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ fontFamily: "'Inter', sans-serif", color: "#888899" }}
              >
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Stats / Social Proof ──────────────────────────────────────────────────────

const bigStats = [
  { value: "10,247", label: "Active Students" },
  { value: "98,431", label: "Sessions Logged" },
  { value: "12,847", label: "Goals Achieved" },
  { value: "94%", label: "Report Better Grades" },
];

function StatsSection() {
  return (
    <section
      id="stats"
      className="py-16 sm:py-24 px-4 sm:px-6"
      style={{
        background: "#131316",
        borderTop: "1px solid rgba(124,58,237,0.3)",
      }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {bigStats.map(({ value, label }) => (
            <div key={label} className="flex flex-col items-center">
              <span
                className="font-bold"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "clamp(32px, 4vw, 48px)",
                  color: "#d2bbff",
                }}
              >
                {value}
              </span>
              <span
                className="text-xs uppercase tracking-widest mt-1"
                style={{ fontFamily: "'Inter', sans-serif", color: "#ccc3d8" }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Testimonials ──────────────────────────────────────────────────────────────

const testimonials = [
  {
    quote:
      "StudyPulse completely changed how I study. I went from random cramming sessions to structured, data-driven learning. My GPA went from 3.1 to 3.8 in one semester.",
    name: "Sarah K.",
    role: "Computer Science @ MIT",
    initials: "SK",
    avatarBg: "rgba(124,58,237,0.3)",
    avatarColor: "#d2bbff",
  },
  {
    quote:
      "The heatmap feature is addictive. I haven't broken my streak in 47 days. It's like GitHub for studying.",
    name: "Marcus T.",
    role: "Pre-Med @ Johns Hopkins",
    initials: "MT",
    avatarBg: "rgba(64,239,183,0.2)",
    avatarColor: "#40efb7",
  },
  {
    quote:
      "I used to guess how much I was studying. Now I KNOW. The analytics dashboard is incredibly eye-opening.",
    name: "Priya M.",
    role: "Law School @ Harvard",
    initials: "PM",
    avatarBg: "rgba(255,185,95,0.2)",
    avatarColor: "#ffb95f",
  },
];

function Testimonials() {
  return (
    <section
      className="py-20 sm:py-32 px-4 sm:px-6"
      style={{ background: "#0e0e11", borderTop: "1px solid #252535" }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2
            className="font-bold mb-4"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "clamp(32px, 4vw, 48px)",
              color: "#e5e1e6",
            }}
          >
            What students say
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map(({ quote, name, role, initials, avatarBg, avatarColor }) => (
            <div
              key={name}
              className="p-6 rounded-xl flex flex-col gap-4 transition-all duration-300"
              style={{ background: "#12121a", border: "1px solid #252535" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(210,187,255,0.2)";
                (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "#252535";
                (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
              }}
            >
              {/* Stars */}
              <div className="flex gap-0.5" style={{ color: "#ffb95f", fontSize: "16px" }}>
                {"★★★★★".split("").map((star, i) => (
                  <span key={i}>{star}</span>
                ))}
              </div>

              {/* Quote */}
              <p
                className="text-sm leading-relaxed flex-1"
                style={{ fontFamily: "'Inter', sans-serif", color: "#ccc3d8" }}
              >
                &ldquo;{quote}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3 pt-2" style={{ borderTop: "1px solid #252535" }}>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{
                    background: avatarBg,
                    color: avatarColor,
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  {initials}
                </div>
                <div>
                  <div
                    className="font-bold text-sm"
                    style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#e5e1e6" }}
                  >
                    {name}
                  </div>
                  <div
                    className="text-xs"
                    style={{ fontFamily: "'Inter', sans-serif", color: "#666680" }}
                  >
                    {role}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Final CTA ─────────────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section
      className="py-20 sm:py-32 px-4 sm:px-6 text-center relative overflow-hidden"
      style={{ background: "#131316" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 80% at 50% 50%, rgba(124,58,237,0.15), transparent)",
        }}
      />
      <div className="relative z-10 max-w-3xl mx-auto">
        <h2
          className="font-bold mb-4"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: "clamp(32px, 4vw, 52px)",
            color: "#e5e1e6",
          }}
        >
          Ready to become an academic elite?
        </h2>
        <p
          className="mb-10 text-lg"
          style={{ fontFamily: "'Inter', sans-serif", color: "#ccc3d8" }}
        >
          Join 10,000+ students already tracking their way to success. Free forever.
        </p>

        <Link
          href="/login"
          className="inline-block w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-5 rounded-full font-bold text-lg sm:text-xl transition-all"
          style={{
            background: "#7c3aed",
            color: "#fff",
            fontFamily: "'Inter', sans-serif",
            boxShadow: "0 0 60px rgba(124,58,237,0.4)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "#6d28d9";
            (e.currentTarget as HTMLElement).style.boxShadow = "0 0 80px rgba(124,58,237,0.6)";
            (e.currentTarget as HTMLElement).style.transform = "scale(1.03)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "#7c3aed";
            (e.currentTarget as HTMLElement).style.boxShadow = "0 0 60px rgba(124,58,237,0.4)";
            (e.currentTarget as HTMLElement).style.transform = "scale(1)";
          }}
        >
          Start for Free — No Credit Card
        </Link>

        <div
          className="flex flex-wrap justify-center gap-6 mt-6 text-sm"
          style={{ fontFamily: "'Inter', sans-serif", color: "#666680" }}
        >
          <span>✓ Free forever</span>
          <span>✓ No credit card</span>
          <span>✓ Start in 60 seconds</span>
        </div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer
      className="px-4 sm:px-6 py-12"
      style={{ background: "#0e0e11", borderTop: "1px solid #252535" }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-8">
          {/* Logo + tagline */}
          <div>
            <div
              className="text-xl font-bold mb-1"
              style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#d2bbff" }}
            >
              StudyPulse
            </div>
            <div
              className="text-sm"
              style={{ fontFamily: "'Inter', sans-serif", color: "#555570" }}
            >
              Your Academic Edge
            </div>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-6">
            {[
              { label: "Features", action: () => scrollTo("features") },
              { label: "Dashboard", href: "/dashboard" },
              { label: "Sign In", href: "/login" },
              { label: "Privacy", href: "#" },
              { label: "Terms", href: "#" },
            ].map(({ label, href, action }) =>
              href ? (
                <Link
                  key={label}
                  href={href}
                  className="text-sm transition-colors"
                  style={{ color: "#555570", fontFamily: "'Inter', sans-serif" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#d2bbff")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#555570")}
                >
                  {label}
                </Link>
              ) : (
                <button
                  key={label}
                  onClick={action}
                  className="text-sm transition-colors"
                  style={{ color: "#555570", fontFamily: "'Inter', sans-serif" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#d2bbff")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#555570")}
                >
                  {label}
                </button>
              )
            )}
          </div>

          {/* Right text */}
          <div
            className="text-sm"
            style={{ fontFamily: "'Inter', sans-serif", color: "#555570" }}
          >
            Built with ❤️ for students everywhere
          </div>
        </div>

        <div
          className="pt-8 text-center text-sm"
          style={{
            borderTop: "1px solid #1a1a2a",
            fontFamily: "'Inter', sans-serif",
            color: "#444455",
          }}
        >
          © {new Date().getFullYear()} StudyPulse. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div style={{ background: "#131316", minHeight: "100vh" }}>
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <StatsSection />
      <Testimonials />
      <FinalCTA />
      <Footer />
    </div>
  );
}
