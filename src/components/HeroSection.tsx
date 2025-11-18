
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Play, Info, Volume2, VolumeX } from 'lucide-react';
import { Video } from '../context/VideoContext';

interface HeroSectionProps {
  featuredVideo: Video | null;
}

const HeroSection = ({ featuredVideo }: HeroSectionProps) => {
  const [isMuted, setIsMuted] = useState(true);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowVideo(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [featuredVideo]);

  if (!featuredVideo) return null;

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Background Image/Video */}
      <div className="absolute inset-0">
        <img
          src={featuredVideo.thumbnail}
          alt={featuredVideo.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex items-center h-full">
        <div className="container mx-auto px-4 md:px-16">
          <div className="max-w-2xl">
            {/* Netflix Original Badge */}
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-red-600 text-white px-3 py-1 text-xs font-bold tracking-wider rounded">
                YUNOA
              </div>
              {featuredVideo.type === 'series' && (
                <div className="text-gray-300 text-sm font-medium tracking-wider">
                  SÉRIE
                </div>
              )}
            </div>

            {/* Title */}
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">
              {featuredVideo.title}
            </h1>

            {/* Description */}
            <p className="text-base md:text-lg lg:text-xl text-gray-200 mb-6 line-clamp-3 leading-relaxed max-w-xl">
              {featuredVideo.description}
            </p>

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-4 mb-8 text-sm md:text-base text-gray-300">
              <span className="text-green-400 font-semibold">
                {Math.round(featuredVideo.averageRating * 20)}% Match
              </span>
              <span>{featuredVideo.year}</span>
              <div className="border border-gray-400 px-2 py-1 text-xs rounded">
                {featuredVideo.language.toUpperCase()}
              </div>
              {featuredVideo.type === 'series' && featuredVideo.totalSeasons && (
                <span>{featuredVideo.totalSeasons} saison{featuredVideo.totalSeasons > 1 ? 's' : ''}</span>
              )}
              <span className="bg-gray-800 px-2 py-1 text-xs rounded">
                {featuredVideo.category}
              </span>
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Link
                to={`/video/${featuredVideo.id}`}
                className="flex items-center justify-center space-x-2 bg-white hover:bg-gray-200 text-black px-6 md:px-8 py-3 rounded font-semibold transition-colors w-full sm:w-auto min-w-[140px]"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Lecture</span>
              </Link>
              
              <Link
                to={`/info/${featuredVideo.id}`}
                className="flex items-center justify-center space-x-2 bg-gray-600/70 hover:bg-gray-600/90 text-white px-6 md:px-8 py-3 rounded font-semibold transition-colors w-full sm:w-auto min-w-[140px]"
              >
                <Info className="w-5 h-5" />
                <span>Plus d'infos</span>
              </Link>
            </div>
          </div>
        </div>

      </div>

      {/* Fade to content */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent" />
    </div>
  );
};

export default HeroSection;
