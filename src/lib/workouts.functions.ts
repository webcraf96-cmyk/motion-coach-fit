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
    const { data: rows, error } = await context.supabase.rpc("record_fitness_workout", {
      _exercise: data.exercise,
      _reps: data.reps,
      _duration_seconds: data.duration_seconds,
      _mode: data.mode,
    });
    if (error || !rows?.[0]) throw new Error("Workout could not be saved securely.");
    return rows[0];
  });