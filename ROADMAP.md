# StudyPulse — Feature Roadmap

Features to implement one at a time. Ordered by priority (highest impact first).

---

## Priority Queue

| # | Feature | Status |
|---|---------|--------|
| 1 | Task Planner / To-Do System | ⬜ Not started |
| 2 | Project Mode | ⬜ Not started |
| 3 | Today's Plan Page | ⬜ Not started |
| 4 | Session Reflection Journal | ⬜ Not started |
| 5 | Weekly Review Dashboard | ⬜ Not started |
| 6 | AI Weekly Summary | ⬜ Not started |
| 7 | Calendar View | ⬜ Not started |
| 8 | Export Reports (PDF / CSV / Excel) | ⬜ Not started |
| 9 | Goal Breakdown (Sub-goals) | ⬜ Not started |
| 10 | Focus Session Types | ⬜ Not started |
| 11 | Deadline Countdown | ⬜ Not started |
| 12 | Streaks and Badges | ⬜ Not started |
| 13 | Smart Break Suggestions | ⬜ Not started |
| 14 | Distraction Tracker | ⬜ Not started |
| 15 | Work-Life Balance Tracker | ⬜ Not started |
| 16 | Focus Score (enhanced) | ⬜ Not started |
| 17 | Accountability Partner | ⬜ Not started |
| 18 | Resume / Portfolio Progress Tracker | ⬜ Not started |
| 19 | Custom Labels | ⬜ Not started |
| 20 | AI Study/Work Coach | ⬜ Not started |

---

## Feature Specs

### 1. Task Planner / To-Do System
Add tasks under each Focus Area. Makes the app a real productivity tracker, not just a timer.

**Each task has:**
- Title
- Due date
- Priority: `low` | `medium` | `high`
- Status: `not started` | `in progress` | `completed`
- Estimated time (minutes)
- Actual time spent (tracked automatically from sessions)

**Example:**
- Focus Area: Thesis Writing
  - ☐ Revise literature review (high, due Friday)
  - ☐ Format references (medium)
  - ☑ Send draft to advisor

**Firestore path:** `users/{uid}/tasks/{taskId}`

---

### 2. Project Mode
Group focus areas, tasks, and sessions under named Projects. Great for professional users managing multiple workstreams.

**Each project has:**
- Name, description, color/icon
- Linked focus areas
- Linked tasks
- Deadline
- Notes
- Progress percentage (auto-calculated from task completion)
- Total hours spent (summed from sessions)

**Example projects:** PhD Thesis · Job Applications · Python Course · Research Paper · Church Finance App · Certification Exam

**Firestore path:** `users/{uid}/projects/{projectId}`

---

### 3. Today's Plan Page
A daily homepage showing what the user needs to do today. Compares planned vs completed at end of day.

**Shows:**
- Top 3 priorities (user-pinned)
- Planned focus sessions for today
- Upcoming deadlines (within 3 days)
- Unfinished tasks rolled over from yesterday
- Suggested schedule based on past productivity patterns

**"Plan vs Actual" comparison** at end of day.

---

### 4. Session Reflection Journal
After every focus session completes, prompt the user for a short reflection. Users can look back and see *what* they achieved, not just *how long* they worked.

**Prompts:**
- What did I work on?
- What did I complete?
- What blocked me?
- What should I do next?

**Stored on:** the Session document (`notes` field already exists — expand to structured reflection)

**Example entry:**
> Today I worked on the methodology section. Finished first draft but need to add citations tomorrow.

---

### 5. Weekly Review Dashboard
A dedicated page showing the past 7 days at a glance.

**Shows:**
- Total hours worked
- Completed vs missed tasks
- Goals achieved vs missed
- Most active focus area
- Least active focus area
- Best day of the week
- Productivity streak
- Reflection summary (pulled from session notes)
- **"Generate Weekly Report"** button → exports or displays formatted summary

---

### 6. AI Weekly Summary
AI-generated plain-English summary of the user's week, personalized to their data.

**Example output:**
> This week you logged 9.5 hours. Most time went into Thesis Writing and Python Practice. Your strongest day was Wednesday. You're most consistent in the evenings. Next week, try increasing writing sessions by 20%.

