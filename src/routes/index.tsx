import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, ArrowLeft, Award, BarChart3, Bell, Check, ChevronRight, CircleHelp,
  Clock3, Dumbbell, Flame, Heart, History, Home, LockKeyhole, Mail, Menu, Pause,
  Play, Plus, RotateCcw, Settings, ShieldCheck, Sparkles, Trophy, UserRound,
  Volume2, VolumeX, Weight, X, Camera, CameraOff, Eye, EyeOff, LogOut, Crown, MessageCircle, TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import repclashLogo from "@/assets/repclash-logo.jpg.asset.json";

type Exercise = { name: string; muscles: string; best: string; difficulty: string; glyph: string; };
type Workout = { id: string; exercise: string; reps: number; duration_seconds: number; calories: number; form_score: number; xp_earned: number; created_at: string; mode?: string };
type Profile = { full_name: string; xp: number; streak: number; goal?: string | null; fitness_level?: string };
const exercises: Exercise[] = [
  { name: "Squats", muscles: "Legs · Glutes", best: "47 reps", difficulty: "Beginner", glyph: "SQ" },
  { name: "Plank", muscles: "Core · Shoulders", best: "2:48", difficulty: "Beginner", glyph: "PL" },
  { name: "Push-ups", muscles: "Chest · Triceps", best: "38 reps", difficulty: "Intermediate", glyph: "PU" },
  { name: "Pull-ups", muscles: "Back · Arms", best: "14 reps", difficulty: "Advanced", glyph: "PU" },
  { name: "Crunches", muscles: "Core · Abs", best: "52 reps", difficulty: "Beginner", glyph: "CR" },
  { name: "Lunges", muscles: "Legs · Glutes", best: "32 reps", difficulty: "Beginner", glyph: "LU" },
  { name: "Jumping Jacks", muscles: "Full body", best: "86 reps", difficulty: "Beginner", glyph: "JJ" },
  { name: "Mountain Climbers", muscles: "Core · Cardio", best: "42 reps", difficulty: "Intermediate", glyph: "MC" },
  { name: "Sit-ups", muscles: "Core · Abs", best: "48 reps", difficulty: "Beginner", glyph: "SU" },
  { name: "High Knees", muscles: "Cardio · Legs", best: "72 reps", difficulty: "Intermediate", glyph: "HK" },
];
const trackedExercises = [
  { name: "Squats", glyph: "SQ", tone: "coral" },
  { name: "Push-ups", glyph: "PU", tone: "lime" },
  { name: "Sit-ups", glyph: "SU", tone: "amber" },
] as const;
function exerciseRecord(workouts: Workout[], name: string) {
  const sessions = workouts.filter((w) => w.exercise === name && w.reps > 0);
  return { total: sessions.reduce((sum, w) => sum + w.reps, 0), best: Math.max(0, ...sessions.map((w) => w.reps)), sessions: sessions.length };
}
const tabs = [
  { id: "Home", icon: Home }, { id: "Workout", icon: Dumbbell }, { id: "Progress", icon: BarChart3 }, { id: "Awards", icon: Trophy }, { id: "Settings", icon: Settings },
] as const;
type Tab = (typeof tabs)[number]["id"];

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "REPCLASH — Your camera. Your workout. Your progress." },
    { name: "description", content: "Train with REPCLASH: camera-guided workouts, personal progress, and a little friendly competition." },
    { property: "og:title", content: "REPCLASH — Your camera. Your workout. Your progress." },
    { property: "og:description", content: "Camera-guided workouts, personal progress, and a little friendly competition." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: RepclashApp,
});

