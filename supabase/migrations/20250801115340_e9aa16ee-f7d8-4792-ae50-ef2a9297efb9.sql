
-- Create profiles table for user data
CREATE TABLE public.profiles (
  id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  avatar text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

-- Create categories table
CREATE TABLE public.categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text UNIQUE NOT NULL,
  description text,
  color text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Create policy for categories (readable by all authenticated users)
CREATE POLICY "Authenticated users can view categories" 
  ON public.categories FOR SELECT 
  TO authenticated 
  USING (true);

-- Create videos table
CREATE TABLE public.videos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  thumbnail text,
  video_url text NOT NULL,
  duration text,
  category text,
  language text DEFAULT 'fr',
  year integer DEFAULT EXTRACT(YEAR FROM now()),
  views integer DEFAULT 0,
  average_rating numeric DEFAULT 0,
  total_ratings integer DEFAULT 0,
  type text DEFAULT 'movie' CHECK (type IN ('movie', 'series')),
  total_seasons integer,
  total_episodes integer,
  created_by uuid REFERENCES auth.users NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for videos
CREATE POLICY "Anyone can view videos" 
  ON public.videos FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can create videos" 
  ON public.videos FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own videos" 
  ON public.videos FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own videos" 
  ON public.videos FOR DELETE 
  TO authenticated 
  USING (auth.uid() = created_by);

-- Create episodes table
CREATE TABLE public.episodes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  series_id uuid REFERENCES public.videos(id) ON DELETE CASCADE NOT NULL,
  episode_number integer NOT NULL,
  season_number integer DEFAULT 1,
  title text NOT NULL,
  description text,
  thumbnail text,
  video_url text NOT NULL,
  duration text,
  views integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(series_id, season_number, episode_number)
);

ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for episodes
CREATE POLICY "Anyone can view episodes" 
  ON public.episodes FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can manage episodes" 
  ON public.episodes FOR ALL 
  TO authenticated 
  USING (true);

-- Create favorites table
CREATE TABLE public.favorites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  video_id uuid REFERENCES public.videos(id) ON DELETE CASCADE NOT NULL,
  added_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(user_id, video_id)
);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for favorites
CREATE POLICY "Users can view their own favorites" 
  ON public.favorites FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own favorites" 
  ON public.favorites FOR ALL 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Create watch_history table
CREATE TABLE public.watch_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  video_id uuid REFERENCES public.videos(id) ON DELETE CASCADE NOT NULL,
  progress numeric DEFAULT 0,
  watched_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(user_id, video_id)
);

ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for watch_history
CREATE POLICY "Users can view their own watch history" 
  ON public.watch_history FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own watch history" 
  ON public.watch_history FOR ALL 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Create ratings table
CREATE TABLE public.ratings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  video_id uuid REFERENCES public.videos(id) ON DELETE CASCADE NOT NULL,
  rating integer CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(user_id, video_id)
);

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for ratings
CREATE POLICY "Users can view all ratings" 
  ON public.ratings FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Users can manage their own ratings" 
  ON public.ratings FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ratings" 
  ON public.ratings FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Create notifications table
CREATE TABLE public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  read_at timestamp with time zone
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for notifications
CREATE POLICY "Users can view their own notifications" 
  ON public.notifications FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" 
  ON public.notifications FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN new;
END;
$$;

-- Trigger to create profile when user signs up
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
