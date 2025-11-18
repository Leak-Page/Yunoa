-- Create watch history table
CREATE TABLE public.watch_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
  episode_id UUID REFERENCES public.episodes(id) ON DELETE CASCADE,
  progress DECIMAL(5,4) NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 1),
  current_time INTEGER NOT NULL DEFAULT 0,
  total_duration INTEGER,
  watched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_video_episode UNIQUE(user_id, video_id, episode_id)
);

-- Enable RLS
ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own watch history" 
ON public.watch_history 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own watch history" 
ON public.watch_history 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own watch history" 
ON public.watch_history 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own watch history" 
ON public.watch_history 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_watch_history_updated_at
BEFORE UPDATE ON public.watch_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_watch_history_user_id ON public.watch_history(user_id);
CREATE INDEX idx_watch_history_video_id ON public.watch_history(video_id);
CREATE INDEX idx_watch_history_episode_id ON public.watch_history(episode_id);
CREATE INDEX idx_watch_history_watched_at ON public.watch_history(watched_at);