function RepclashApp() {
  const [tab, setTab] = useState<Tab>("Home");
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<Profile>({ full_name: "Maya", xp: 742, streak: 7, fitness_level: "Athlete" });
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [exercise, setExercise] = useState("Squats");
  const [workoutOpen, setWorkoutOpen] = useState(false);
  const [authView, setAuthView] = useState<"welcome" | "login" | "signup" | "onboarding" | null>("welcome");
  const [isDemo, setIsDemo] = useState(true);
  const [challenge, setChallenge] = useState(32);
  const [selectedGoal, setSelectedGoal] = useState("Build Muscle");
  const [authBusy, setAuthBusy] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showCameraExplain, setShowCameraExplain] = useState(false);
  const [liveCamera, setLiveCamera] = useState(false);
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [reps, setReps] = useState(0);
  const [muted, setMuted] = useState(false);
  const [done, setDone] = useState<Workout | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [settings, setSettings] = useState({ voice: true, reminders: true, streak: true, privacy: true });
  const cameraRef = useRef<HTMLVideoElement>(null);
  const mediaRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active || !data.session?.user) return;
      const current = data.session.user;
      setUser(current.email ? { id: current.id, email: current.email } : { id: current.id }); setIsDemo(false); setAuthView(null);
      const { data: p } = await supabase.from("fitness_profiles").select("full_name,xp,streak,goal,fitness_level").eq("user_id", current.id).maybeSingle();
      if (!active) return;
      if (p) setProfile(p as Profile);
      else {
        const display = current.user_metadata?.["full_name"] || current.email?.split("@")[0] || "Athlete";
        const fresh = { full_name: display, xp: 0, streak: 0, fitness_level: "Beginner" };
        setProfile(fresh);
        await supabase.from("fitness_profiles").upsert({ user_id: current.id, ...fresh });
      }
      const history: Workout[] = [];
      for (let offset = 0; active; offset += 500) {
        const { data: page, error } = await supabase.from("fitness_workouts").select("id,exercise,reps,duration_seconds,calories,form_score,xp_earned,created_at,mode").eq("user_id", current.id).order("created_at", { ascending: false }).range(offset, offset + 499);
        if (error || !page) break;
        history.push(...page as Workout[]);
        if (page.length < 500) break;
      }
      if (active) setWorkouts(history);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") { setUser(null); setIsDemo(true); setAuthView("welcome"); }
      if (session?.user) { setUser(session.user.email ? { id: session.user.id, email: session.user.email } : { id: session.user.id }); setIsDemo(false); setAuthView(null); }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!workoutOpen || paused) return;
    const timer = window.setInterval(() => {
      setElapsed((time) => time + 1);
      if (mode === "demo" && Math.random() > 0.79 && exercise !== "Plank") setReps((n) => n + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [workoutOpen, paused, mode, exercise]);
  useEffect(() => () => { mediaRef.current?.getTracks().forEach((track) => track.stop()); }, []);
  useEffect(() => { if (cameraRef.current && mediaRef.current) cameraRef.current.srcObject = mediaRef.current; }, [liveCamera, workoutOpen]);

  const title = useMemo(() => {
    switch (tab) { case "Home": return "Home"; case "Workout": return "Workout"; case "Progress": return "Progress"; case "Awards": return "Achievements"; default: return "Settings"; }
  }, [tab]);
  const startWorkout = (name: string) => { setExercise(name); setReps(0); setElapsed(0); setPaused(false); setMode("demo"); setWorkoutOpen(true); setDone(null); };
  const openCameraInfo = (name: string) => { setExercise(name); setShowCameraExplain(true); };
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      mediaRef.current = stream; setLiveCamera(true); setMode("live"); setShowCameraExplain(false); setWorkoutOpen(true); setReps(0); setElapsed(0); setPaused(false);
    } catch { toast.error("Camera access wasn’t available", { description: "You can still train in Demo mode without camera access." }); }
  };
  const finishWorkout = async () => {
    const result: Workout = { id: crypto.randomUUID(), exercise, reps: exercise === "Plank" ? 0 : reps, duration_seconds: elapsed, calories: Math.max(12, Math.round(elapsed * 0.19)), form_score: mode === "demo" ? 92 : 0, xp_earned: Math.max(30, Math.round(elapsed * 0.55) + reps * 2), created_at: new Date().toISOString(), mode };
    setWorkoutOpen(false); setConfirmEnd(false); setDone(result); setLiveCamera(false); mediaRef.current?.getTracks().forEach((track) => track.stop()); mediaRef.current = null;
    setProfile((p) => ({ ...p, xp: p.xp + result.xp_earned, streak: Math.max(p.streak, 8) }));
    setWorkouts((items) => [result, ...items]); setChallenge((n) => Math.min(50, n + result.reps));
    if (user) {
      const { error } = await supabase.from("fitness_workouts").insert({ user_id: user.id, exercise: result.exercise, reps: result.reps, duration_seconds: result.duration_seconds, calories: result.calories, form_score: result.form_score, xp_earned: result.xp_earned, mode: result.mode ?? mode });
      if (error) toast.error("Workout saved on this device", { description: "Cloud sync will be available when the connection returns." });
      await supabase.from("fitness_profiles").update({ xp: profile.xp + result.xp_earned, streak: Math.max(profile.streak, 8) }).eq("user_id", user.id);
    } else {
      try { localStorage.setItem("repverse-demo-workouts", JSON.stringify([result, ...JSON.parse(localStorage.getItem("repverse-demo-workouts") || "[]")])); } catch { /* demo remains usable when storage is full */ }
    }
  };
  useEffect(() => { try { const cached = JSON.parse(localStorage.getItem("repverse-demo-workouts") || "[]") as Workout[]; if (cached.length && isDemo) setWorkouts(cached); } catch { /* ignore invalid demo cache */ } }, [isDemo]);
  const signIn = async (create: boolean) => {
    if (!authEmail || !authPassword) { toast.error("Add your email and password to continue."); return; }
    setAuthBusy(true);
    const result = create ? await supabase.auth.signUp({ email: authEmail, password: authPassword, options: { data: { full_name: fullName } } }) : await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    setAuthBusy(false);
    if (result.error) { toast.error(result.error.message); return; }
    if (create && !result.data.session) { toast.success("Check your inbox to confirm your email."); setAuthView("login"); return; }
    if (create) setAuthView("onboarding"); else { setAuthView(null); setIsDemo(false); }
  };
  const googleLogin = async (provider: "google" | "apple") => { const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin }); if (result.error) toast.error(result.error.message); };
  const saveOnboarding = async () => {
    if (!user) { setAuthView(null); return; }
    const { error } = await supabase.from("fitness_profiles").upsert({ user_id: user.id, full_name: fullName || profile.full_name, goal: selectedGoal, xp: 0, streak: 0 });
    if (error) toast.error("Your profile couldn’t be saved yet."); else { setProfile((p) => ({ ...p, full_name: fullName || p.full_name, goal: selectedGoal })); setAuthView(null); }
  };
  const signOut = async () => { await supabase.auth.signOut(); setTab("Home"); };
  const displayName = profile.full_name || "Athlete";

  return <main className="app-shell">
    <ToasterSlot />
    {authView ? <AuthScreen view={authView} setView={setAuthView} onDemo={() => { setAuthView(null); setIsDemo(true); toast.success("Demo mode ready", { description: "Your workouts are saved on this device." }); }} email={authEmail} setEmail={setAuthEmail} password={authPassword} setPassword={setAuthPassword} name={fullName} setName={setFullName} showPassword={showPassword} setShowPassword={setShowPassword} busy={authBusy} onSubmit={signIn} onSocial={googleLogin} goal={selectedGoal} setGoal={setSelectedGoal} onOnboarding={saveOnboarding} /> : <>
      {!workoutOpen && !done && <>
        <header className="topbar">
          <div className="brand-lockup"><span className="brand-mark">R</span><div><p className="brand-name">REPCLASH</p><p className="brand-sub">TRAINING CONSOLE</p></div></div>
          <div className="top-actions"><span className="level-chip"><Sparkles size={13} />12</span><Button aria-label="Open profile" variant="ghost" size="icon" className="avatar-button" onClick={() => setTab("Settings")}>{displayName.slice(0, 1).toUpperCase()}</Button></div>
        </header>
        <div className="page-content" key={tab}>
          {tab === "Home" && <HomeScreen name={displayName} profile={profile} exercises={exercises} challenge={challenge} onStart={startWorkout} onTab={setTab} workouts={workouts} />}
          {tab === "Workout" && <WorkoutLibrary workouts={workouts} onStart={startWorkout} onHistory={() => setTab("Progress")} />}
          {tab === "Progress" && <ProgressScreen workouts={workouts} profile={profile} onStart={startWorkout} />}
          {tab === "Awards" && <AwardsScreen workouts={workouts} />}
          {tab === "Settings" && <SettingsScreen profile={profile} user={user} isDemo={isDemo} settings={settings} setSettings={setSettings} onLogin={() => setAuthView("welcome")} onSignOut={signOut} onWorkouts={() => setTab("Progress")} />}
          <div className="page-title-accessible">{title}</div>
        </div>
        <BottomNav active={tab} onChange={setTab} />
      </>}
      {workoutOpen && <WorkoutSession exercise={exercise} reps={reps} elapsed={elapsed} mode={mode} liveCamera={liveCamera} paused={paused} muted={muted} videoRef={cameraRef} onPause={() => setPaused((p) => !p)} onRep={() => exercise !== "Plank" && setReps((n) => n + 1)} onEnd={() => setConfirmEnd(true)} onMute={() => setMuted((m) => !m)} onMode={() => { setMode("demo"); setLiveCamera(false); mediaRef.current?.getTracks().forEach((track) => track.stop()); mediaRef.current = null; toast.message("Demo mode enabled", { description: "Reps are simulated; form analysis is not active." }); }} />}
      {done && <WorkoutResult result={done} onSave={() => { setDone(null); setTab("Home"); toast.success("Workout saved"); }} onAgain={() => startWorkout(done.exercise)} onClose={() => { setDone(null); setTab("Home"); }} />}
      {showCameraExplain && <Sheet onClose={() => setShowCameraExplain(false)}><div className="sheet-handle"/><div className="permission-icon"><Camera size={23}/></div><h2>Camera stays with you.</h2><p className="sheet-copy">REPCLASH uses your camera preview for movement monitoring. Your video is not uploaded. Live pose analysis is not enabled in this demo; choose Demo mode for simulated reps.</p><div className="privacy-note"><ShieldCheck size={17}/><span>Camera footage stays on this device and is never saved.</span></div><Button className="primary-action" onClick={startCamera}><Camera size={17}/> Allow camera & start</Button><Button variant="outline" className="secondary-action" onClick={() => { setShowCameraExplain(false); startWorkout(exercise); }}>Continue in Demo mode</Button></Sheet>}
      {confirmEnd && <ConfirmDialog onCancel={() => setConfirmEnd(false)} onConfirm={finishWorkout} />}
    </>}
  </main>;
}

