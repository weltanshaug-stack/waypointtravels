CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.trips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled trip',
  destination TEXT NOT NULL DEFAULT 'Flexible',
  start_date DATE,
  end_date DATE,
  days_count INTEGER NOT NULL DEFAULT 1,
  travelers_adults INTEGER NOT NULL DEFAULT 1,
  travelers_children INTEGER NOT NULL DEFAULT 0,
  budget_total NUMERIC,
  currency TEXT NOT NULL DEFAULT 'USD',
  budget_category TEXT,
  overview TEXT,
  budget_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  trip_check JSONB NOT NULL DEFAULT '{}'::jsonb,
  fit_score INTEGER,
  agent_reasoning JSONB NOT NULL DEFAULT '{}'::jsonb,
  guide JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT ALL ON public.trips TO service_role;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own trips" ON public.trips FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.trip_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  destination_flexible BOOLEAN NOT NULL DEFAULT false,
  preferred_region TEXT,
  budget_flexibility TEXT,
  children_ages TEXT,
  travel_styles TEXT[] NOT NULL DEFAULT '{}',
  pace TEXT,
  accommodation TEXT[] NOT NULL DEFAULT '{}',
  transportation TEXT[] NOT NULL DEFAULT '{}',
  accessibility_needs TEXT[] NOT NULL DEFAULT '{}',
  accessibility_notes TEXT,
  free_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_preferences TO authenticated;
GRANT ALL ON public.trip_preferences TO service_role;
ALTER TABLE public.trip_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own trip preferences" ON public.trip_preferences FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.itinerary_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  date DATE,
  theme TEXT,
  notes TEXT,
  estimated_day_cost NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.itinerary_days TO authenticated;
GRANT ALL ON public.itinerary_days TO service_role;
ALTER TABLE public.itinerary_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own itinerary days" ON public.itinerary_days FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.itinerary_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day_id UUID NOT NULL REFERENCES public.itinerary_days(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  time_of_day TEXT NOT NULL DEFAULT 'morning',
  sort_order INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER,
  estimated_cost NUMERIC,
  why_it_fits TEXT,
  transport_note TEXT,
  travel_time_minutes INTEGER,
  accessibility_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.itinerary_items TO authenticated;
GRANT ALL ON public.itinerary_items TO service_role;
ALTER TABLE public.itinerary_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own itinerary items" ON public.itinerary_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_trips_user ON public.trips(user_id, created_at DESC);
CREATE INDEX idx_days_trip ON public.itinerary_days(trip_id, day_number);
CREATE INDEX idx_items_day ON public.itinerary_items(day_id, sort_order);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();