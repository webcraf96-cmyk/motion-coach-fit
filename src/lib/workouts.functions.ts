import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const workoutInput = z.object({
  exercise: z.enum(["Squats", "Plank", "Push-ups", "Pull-ups", "Crunches", "Lunges", "Jumping Jacks", "Mountain Climbers", "Sit-ups", "High Knees"]),
  reps: z.number().int().min(0).max(500),
  duration_seconds: z.number().int().min(1).max(7200),
  mode: z.enum(["demo", "live"]),
});

export const recordWorkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => workoutInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: workout, error } = await context.supabase
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