function ToasterSlot() { return <div className="sr-only" aria-live="polite" />; }

function AuthScreen(props: { view: "welcome" | "login" | "signup" | "onboarding" | null; setView: (v: "welcome" | "login" | "signup" | "onboarding" | null) => void; onDemo: () => void; email: string; setEmail: (v: string) => void; password: string; setPassword: (v: string) => void; name: string; setName: (v: string) => void; showPassword: boolean; setShowPassword: (v: boolean) => void; busy: boolean; onSubmit: (create: boolean) => void; onSocial: (provider: "google" | "apple") => void; goal: string; setGoal: (v: string) => void; onOnboarding: () => void }) {
  const { view, setView } = props;
  if (view === "onboarding") return <section className="auth-screen"><div className="auth-logo"><span className="brand-mark large">R</span><span>REPCLASH</span></div><div className="auth-content"><span className="eyebrow">YOUR FIRST SESSION</span><h1>What are you<br/>training for?</h1><p>We’ll tune your plan to your goal.</p><div className="goal-grid">{["Build Muscle","Lose Weight","Improve Strength","Improve Endurance","Stay Active","General Fitness"].map((g) => <button key={g} className={`goal-choice ${props.goal === g ? "selected" : ""}`} onClick={() => props.setGoal(g)}>{g}{props.goal === g && <Check size={16}/>}</button>)}</div><div className="auth-input-label">TRAINING DAYS <select className="auth-input" defaultValue="3"><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option></select></div><Button className="primary-action" onClick={props.onOnboarding}>Start Training <ChevronRight size={18}/></Button></div></section>;
  if (view === "login" || view === "signup") return <section className="auth-screen"><button className="back-action" onClick={() => setView("welcome")}><ArrowLeft size={18}/> Back</button><div className="auth-logo"><span className="brand-mark large">R</span><span>REPCLASH</span></div><div className="auth-content"><span className="eyebrow">{view === "login" ? "WELCOME BACK" : "START YOUR JOURNEY"}</span><h1>{view === "login" ? "Good to see you." : "Create your account."}</h1><p>Progress built one rep at a time.</p>{view === "signup" && <label className="auth-input-label">FULL NAME<input className="auth-input" autoComplete="name" value={props.name} onChange={(e) => props.setName(e.target.value)} placeholder="Your name" /></label>}<label className="auth-input-label">EMAIL ADDRESS<input className="auth-input" type="email" autoComplete="email" value={props.email} onChange={(e) => props.setEmail(e.target.value)} placeholder="you@example.com" /></label><label className="auth-input-label">PASSWORD<div className="password-field"><input className="auth-input" type={props.showPassword ? "text" : "password"} autoComplete={view === "login" ? "current-password" : "new-password"} value={props.password} onChange={(e) => props.setPassword(e.target.value)} placeholder="At least 8 characters"/><button aria-label="Show or hide password" onClick={() => props.setShowPassword(!props.showPassword)}>{props.showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>{view === "signup" && <label className="auth-input-label">CONFIRM PASSWORD<input className="auth-input" type="password" autoComplete="new-password" placeholder="Enter password again" /></label>}{view === "login" && <button className="forgot-link" onClick={() => { void supabase.auth.resetPasswordForEmail(props.email).then(({ error }) => error ? toast.error(error.message) : toast.success("Password reset instructions sent.")); }}>Forgot password?</button>}<Button className="primary-action" disabled={props.busy} onClick={() => props.onSubmit(view === "signup")}>{props.busy ? "Please wait…" : view === "login" ? "Log in" : "Create account"}<ChevronRight size={18}/></Button>{view === "signup" && <p className="auth-small">By creating an account, you agree to our Terms and Privacy Policy.</p>}</div></section>;
  return <section className="auth-screen welcome-screen"><div className="welcome-head"><div className="auth-logo"><span className="brand-mark large">R</span><span>REPCLASH</span></div><button className="skip-action" onClick={props.onDemo}>Skip <ChevronRight size={15}/></button></div><div className="welcome-art"><img className="welcome-logo-image" src={repclashLogo.url} alt="REPCLASH logo: two athletes facing off around a lightning bolt" /></div><div className="welcome-copy"><span className="eyebrow">TRAIN SMARTER · MOVE BETTER</span><h1>Your camera.<br/>Your workout.<br/><em>Your progress.</em></h1><p>Build your strength, one rep at a time.</p><div className="motivation-prompt"><span>HEY, FEELING LOW?</span><strong>Lost today? Let’s understand why—and come back stronger.</strong></div></div><div className="welcome-actions"><Button className="primary-action" onClick={() => setView("signup")}>Create account <ChevronRight size={18}/></Button><Button variant="outline" className="secondary-action" onClick={() => setView("login")}>Log in with email</Button><div className="social-row"><Button variant="outline" className="social-action" onClick={() => props.onSocial("google")}>G <span>Google</span></Button><Button variant="outline" className="social-action" onClick={() => props.onSocial("apple")}>● <span>Apple</span></Button></div><button className="demo-link" onClick={props.onDemo}>Explore in demo mode</button><div className="privacy-foot"><LockKeyhole size={12}/> Your camera. Your privacy. Your progress.</div></div></section>;
}

function HomeScreen({ name, profile, exercises: list, challenge, onStart, onTab, workouts }: { name: string; profile: Profile; exercises: Exercise[]; challenge: number; onStart: (n: string) => void; onTab: (t: Tab) => void; workouts: Workout[] }) {
  const bars = [38, 62, 44, 81, 57, 72, 28];
  return <div className="screen-enter"><div className="greeting-row"><div><p className="greeting">Good morning,</p><h1>{name} <span>✦</span></h1></div><button className="notification-button" aria-label="Notifications" onClick={() => toast.message("You’re all caught up.")}><Bell size={19}/><i/></button></div>
    <section className="score-panel"><div className="score-ring"><div className="score-inner"><strong>{profile.xp}</strong><span>XP</span></div></div><div className="score-copy"><span className="eyebrow">TODAY’S SCORE</span><h2>Level 12 <small>· {profile.fitness_level || "Athlete"}</small></h2><div className="level-track-label"><span>LEVEL 13</span><span>{profile.xp % 200} / 200</span></div><div className="track"><i style={{ width: `${Math.max(18, (profile.xp % 200) / 2)}%` }}/></div></div></section>
    <div className="dashboard-grid"><section className="mini-panel streak-panel"><span className="eyebrow">STREAK</span><div className="streak-number"><Flame size={22}/><strong>{profile.streak}</strong></div><span className="mini-caption">days alive</span></section><section className="mini-panel today-panel"><span className="eyebrow">TODAY’S WORKOUT</span><h3>Full Body</h3><p>25 min · 5 moves</p><Button className="mini-start" onClick={() => onStart("Squats")}>Start workout <ChevronRight size={15}/></Button></section></div>
    <section className="content-section challenge-card"><div className="section-heading"><div><span className="eyebrow">DAILY CHALLENGE</span><p className="subline">Build your momentum today</p></div><span className="reward-chip">+200 XP</span></div><ChallengeLine label="Squats" value={challenge} max={50}/><ChallengeLine label="Push-ups" value={18} max={30}/><ChallengeLine label="Plank" value={40} max={60} unit="s"/></section>
    <section className="content-section activity-panel"><div className="section-heading"><span className="eyebrow">WEEKLY ACTIVITY</span><span className="mini-caption">MIN / DAY</span></div><div className="activity-chart">{bars.map((height, i) => <div className="activity-day" key={i}><span className={`activity-bar ${i === 3 ? "today" : ""}`} style={{ height: `${height}%`, animationDelay: `${i * 45}ms` }}/><span>{["M","T","W","T","F","S","S"][i]}</span></div>)}</div></section>
    <ExerciseRecords workouts={workouts} onStart={onStart} onSeeAll={() => onTab("Progress")} compact />
    <div className="dashboard-grid metric-grid"><MetricTile label="TOTAL REPS" value={workouts.reduce((a, w) => a + w.reps, 0).toLocaleString()} note="saved sessions"/><MetricTile label="WORKOUTS" value={`${workouts.length}`} note="sessions saved"/><MetricTile label="CALORIES" value={workouts.reduce((a, w) => a + w.calories, 0).toLocaleString()} note="estimated kcal"/><MetricTile label="PUSH-UPS" value={exerciseRecord(workouts, "Push-ups").total.toLocaleString()} note="saved reps"/></div>
    <section className="content-section quick-section"><div className="section-heading"><span className="eyebrow">QUICK WORKOUT</span><button className="text-link" onClick={() => onTab("Workout")}>See all <ChevronRight size={14}/></button></div><div className="quick-list">{list.slice(0, 5).map((ex, i) => <button key={ex.name} className="quick-item" onClick={() => onStart(ex.name)}><span className={`exercise-glyph tone-${i % 4}`}>{ex.glyph}</span><span className="quick-name">{ex.name}</span><span className="quick-play"><Play size={13} fill="currentColor"/></span></button>)}</div></section>
    <section className="content-section coach-card"><span className="coach-icon"><Sparkles size={18}/></span><div className="coach-copy"><span className="eyebrow">REPCLASH COACH</span><p>You’re building a strong rhythm. Your squat consistency is up <b>18%</b> this week.</p></div><ChevronRight size={17}/></section>
    <section className="plans-section"><div className="plans-heading"><div><span className="eyebrow">UPGRADE YOUR TRAINING</span><h2>More support. More momentum.</h2></div><span className="soon-label">COMING SOON</span></div><div className="plan-list"><article className="plan-card"><div className="plan-top"><div><span className="plan-name">CORE</span><div className="plan-price"><strong>₹59</strong><span>/ month</span></div></div><MessageCircle size={20}/></div><ul><li><Check size={13}/> Faster coach replies</li><li><Check size={13}/> Live support and chat</li><li><Check size={13}/> Enhanced app experience</li><li><Check size={13}/> Faster feature updates</li></ul><Button variant="outline" className="plan-action" onClick={() => toast.message("Core is coming soon", { description: "Payments are not active yet." })}>Notify me <ChevronRight size={15}/></Button></article><article className="plan-card featured"><span className="recommended">MOST POPULAR</span><div className="plan-top"><div><span className="plan-name">PRO</span><div className="plan-price"><strong>₹109</strong><span>/ month</span></div></div><Crown size={21}/></div><ul><li><Check size={13}/> Everything in Core</li><li><Check size={13}/> Ad-free training</li><li><Check size={13}/> Advanced progress insights</li><li><Check size={13}/> Smarter workout recommendations</li><li><Check size={13}/> Priority support and early access</li></ul><Button className="plan-action plan-action-featured" onClick={() => toast.message("Pro is coming soon", { description: "Payments are not active yet." })}>Join waitlist <ChevronRight size={15}/></Button></article></div></section>
  </div>;
}
function ChallengeLine({ label, value, max, unit = "" }: { label: string; value: number; max: number; unit?: string }) { return <div className="challenge-line"><div className="challenge-label"><span>{label}</span><span>{unit ? `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")} / 1:00` : `${value} / ${max}`}</span></div><div className="track"><i style={{ width: `${Math.min(100, (value / max) * 100)}%` }}/></div></div>; }
function MetricTile({ label, value, note }: { label: string; value: string; note: string }) { return <section className="mini-panel metric-tile"><span className="eyebrow">{label}</span><strong>{value}</strong><span className="mini-caption">{note}</span></section>; }

function ExerciseRecords({ workouts, onStart, onSeeAll, compact = false }: { workouts: Workout[]; onStart: (name: string) => void; onSeeAll?: () => void; compact?: boolean }) {
  return <section className={`records-section ${compact ? "records-compact" : ""}`} aria-label="Exercise records">
    <div className="records-heading"><div><span className="eyebrow">YOUR MOVEMENT RECORDS</span><h2>Every rep counts<span>.</span></h2></div>{onSeeAll && <Button variant="ghost" size="sm" className="records-more" onClick={onSeeAll}>View all <ChevronRight size={15}/></Button>}</div>
    <div className="record-list">{trackedExercises.map(({ name, glyph, tone }, index) => {
      const record = exerciseRecord(workouts, name);
      return <article className={`record-card record-${tone}`} key={name} style={{ animationDelay: `${index * 90}ms` }}>
        <div className="record-card-top"><div className="record-emblem" aria-hidden="true"><span>{glyph}</span></div><span className="record-index">0{index + 1} / 03</span></div>
        <h3>{name}</h3><div className="record-numbers"><div><strong>{record.total.toLocaleString()}</strong><span>TOTAL REPS</span></div><div><strong>{record.best.toLocaleString()}</strong><span>BEST SESSION</span></div></div>
        <div className="record-bottom"><span>{record.sessions} {record.sessions === 1 ? "session" : "sessions"} saved</span><Button variant="ghost" size="icon" aria-label={`Start ${name}`} title={`Start ${name}`} className="record-go" onClick={() => onStart(name)}><ChevronRight size={17}/></Button></div>
      </article>;
    })}</div>
  </section>;
}

function WorkoutLibrary({ workouts, onStart, onHistory }: { workouts: Workout[]; onStart: (name: string) => void; onHistory: () => void }) { const [filter, setFilter] = useState("All"); const filters = ["All", "Beginner", "Intermediate", "Advanced"]; return <div className="screen-enter"><div className="page-heading"><span className="eyebrow">MOVE WITH PURPOSE</span><h1>Find your next<br/><em>personal best.</em></h1><p>Pick a movement and get started.</p></div><div className="filter-row">{filters.map((item) => <button key={item} onClick={() => setFilter(item)} className={`filter-pill ${filter === item ? "active" : ""}`}>{item}</button>)}</div><section className="workout-feature"><div className="feature-mark"><Dumbbell size={25}/></div><div><span className="eyebrow">RECOMMENDED</span><h2>Full Body</h2><p>5 exercises · about 25 min</p></div><Button className="feature-start" onClick={() => onStart("Squats")}><Play size={15} fill="currentColor"/> Start</Button></section><div className="section-heading list-heading"><span className="eyebrow">EXERCISE LIBRARY</span><button className="text-link" onClick={onHistory}><History size={15}/> History</button></div><div className="exercise-list">{exercises.filter((ex) => filter === "All" || ex.difficulty === filter).map((ex, i) => <article className="exercise-card" key={ex.name}><span className={`exercise-glyph tone-${i % 4}`}>{ex.glyph}</span><div className="exercise-info"><h3>{ex.name}</h3><p>{ex.muscles}</p><span className="exercise-best">BEST <b>{ex.name === "Plank" ? (workouts.filter(w => w.exercise === ex.name).length ? formatTime(Math.max(...workouts.filter(w => w.exercise === ex.name).map(w => w.duration_seconds))) : "—") : `${exerciseRecord(workouts, ex.name).best} reps`}</b></span></div><div className="exercise-actions"><span className="difficulty-tag">{ex.difficulty}</span><Button className="start-icon" size="icon" aria-label={`Start ${ex.name}`} onClick={() => onStart(ex.name)}><Play size={15} fill="currentColor"/></Button></div></article>)}</div><p className="camera-footer"><ShieldCheck size={14}/> Demo and camera choices are shown before every session.</p></div>; }

function ProgressScreen({ workouts, profile, onStart }: { workouts: Workout[]; profile: Profile; onStart: () => void }) { const values = [26, 52, 40, 69, 48, 82, 60]; const reps = workouts.reduce((sum, item) => sum + item.reps, 2486); return <div className="screen-enter"><div className="page-heading"><span className="eyebrow">YOUR WORK, IN NUMBERS</span><h1>Progress that<br/><em>adds up.</em></h1><p>A clearer view of how far you’ve come.</p></div><div className="period-control"><button className="period-active">This week</button><button onClick={() => toast.message("Monthly summary is being prepared.")}>This month</button><button onClick={() => toast.message("All-time records selected.")}>All time</button></div><div className="dashboard-grid progress-metrics"><MetricTile label="TOTAL REPS" value={reps.toLocaleString()} note="across all movements"/><MetricTile label="WORKOUTS" value={`${10 + workouts.length}`} note="this month"/><MetricTile label="CALORIES" value="4,230" note="this month"/><MetricTile label="STREAK" value={`${profile.streak} days`} note="keep the rhythm"/></div><section className="content-section chart-section"><div className="section-heading"><div><span className="eyebrow">WEEKLY ACTIVITY</span><p className="subline">Workout minutes by day</p></div><span className="chart-total">3h 42m</span></div><div className="tall-chart">{values.map((v, i) => <div className="tall-day" key={i}><span className={`tall-bar ${i === 5 ? "today" : ""}`} style={{ height: `${v}%` }}/><span>{["M","T","W","T","F","S","S"][i]}</span></div>)}</div></section><section className="coach-card coach-wide"><span className="coach-icon"><Sparkles size={18}/></span><div className="coach-copy"><span className="eyebrow">AI COACH · WEEKLY REVIEW</span><p>You completed <b>74 squats</b> this week, 18% more than last week. Try slower, controlled reps to build strength.</p></div></section><div className="section-heading list-heading"><span className="eyebrow">RECENT WORKOUTS</span><span className="mini-caption">{workouts.length} SAVED</span></div>{workouts.length ? <div className="exercise-list">{workouts.slice(0, 8).map((w) => <HistoryItem key={w.id} workout={w}/>)}</div> : <div className="empty-state"><History size={24}/><p>Your next session starts a new record.</p><Button className="mini-start" onClick={onStart}>Start workout</Button></div>}</div>; }
function HistoryItem({ workout }: { workout: Workout }) { return <article className="history-row"><span className="exercise-glyph tone-0">{(exercises.find((ex) => ex.name === workout.exercise)?.glyph) || "EX"}</span><div className="history-main"><h3>{workout.exercise}</h3><p>{new Date(workout.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {formatTime(workout.duration_seconds)}</p></div><div className="history-value"><strong>{workout.reps ? `${workout.reps} reps` : formatTime(workout.duration_seconds)}</strong><span>+{workout.xp_earned} XP</span></div></article>; }

function AwardsScreen({ workouts }: { workouts: Workout[] }) { const count = 10 + workouts.length; const badges = [{ title: "First Workout", category: "BRONZE", desc: "Show up for the first time", icon: "01", progress: Math.min(1, count / 1) }, { title: "100 Reps", category: "BRONZE", desc: "Stack up one hundred reps", icon: "100", progress: Math.min(1, 72 / 100) }, { title: "7 Day Streak", category: "BRONZE", desc: "Keep your momentum alive", icon: "7D", progress: 1 }, { title: "1,000 Reps", category: "SILVER", desc: "A thousand strong", icon: "1K", progress: .68 }, { title: "30 Day Streak", category: "SILVER", desc: "A month of showing up", icon: "30", progress: .24 }, { title: "10,000 Reps", category: "GOLD", desc: "A milestone worth celebrating", icon: "10K", progress: .13 }, { title: "100 Workouts", category: "GOLD", desc: "Consistency at its finest", icon: "100", progress: count / 100 }, { title: "Elite Performer", category: "PLATINUM", desc: "A rare level of commitment", icon: "★", progress: .08 }]; return <div className="screen-enter"><div className="page-heading"><span className="eyebrow">EARNED, NEVER GIVEN</span><h1>Proof of your<br/><em>progress.</em></h1><p>Every milestone starts with showing up.</p></div><section className="medal-progress"><div className="medal-symbol">✦</div><div className="medal-copy"><span className="eyebrow">YOUR TIER</span><h2>Bronze <small>· Rising</small></h2><p>{count} of 30 workouts to Silver</p><div className="track"><i style={{ width: `${Math.min(100, count / 30 * 100)}%` }}/></div></div></section><div className="section-heading list-heading"><span className="eyebrow">MILESTONES</span><span className="mini-caption">{badges.filter((b) => b.progress >= 1).length} UNLOCKED</span></div><div className="badge-list">{badges.map((badge) => <article key={badge.title} className={`badge-card tier-${badge.category.toLowerCase()}`}><div className="badge-icon">{badge.icon}</div><div className="badge-info"><div className="badge-heading"><h3>{badge.title}</h3><span>{badge.category}</span></div><p>{badge.desc}</p><div className="track"><i style={{ width: `${Math.min(100, badge.progress * 100)}%` }}/></div></div>{badge.progress >= 1 && <Check className="badge-check" size={17}/>}</article>)}</div></div>; }

function SettingsScreen({ profile, user, isDemo, settings, setSettings, onLogin, onSignOut, onWorkouts }: { profile: Profile; user: { id: string; email?: string } | null; isDemo: boolean; settings: { voice: boolean; reminders: boolean; streak: boolean; privacy: boolean }; setSettings: (s: { voice: boolean; reminders: boolean; streak: boolean; privacy: boolean }) => void; onLogin: () => void; onSignOut: () => void; onWorkouts: () => void }) { const toggle = (key: keyof typeof settings) => setSettings({ ...settings, [key]: !settings[key] }); return <div className="screen-enter"><div className="page-heading"><span className="eyebrow">YOUR SPACE</span><h1>Settings &<br/><em>your profile.</em></h1><p>Make REPCLASH work your way.</p></div><section className="profile-panel"><div className="profile-avatar">{profile.full_name.slice(0, 1).toUpperCase()}</div><div className="profile-info"><h2>{profile.full_name}</h2><p>{user?.email || "Demo athlete"}</p><span className="profile-level"><Sparkles size={12}/> LEVEL 12 · {profile.fitness_level || "ATHLETE"}</span></div><ChevronRight size={18}/></section><section className="settings-group"><h3>ACCOUNT</h3>{isDemo ? <SettingsRow icon={<UserRound/>} label="Create your account" detail="Sync your progress across devices" action={<ChevronRight size={16}/>} onClick={onLogin}/> : <SettingsRow icon={<Mail/>} label="Email address" detail={user?.email || "Signed in"} action={<Check size={16}/>} onClick={() => toast.message("Your account email is verified.")}/>}<SettingsRow icon={<History/>} label="Workout history" detail="Review every session" action={<ChevronRight size={16}/>} onClick={onWorkouts}/><SettingsRow icon={<LogOut/>} label={isDemo ? "Demo mode" : "Sign out"} detail={isDemo ? "Saved on this device" : "Sign out of REPCLASH"} action={<ChevronRight size={16}/>} onClick={isDemo ? onLogin : onSignOut}/></section><section className="settings-group"><h3>WORKOUT PREFERENCES</h3><SettingsRow icon={<Volume2/>} label="Voice feedback" detail="Live form cues" action={<Switch checked={settings.voice} onCheckedChange={() => toggle("voice")}/>} onClick={() => toggle("voice")}/><SettingsRow icon={<Clock3/>} label="Rest timer" detail="60 seconds between sets" action={<ChevronRight size={16}/>} onClick={() => toast.message("Rest timer set to 60 seconds.")}/><SettingsRow icon={<Activity/>} label="Rep sensitivity" detail="Balanced movement threshold" action={<ChevronRight size={16}/>} onClick={() => toast.message("Rep sensitivity: Balanced.")}/></section><section className="settings-group"><h3>REMINDERS</h3><SettingsRow icon={<Bell/>} label="Daily workout" detail="A gentle nudge to move" action={<Switch checked={settings.reminders} onCheckedChange={() => toggle("reminders")}/>} onClick={() => toggle("reminders")}/><SettingsRow icon={<Flame/>} label="Streak reminder" detail="Keep your momentum alive" action={<Switch checked={settings.streak} onCheckedChange={() => toggle("streak")}/>} onClick={() => toggle("streak")}/></section><section className="settings-group"><h3>PRIVACY & SUPPORT</h3><SettingsRow icon={<ShieldCheck/>} label="Camera privacy" detail="Video stays on your device" action={<ChevronRight size={16}/>} onClick={() => toast.message("Camera video is never uploaded or saved.")}/><SettingsRow icon={<CircleHelp/>} label="Help & support" detail="We’re here to help" action={<ChevronRight size={16}/>} onClick={() => toast.message("Contact support at hello@repverse.app")}/><SettingsRow icon={<LockKeyhole/>} label="Privacy policy" detail="Your data belongs to you" action={<ChevronRight size={16}/>} onClick={() => toast.message("REPCLASH never stores camera footage.")}/></section><p className="version-line">REPCLASH · VERSION 1.0.0 · BUILT TO KEEP YOU MOVING</p></div>; }
function SettingsRow({ icon, label, detail, action, onClick }: { icon: React.ReactNode; label: string; detail: string; action: React.ReactNode; onClick: () => void }) { return <button className="settings-row" onClick={onClick}><span className="settings-icon">{icon}</span><span className="settings-copy"><b>{label}</b><small>{detail}</small></span><span className="settings-action" onClick={(e) => e.stopPropagation()}>{action}</span></button>; }

function BottomNav({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) { return <nav className="bottom-nav" aria-label="Main navigation">{tabs.map(({ id, icon: Icon }) => <button key={id} className={`nav-item ${active === id ? "active" : ""}`} onClick={() => onChange(id)} aria-current={active === id ? "page" : undefined}><span className="nav-icon"><Icon size={19} strokeWidth={active === id ? 2.4 : 1.8}/></span><span>{id === "Awards" ? "Awards" : id}</span></button>)}</nav>; }

function WorkoutSession({ exercise, reps, elapsed, mode, liveCamera, paused, muted, videoRef, onPause, onRep, onEnd, onMute, onMode }: { exercise: string; reps: number; elapsed: number; mode: "demo" | "live"; liveCamera: boolean; paused: boolean; muted: boolean; videoRef: React.RefObject<HTMLVideoElement | null>; onPause: () => void; onRep: () => void; onEnd: () => void; onMute: () => void; onMode: () => void }) { return <section className="workout-session"><header className="session-header"><button className="session-icon" aria-label="End workout" onClick={onEnd}><X size={20}/></button><div><span className="eyebrow">{mode === "demo" ? "DEMO MODE" : "LIVE CAMERA · PREVIEW ONLY"}</span><h1>{exercise.toUpperCase()}</h1></div><button className="session-icon" aria-label="Mute feedback" onClick={onMute}>{muted ? <VolumeX size={19}/> : <Volume2 size={19}/>}</button></header><div className="camera-stage">{liveCamera ? <><video ref={videoRef} autoPlay playsInline muted className="camera-video"/><div className="camera-label"><span className="live-dot"/> CAMERA ON · DEVICE ONLY</div><div className="camera-info"><CameraOff size={15}/> Pose analysis isn’t active in this demo</div></> : <div className="demo-camera-art"><div className="camera-grid"/><div className="figure-head"/><div className="figure-body"/><div className="figure-arm left"/><div className="figure-arm right"/><div className="figure-leg left"/><div className="figure-leg right"/><div className="joint j1"/><div className="joint j2"/><div className="joint j3"/><span className="demo-watermark">REPCLASH · DEMO</span></div>}<div className="camera-top-actions"><button className="camera-tool" title="Switch to simulated demo" onClick={onMode}><RotateCcw size={16}/></button><button className="camera-tool" title="Session options" onClick={() => toast.message("Keep the full movement in frame for best tracking.")}><Menu size={16}/></button></div></div><div className="session-status"><span className="status-pill"><i className={mode === "demo" ? "dot-amber" : "dot-muted"}/>{mode === "demo" ? "DEMO · SIMULATED" : "CAMERA PREVIEW"}</span><span className="session-time"><Clock3 size={15}/>{formatTime(elapsed)}</span></div><div className="session-feedback"><Sparkles size={16}/><span>{mode === "demo" ? "Simulated movement · no form analysis" : "Camera preview active · pose analysis unavailable"}</span></div><div className="rep-display"><span>{exercise === "Plank" ? formatTime(elapsed) : reps}</span><small>{exercise === "Plank" ? "HOLD TIME" : "REPS"}</small></div><div className="session-stats"><div><strong>{mode === "demo" ? "—" : "—"}</strong><span>FORM SCORE</span></div><div><strong>{Math.max(0, Math.round(elapsed * .19))}</strong><span>CALORIES</span></div><div><strong>{reps ? "1.8s" : "—"}</strong><span>TEMPO</span></div></div><div className="session-controls"><Button variant="outline" className="pause-button" onClick={onPause}>{paused ? <Play size={17} fill="currentColor"/> : <Pause size={17} fill="currentColor"/>}{paused ? "Resume" : "Pause"}</Button><Button className="session-finish" onClick={onEnd}>End workout</Button></div>{mode === "demo" && exercise !== "Plank" && <button className="demo-count-button" onClick={onRep}><Plus size={16}/> Tap to add a demo rep</button>}{paused && <div className="paused-overlay"><span>PAUSED</span><Button className="primary-action" onClick={onPause}><Play size={16} fill="currentColor"/> Resume workout</Button></div>}</section>; }

function WorkoutResult({ result, onSave, onAgain, onClose }: { result: Workout; onSave: () => void; onAgain: () => void; onClose: () => void }) { return <section className="result-screen"><button className="result-close" aria-label="Close result" onClick={onClose}><X size={20}/></button><div className="result-burst"><Trophy size={30}/></div><span className="eyebrow">SESSION COMPLETE</span><h1>That’s a wrap.<br/><em>You showed up.</em></h1><p className="result-exercise">{result.exercise.toUpperCase()} · {formatTime(result.duration_seconds)}</p><div className="result-xp"><span>+{result.xp_earned}</span><small>XP EARNED</small></div><div className="result-stats"><div><strong>{result.reps || formatTime(result.duration_seconds)}</strong><span>{result.reps ? "REPS" : "HOLD"}</span></div><div><strong>{result.mode === "demo" ? "—" : "—"}</strong><span>FORM SCORE</span></div><div><strong>{result.calories}</strong><span>KCAL</span></div></div><div className="result-streak"><Flame size={18}/><span>Streak is alive — <b>8 days</b></span></div><p className="result-note">{result.mode === "demo" ? "Demo session · simulated reps, no form analysis" : "Camera preview only · no form analysis was performed"}</p><Button className="primary-action" onClick={onSave}>Save workout <Check size={18}/></Button><div className="result-actions"><Button variant="outline" className="secondary-action" onClick={() => { void navigator.clipboard?.writeText(`REPCLASH · ${result.exercise} · ${result.reps} reps · +${result.xp_earned} XP`).then(() => toast.success("Workout result copied.")); }}>Share result</Button><Button variant="outline" className="secondary-action" onClick={onAgain}>Train again</Button></div></section>; }

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) { return <div className="overlay" onClick={onClose}><section className="bottom-sheet" onClick={(e) => e.stopPropagation()}>{children}</section></div>; }
function ConfirmDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) { return <div className="overlay" onClick={onCancel}><section className="confirm-sheet" onClick={(e) => e.stopPropagation()}><div className="sheet-handle"/><span className="confirm-icon"><Dumbbell size={20}/></span><h2>End this workout?</h2><p>Your session progress will be saved to your history.</p><Button className="primary-action" onClick={onConfirm}>Finish workout</Button><Button variant="outline" className="secondary-action" onClick={onCancel}>Keep training</Button></section></div>; }
function formatTime(seconds: number) { return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }