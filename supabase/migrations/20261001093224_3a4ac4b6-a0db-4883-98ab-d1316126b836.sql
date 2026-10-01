-- Restrict direct client writes to workout history and profile scoring fields.
DROP POLICY IF EXISTS "Users manage their own fitness workouts" ON public.fitness_workouts;
CREATE POLICY "Users can view their own fitness workouts" ON public.fitness_workouts FOR SELECT TO authenticated USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.fitness_workouts FROM authenticated;
GRANT SELECT ON public.fitness_workouts TO authenticated;

DROP POLICY IF EXISTS "Users manage their own fitness profile" ON public.fitness_profiles;
CREATE POLICY "Users can view their own fitness profile" ON public.fitness_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own fitness profile" ON public.fitness_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can edit their own fitness profile" ON public.fitness_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.fitness_profiles FROM authenticated;
GRANT SELECT ON public.fitness_profiles TO authenticated;
GRANT INSERT (user_id, full_name, age, height_cm, weight_kg, fitness_level, goal, training_days) ON public.fitness_profiles TO authenticated;
GRANT UPDATE (full_name, age, height_cm, weight_kg, fitness_level, goal, training_days) ON public.fitness_profiles TO authenticated;
ALTER TABLE public.fitness_profiles ALTER COLUMN xp SET DEFAULT 0;
ALTER TABLE public.fitness_profiles ALTER COLUMN streak SET DEFAULT 0;

CREATE OR REPLACE FUNCTION public.record_fitness_workout(
  _user_id uuid,
  _exercise text,
  _reps integer,
  _duration_seconds integer,
  _mode text
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  exercise text,
  reps integer,
  duration_seconds integer,
  calories integer,
  form_score integer,
  xp_earned integer,
  mode text,
  created_at timestamptz,
  profile_xp integer,
  profile_streak integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_calories integer;
  v_form_score integer;
  v_xp integer;
  v_streak integer := 0;
  v_expected date;
  v_day date;
  v_workout public.fitness_workouts%ROWTYPE;
  v_profile_xp integer;
BEGIN
  IF _user_id IS NULL OR _exercise NOT IN ('Squats', 'Plank', 'Push-ups', 'Pull-ups', 'Crunches', 'Lunges', 'Jumping Jacks', 'Mountain Climbers', 'Sit-ups', 'High Knees') THEN
    RAISE EXCEPTION 'Invalid workout details';
  END IF;
  IF _mode NOT IN ('demo', 'live') OR _duration_seconds < 1 OR _duration_seconds > 7200 OR _reps < 0 OR _reps > 500 THEN
    RAISE EXCEPTION 'Invalid workout metrics';
  END IF;
  IF (_exercise = 'Plank' AND _reps <> 0) OR (_exercise <> 'Plank' AND _reps > _duration_seconds * 2) THEN
    RAISE EXCEPTION 'Workout metrics are outside supported limits';
  END IF;

  v_calories := greatest(12, round(_duration_seconds * 0.19)::integer);
  v_form_score := CASE WHEN _mode = 'demo' THEN 92 ELSE 0 END;
  v_xp := greatest(30, round(_duration_seconds * 0.55)::integer + _reps * 2);

  INSERT INTO public.fitness_workouts (user_id, exercise, reps, duration_seconds, calories, form_score, xp_earned, mode)
  VALUES (_user_id, _exercise, _reps, _duration_seconds, v_calories, v_form_score, v_xp, _mode)
  RETURNING * INTO v_workout;

  v_expected := current_date;
  IF NOT EXISTS (SELECT 1 FROM public.fitness_workouts w WHERE w.user_id = _user_id AND w.created_at::date = current_date) THEN
    v_expected := current_date - 1;
  END IF;
  FOR v_day IN
    SELECT DISTINCT w.created_at::date
    FROM public.fitness_workouts w
    WHERE w.user_id = _user_id AND w.created_at::date <= current_date
    ORDER BY w.created_at::date DESC
  LOOP
    IF v_day = v_expected THEN
      v_streak := v_streak + 1;
      v_expected := v_expected - 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  UPDATE public.fitness_profiles p
  SET xp = p.xp + v_xp, streak = v_streak
  WHERE p.user_id = _user_id
  RETURNING p.xp INTO v_profile_xp;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fitness profile not found';
  END IF;

  RETURN QUERY SELECT v_workout.id, v_workout.user_id, v_workout.exercise, v_workout.reps,
    v_workout.duration_seconds, v_workout.calories, v_workout.form_score, v_workout.xp_earned,
    v_workout.mode, v_workout.created_at, v_profile_xp, v_streak;
END;
$$;
REVOKE ALL ON FUNCTION public.record_fitness_workout(uuid, text, integer, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_fitness_workout(uuid, text, integer, integer, text) TO service_role;