
import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Filter, SlidersHorizontal, X, Grid3X3, List, Star, Eye, Calendar } from 'lucide-react';
import { useVideo } from '../context/VideoContext';
import VideoCard from '../components/VideoCard';
import ModernVideoGrid from '../components/ModernVideoGrid';

const Browse = () => {
  const { videos, categories, searchVideos } = useVideo();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(videos);
  const [filteredResults, setFilteredResults] = useState(videos);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'modern'>('modern');
  
  // Filtres améliorés
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [yearRange, setYearRange] = useState({ min: '', max: '' });
  const [ratingRange, setRatingRange] = useState({ min: 0, max: 5 });
  const [sortBy, setSortBy] = useState('relevance');

  const languages = ['FR', 'EN', 'ES', 'DE', 'IT'];
  const currentYear = new Date().getFullYear();
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setResults(videos);
    setFilteredResults(videos);
  }, [videos]);

  // Debounce pour la recherche (attendre 300ms après la dernière saisie)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      handleSearch();
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query]);

  useEffect(() => {
    applyFilters();
  }, [results, selectedCategories, selectedLanguage, yearRange, ratingRange, sortBy]);

  const handleSearch = useCallback(async () => {
    setIsLoading(true);
    
    try {
      if (query.trim() === '') {
        setResults(videos);
      } else {
        // Éviter les recherches trop courtes
        if (query.trim().length < 2) {
          setResults(videos);
          return;
        }
        const searchResults = await searchVideos(query);
        setResults(searchResults);
      }
    } catch (error) {
      console.error('Erreur lors de la recherche:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [query, videos, searchVideos]);

  const applyFilters = useCallback(() => {
    let filtered = [...results];

    // Filtre par catégories multiples amélioré
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(video => {
        if (Array.isArray(video.category)) {
          return selectedCategories.some(cat => video.category.includes(cat));
        } else {
          return selectedCategories.includes(video.category);
        }
      });
    }

    // Filtre par langue
    if (selectedLanguage) {
      filtered = filtered.filter(video => video.language === selectedLanguage);
    }

    // Filtre par année
    if (yearRange.min) {
      filtered = filtered.filter(video => video.year >= parseInt(yearRange.min));
    }
    if (yearRange.max) {
      filtered = filtered.filter(video => video.year <= parseInt(yearRange.max));
    }

    // Filtre par note
    filtered = filtered.filter(video => 
      video.averageRating >= ratingRange.min && video.averageRating <= ratingRange.max
    );

    // Tri
    switch (sortBy) {
      case 'title':
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'year':
        filtered.sort((a, b) => b.year - a.year);
        break;
      case 'rating':
        filtered.sort((a, b) => b.averageRating - a.averageRating);
        break;
      case 'views':
        filtered.sort((a, b) => b.views - a.views);
        break;
      case 'recent':
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      default:
        if (query.trim()) {
          filtered.sort((a, b) => {
            const aScore = a.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
            const bScore = b.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
            return bScore - aScore;
          });
        }
        break;
    }

    setFilteredResults(filtered);
  }, [results, selectedCategories, selectedLanguage, yearRange, ratingRange, sortBy, query]);

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setSelectedLanguage('');
    setYearRange({ min: '', max: '' });
    setRatingRange({ min: 0, max: 5 });
    setSortBy('relevance');
  };

  const formatCategories = (cats: string[]) => {
    return cats.join(', ');
  };

  const activeFiltersCount = [
    selectedCategories.length > 0,
    selectedLanguage,
    yearRange.min,
    yearRange.max,
    ratingRange.min !== 0,
    ratingRange.max !== 5
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen pt-20 bg-black">
      <div className="container mx-auto px-4 py-8">
        {/* En-tête moderne */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2 flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-pink-600 rounded-2xl flex items-center justify-center">
                  <Search className="w-6 h-6 text-white" />
                </div>
                <span>Explorer</span>
              </h1>
              <p className="text-gray-400">Découvrez notre catalogue complet</p>
            </div>
            
            {/* Sélection du mode d'affichage */}
            <div className="flex items-center space-x-2 bg-gray-800/50 rounded-lg p-1">
              <button
                onClick={() => setViewMode('modern')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
                  viewMode === 'modern' 
                    ? 'bg-red-600 text-white' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <List className="w-4 h-4" />
                <span>Moderne</span>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
                  viewMode === 'grid' 
                    ? 'bg-red-600 text-white' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Grid3X3 className="w-4 h-4" />
                <span>Grille Classique</span>
              </button>
            </div>
          </div>
          
          {/* Barre de recherche */}
          <div className="relative max-w-2xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher des vidéos, catégories..."
                className="w-full bg-gray-900/60 border border-gray-600/50 text-white rounded-2xl pl-12 pr-4 py-4 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all text-lg backdrop-blur-sm"
              />
              {isLoading && (
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-500"></div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Barre de filtres améliorée */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center space-x-2 px-6 py-3 rounded-2xl transition-all transform hover:scale-105 ${
                  showFilters || activeFiltersCount > 0
                    ? 'bg-gradient-to-r from-red-600 to-pink-600 text-white shadow-lg'
                    : 'bg-gray-800/60 text-gray-300 hover:bg-gray-700/60'
                }`}
              >
                <SlidersHorizontal className="w-5 h-5" />
                <span>Filtres</span>
                {activeFiltersCount > 0 && (
                  <span className="bg-white/20 text-white text-xs px-2 py-1 rounded-full font-bold">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
              
              {activeFiltersCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="flex items-center space-x-1 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span>Effacer les filtres</span>
                </button>
              )}
            </div>
            
            <div className="text-gray-400">
              {filteredResults.length} résultat{filteredResults.length !== 1 ? 's' : ''}
              {query && ` pour "${query}"`}
            </div>
          </div>

          {/* Enhanced Filter Panel */}
          {showFilters && (
            <div className="bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-2xl rounded-2xl p-6 border border-red-500/20 shadow-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {/* Categories */}
                <div className="space-y-3">
                  <label className="flex items-center space-x-2 text-white font-semibold">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span>Catégories</span>
                  </label>
                  <div className="bg-gray-800/50 rounded-xl p-4 max-h-48 overflow-y-auto space-y-2">
                    {categories.map(category => (
                      <label key={category} className="flex items-center space-x-3 cursor-pointer group">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={selectedCategories.includes(category)}
                            onChange={() => toggleCategory(category)}
                            className="sr-only"
                          />
                          <div className={`w-5 h-5 rounded border-2 transition-all duration-200 ${
                            selectedCategories.includes(category) 
                              ? 'bg-red-500 border-red-500' 
                              : 'border-gray-500 group-hover:border-red-400'
                          }`}>
                            {selectedCategories.includes(category) && (
                              <svg className="w-3 h-3 text-white absolute top-0.5 left-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </div>
                        <span className={`text-sm transition-colors ${
                          selectedCategories.includes(category) ? 'text-white' : 'text-gray-300 group-hover:text-white'
                        }`}>
                          {category}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Language */}
                <div className="space-y-3">
                  <label className="flex items-center space-x-2 text-white font-semibold">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>Langue</span>
                  </label>
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="w-full bg-gray-800/70 border border-gray-600/50 text-white rounded-xl px-4 py-3 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all"
                  >
                    <option value="">Toutes les langues</option>
                    {languages.map(lang => (
                      <option key={lang} value={lang}>{lang}</option>
                    ))}
                  </select>
                </div>

                {/* Year Range */}
                <div className="space-y-3">
                  <label className="flex items-center space-x-2 text-white font-semibold">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Année</span>
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      value={yearRange.min}
                      onChange={(e) => setYearRange({ ...yearRange, min: e.target.value })}
                      placeholder="Min"
                      min="1900"
                      max={currentYear}
                      className="w-full bg-gray-800/70 border border-gray-600/50 text-white rounded-xl px-3 py-3 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all text-sm"
                    />
                    <input
                      type="number"
                      value={yearRange.max}
                      onChange={(e) => setYearRange({ ...yearRange, max: e.target.value })}
                      placeholder="Max"
                      min="1900"
                      max={currentYear}
                      className="w-full bg-gray-800/70 border border-gray-600/50 text-white rounded-xl px-3 py-3 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all text-sm"
                    />
                  </div>
                </div>

                {/* Sort */}
                <div className="space-y-3">
                  <label className="flex items-center space-x-2 text-white font-semibold">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span>Trier par</span>
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full bg-gray-800/70 border border-gray-600/50 text-white rounded-xl px-4 py-3 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all"
                  >
                    <option value="relevance">Pertinence</option>
                    <option value="recent">Plus récent</option>
                    <option value="title">Titre A-Z</option>
                    <option value="year">Année (récent)</option>
                    <option value="rating">Note (élevée)</option>
                    <option value="views">Popularité</option>
                  </select>
                </div>
              </div>

              {/* Rating Range */}
              <div className="mt-6 pt-6 border-t border-gray-700/50">
                <label className="flex items-center space-x-2 text-white font-semibold mb-4">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span>Note: {ratingRange.min} - {ratingRange.max} étoiles</span>
                </label>
                <div className="flex items-center space-x-4">
                  <span className="text-gray-400 text-sm">Min</span>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.5"
                    value={ratingRange.min}
                    onChange={(e) => setRatingRange({ ...ratingRange, min: parseFloat(e.target.value) })}
                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #dc2626 0%, #dc2626 ${(ratingRange.min / 5) * 100}%, #374151 ${(ratingRange.min / 5) * 100}%, #374151 100%)`
                    }}
                  />
                  <span className="text-gray-400 text-sm">Max</span>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.5"
                    value={ratingRange.max}
                    onChange={(e) => setRatingRange({ ...ratingRange, max: parseFloat(e.target.value) })}
                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #dc2626 0%, #dc2626 ${(ratingRange.max / 5) * 100}%, #374151 ${(ratingRange.max / 5) * 100}%, #374151 100%)`
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Résultats */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
          </div>
        ) : (
          <>
            {filteredResults.length > 0 ? (
              viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-8">
                  {filteredResults.map((video) => (
                    <div key={video.id} className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-sm border border-gray-800/50 hover:border-red-500/30 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-red-500/10">
                      <VideoCard video={video} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-12">
                  {categories.map(category => {
                    const categoryVideos = filteredResults.filter(video => 
                      Array.isArray(video.category) 
                        ? video.category.includes(category)
                        : video.category === category
                    );
                    
                    if (categoryVideos.length === 0) return null;
                    
                    return (
                      <div key={category}>
                        <div className="flex items-center space-x-4 mb-6">
                          <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-pink-600 rounded-xl flex items-center justify-center">
                            <span className="text-white font-bold text-sm">{category[0]}</span>
                          </div>
                          <div>
                            <h2 className="text-2xl font-bold text-white">{category}</h2>
                            <p className="text-gray-400">{categoryVideos.length} vidéos disponibles</p>
                          </div>
                        </div>
                        <ModernVideoGrid
                          videos={categoryVideos}
                          columns={5}
                          showDescription={false}
                        />
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="text-center py-12">
                <div className="bg-gray-900/60 backdrop-blur-xl rounded-3xl p-12 max-w-md mx-auto border border-gray-700/50">
                  <Search className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">Aucun résultat trouvé</h3>
                  <p className="text-gray-400 mb-4">
                    {query 
                      ? `Aucune vidéo ne correspond à "${query}" avec les filtres appliqués.`
                      : 'Aucune vidéo ne correspond aux filtres appliqués.'
                    }
                  </p>
                  {(query || activeFiltersCount > 0) && (
                    <div className="mt-6 space-x-3">
                      {query && (
                        <button
                          onClick={() => setQuery('')}
                          className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                        >
                          Effacer la recherche
                        </button>
                      )}
                      {activeFiltersCount > 0 && (
                        <button
                          onClick={clearFilters}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                          Effacer les filtres
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Browse;
