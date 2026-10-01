DROP FUNCTION IF EXISTS public.record_fitness_workout(uuid, text, integer, integer, text);

CREATE OR REPLACE FUNCTION public.validate_fitness_workout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF NEW.exercise NOT IN ('Squats', 'Plank', 'Push-ups', 'Pull-ups', 'Crunches', 'Lunges', 'Jumping Jacks', 'Mountain Climbers', 'Sit-ups', 'High Knees') THEN
    RAISE EXCEPTION 'Invalid workout details';
  END IF;
  IF NEW.mode NOT IN ('demo', 'live') OR NEW.duration_seconds < 1 OR NEW.duration_seconds > 7200 OR NEW.reps < 0 OR NEW.reps > 500 THEN
    RAISE EXCEPTION 'Invalid workout metrics';
  END IF;
  IF (NEW.exercise = 'Plank' AND NEW.reps <> 0) OR (NEW.exercise <> 'Plank' AND NEW.reps > NEW.duration_seconds * 2) THEN
    RAISE EXCEPTION 'Workout metrics are outside supported limits';
  END IF;
  NEW.calories := greatest(12, round(NEW.duration_seconds * 0.19)::integer);
  NEW.form_score := CASE WHEN NEW.mode = 'demo' THEN 92 ELSE 0 END;
  NEW.xp_earned := greatest(30, round(NEW.duration_seconds * 0.55)::integer + NEW.reps * 2);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_fitness_workout() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.apply_fitness_workout_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_streak integer := 0;
  v_expected date;
  v_day date;
BEGIN
  v_expected := current_date;
  IF NOT EXISTS (SELECT 1 FROM public.fitness_workouts w WHERE w.user_id = NEW.user_id AND w.created_at::date = current_date) THEN
    v_expected := current_date - 1;
  END IF;
  FOR v_day IN
    SELECT DISTINCT w.created_at::date
    FROM public.fitness_workouts w
    WHERE w.user_id = NEW.user_id AND w.created_at::date <= current_date
    ORDER BY w.created_at::date DESC
  LOOP
    IF v_day = v_expected THEN
      v_streak := v_streak + 1;
      v_expected := v_expected - 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;
  UPDATE public.fitness_profiles
  SET xp = xp + NEW.xp_earned, streak = v_streak
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_fitness_workout_progress() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS fitness_workout_validate ON public.fitness_workouts;
CREATE TRIGGER fitness_workout_validate BEFORE INSERT ON public.fitness_workouts FOR EACH ROW EXECUTE FUNCTION public.validate_fitness_workout();
DROP TRIGGER IF EXISTS fitness_workout_progress ON public.fitness_workouts;
CREATE TRIGGER fitness_workout_progress AFTER INSERT ON public.fitness_workouts FOR EACH ROW EXECUTE FUNCTION public.apply_fitness_workout_progress();

DROP POLICY IF EXISTS "Users can insert their own fitness workouts" ON public.fitness_workouts;
CREATE POLICY "Users can insert their own fitness workouts" ON public.fitness_workouts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
GRANT INSERT (user_id, exercise, reps, duration_seconds, mode) ON public.fitness_workouts TO authenticated;
GRANT SELECT ON public.fitness_workouts TO authenticated;