-- Create subtitles table for SRT subtitle management
CREATE TABLE public.subtitles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  episode_id UUID REFERENCES public.episodes(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  language_name TEXT NOT NULL,
  subtitle_url TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.subtitles ENABLE ROW LEVEL SECURITY;

-- RLS policies for subtitles
CREATE POLICY "Anyone can view subtitles" 
ON public.subtitles 
FOR SELECT 
USING (true);

CREATE POLICY "Video creators can manage subtitles for their videos" 
ON public.subtitles 
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.videos 
    WHERE videos.id = subtitles.video_id 
    AND videos.created_by = auth.uid()
  ) OR 
  (
    subtitles.episode_id IS NOT NULL AND 
    EXISTS (
      SELECT 1 FROM public.episodes e
      JOIN public.videos v ON e.series_id = v.id
      WHERE e.id = subtitles.episode_id 
      AND v.created_by = auth.uid()
    )
  ) OR 
  get_current_user_role() = 'admin'
);

-- Add trigger for updated_at
CREATE TRIGGER update_subtitles_updated_at
BEFORE UPDATE ON public.subtitles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for better performance
CREATE INDEX idx_subtitles_video_id ON public.subtitles(video_id);
CREATE INDEX idx_subtitles_episode_id ON public.subtitles(episode_id);
CREATE INDEX idx_subtitles_language ON public.subtitles(language);