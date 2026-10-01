import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const workoutInput = z.object({
  exercise: z.enum(["Squats", "Plank", "Push-ups", "Pull-ups", "Crunches", "Lunges", "Jumping Jacks", "Mountain Climbers", "Sit-ups", "High Knees"]),
  reps: z.number().int().min(0).max(500),
  duration_seconds: z.number().int().min(1).max(7200),
  mode: z.enum(["demo", "live"]),
});

type SavedWorkout = {
  id: string;
  user_id: string;
  exercise: string;
  reps: number;
  duration_seconds: number;
  calories: number;
  form_score: number;
  xp_earned: number;
  mode: string;
  created_at: string;
};

type WorkoutDatabase = {
  from(table: "fitness_workouts"): {
    insert(values: { user_id: string; exercise: string; reps: number; duration_seconds: number; mode: "demo" | "live" }): {
      select(columns: string): { single(): Promise<{ data: SavedWorkout | null; error: unknown }> };
    };
  };
  from(table: "fitness_profiles"): {
    select(columns: string): {
      eq(column: "user_id", value: string): { single(): Promise<{ data: { xp: number; streak: number } | null; error: unknown }> };
    };
  };
};

export const recordWorkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => workoutInput.parse(input))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as WorkoutDatabase;
    const { data: workout, error } = await db
      .from("fitness_workouts")
      .insert({ user_id: context.userId, ...data })
      .select("id,user_id,exercise,reps,duration_seconds,calories,form_score,xp_earned,mode,created_at")
      .single();
    if (error || !workout) throw new Error("Workout could not be saved securely.");
    const { data: profile, error: profileError } = await context.supabase
      .from("fitness_profiles")
      .select("xp,streak")
      .eq("user_id", context.userId)
      .single();
    if (profileError || !profile) throw new Error("Workout was saved, but progress could not be refreshed.");
    return { ...workout, profile_xp: profile.xp, profile_streak: profile.streak };
  });