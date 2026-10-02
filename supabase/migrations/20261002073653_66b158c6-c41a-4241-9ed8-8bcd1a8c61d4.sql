ALTER TABLE public.fitness_profiles ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{"voice":true,"reminders":true,"streak":true,"privacy":true}'::jsonb;
GRANT UPDATE (preferences) ON public.fitness_profiles TO authenticated;