**Implementation:** Send aggregated session data to Claude API → return narrative summary. Can be a one-click button on the Weekly Review page.

---

### 7. Calendar View
Visual calendar overlaying sessions, tasks, and deadlines.

**Views:**
- Daily — hourly timeline with session blocks
- Weekly — 7-column grid
- Monthly — traditional calendar

**Color-coded by focus area. Click any block to see session details.**

---

### 8. Export Reports
Download progress data in multiple formats.

**Formats:** PDF · CSV · Excel (.xlsx)

**Scopes:** All time · This week · This month · Custom date range

**Useful for:** sharing with advisors, supervisors, accountability partners, coaches.

---

### 9. Goal Breakdown (Sub-goals)
Break large goals into trackable sub-goals. Connect daily sessions to long-term progress.

**Example:**
- Goal: Finish Thesis Chapter 2 (due June 30)
  - ☐ Read 10 papers
  - ☐ Write introduction
  - ☐ Write methods section
  - ☐ Revise figures
  - ☐ Send draft to advisor

Progress bar on goal = % of sub-goals completed.

---

### 10. Focus Session Types
Let users tag what kind of work they're doing. Enables richer analytics.

**Built-in types:** Deep Work · Reading · Writing · Coding · Reviewing · Meeting Prep · Admin · Practice · Research · Job Search

**Analytics unlocked:**
> You spent 45% writing, 30% reading, 25% coding this week.

---

### 11. Deadline Countdown
Show countdown timers on goals and projects.

**Example:**
> Thesis submission: **42 days left**
> Conference abstract: **5 days left**  🔴
> Certification exam: **18 days left**

Color-coded urgency: green (>14 days) → amber (7–14) → red (<7).

---

### 12. Streaks and Badges
Motivational rewards for consistency and milestones.

**Streak badges:** 3-day · 7-day · 30-day  
**Milestone badges:** First 10 hrs · 100 sessions · Weekly goal hit · Deep Work Champion · Thesis Warrior · Coding Streak

---

### 13. Smart Break Suggestions
Context-aware break recommendations based on session length and time of day.

**Break types:** Stretch · Water · Walk · Breathing · Eye rest · Snack · No-screen

**Example prompt:**
> You've completed 90 min of focused work. Take a 10-minute walk or stretch break.

---

### 14. Distraction Tracker
Log distractions during or after a session. Reveals patterns over time.

**Distraction types:** Phone · Social media · Email · Noise · Fatigue · Hunger · Lack of clarity · Other tasks

**Pattern insight:**
> Your most common distraction is phone use during evening sessions.

---

### 15. Work-Life Balance Tracker
Visualize how time is distributed across life categories.

**Categories (user-configurable):** Work · Study · Research · Personal · Health · Spiritual · Skill-building

**Shows:** pie/donut chart of time distribution. Flags when one category dominates and others are neglected.

---

### 16. Focus Score (Enhanced)
A composite score combining multiple signals into one number.

**Inputs:** session completion % · pause count · distractions logged · task completion · consistency · goal completion

**Output:** `Focus Score: 84%` — trackable over time with a trend line.

---

### 17. Accountability Partner
Invite someone to view a limited read-only progress summary.

**They can see:** hours completed · goals achieved · streak · task progress  
**They cannot see:** private notes · reflections

**Implementation:** shareable link with read-only Firestore rules, no auth required for viewer.

---

### 18. Resume / Portfolio Progress Tracker
Career-focused section for users building professionally while studying.

**Tracks:** job applications · skills being learned · certificates completed · portfolio projects · resume milestones · networking tasks

---

### 19. Custom Labels
Let users rename the terminology throughout the app to match their context.

**Examples:** Focus Area · Project · Client · Course · Research Area · Workstream · Skill · Goal Category

---

### 20. AI Study/Work Coach
Premium-feel feature. Analyzes patterns and gives personalized coaching.

**Examples:**
> You are most productive between 8–10 PM. Schedule your hardest work then.

> You often start thesis writing sessions but don't finish the planned duration. Try reducing blocks from 60 min to 35 min.

**Implementation:** Claude API with full session history context.

---

*Last updated: 2026-05-20*
