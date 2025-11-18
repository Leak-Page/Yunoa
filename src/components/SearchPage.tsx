import { useState, useEffect } from 'react';
import { Search, Filter, SlidersHorizontal, X } from 'lucide-react';
import { useVideo } from '../context/VideoContext';
import VideoCard from './VideoCard';

const SearchPage = () => {
  const { videos, categories, searchVideos } = useVideo();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(videos);
  const [filteredResults, setFilteredResults] = useState(videos);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filtres
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [yearRange, setYearRange] = useState({ min: '', max: '' });
  const [ratingRange, setRatingRange] = useState({ min: 0, max: 5 });
  const [sortBy, setSortBy] = useState('relevance');

  const languages = ['FR', 'EN', 'ES', 'DE', 'IT'];
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    setResults(videos);
    setFilteredResults(videos);
  }, [videos]);

  useEffect(() => {
    handleSearch();
  }, [query]);

  useEffect(() => {
    applyFilters();
  }, [results, selectedCategory, selectedLanguage, yearRange, ratingRange, sortBy]);

  const handleSearch = async () => {
    setIsLoading(true);
    
    try {
      if (query.trim() === '') {
        setResults(videos);
      } else {
        const searchResults = await searchVideos(query);
        setResults(searchResults);
      }
    } catch (error) {
      console.error('Erreur lors de la recherche:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...results];

    // Filtre par catégorie
    if (selectedCategory) {
      filtered = filtered.filter(video => video.category === selectedCategory);
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
      default: // relevance
        if (query.trim()) {
          // Tri par pertinence basé sur la correspondance du titre
          filtered.sort((a, b) => {
            const aScore = a.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
            const bScore = b.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
            return bScore - aScore;
          });
        }
        break;
    }

    setFilteredResults(filtered);
  };

  const clearFilters = () => {
    setSelectedCategory('');
    setSelectedLanguage('');
    setYearRange({ min: '', max: '' });
    setRatingRange({ min: 0, max: 5 });
    setSortBy('relevance');
  };

  const activeFiltersCount = [
    selectedCategory,
    selectedLanguage,
    yearRange.min,
    yearRange.max,
    ratingRange.min !== 0,
    ratingRange.max !== 5
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen pt-20 bg-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* En-tête de recherche */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-6 flex items-center space-x-3">
            <Search className="w-8 h-8" />
            <span>Recherche</span>
          </h1>
          
          {/* Barre de recherche */}
          <div className="relative max-w-2xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher des vidéos, catégories..."
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg pl-12 pr-4 py-4 focus:border-red-500 focus:outline-none text-lg"
              />
              {isLoading && (
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-500"></div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Barre de filtres */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  showFilters || activeFiltersCount > 0
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                }`}
              >
                <SlidersHorizontal className="w-5 h-5" />
                <span>Filtres</span>
                {activeFiltersCount > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
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

          {/* Panneau de filtres */}
          {showFilters && (
            <div className="bg-slate-800 rounded-lg p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Catégorie */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Catégorie
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:border-red-500 focus:outline-none"
                  >
                    <option value="">Toutes les catégories</option>
                    {categories.map(category => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Langue */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Langue
                  </label>
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:border-red-500 focus:outline-none"
                  >
                    <option value="">Toutes les langues</option>
                    {languages.map(lang => (
                      <option key={lang} value={lang}>{lang}</option>
                    ))}
                  </select>
                </div>

                {/* Année */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Année
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      value={yearRange.min}
                      onChange={(e) => setYearRange({ ...yearRange, min: e.target.value })}
                      placeholder="Min"
                      min="1900"
                      max={currentYear}
                      className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:border-red-500 focus:outline-none"
                    />
                    <input
                      type="number"
                      value={yearRange.max}
                      onChange={(e) => setYearRange({ ...yearRange, max: e.target.value })}
                      placeholder="Max"
                      min="1900"
                      max={currentYear}
                      className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:border-red-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Tri */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Trier par
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:border-red-500 focus:outline-none"
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

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Note: {ratingRange.min} - {ratingRange.max} étoiles
                </label>
                <div className="flex items-center space-x-4">
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.5"
                    value={ratingRange.min}
                    onChange={(e) => setRatingRange({ ...ratingRange, min: parseFloat(e.target.value) })}
                    className="flex-1"
                  />
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.5"
                    value={ratingRange.max}
                    onChange={(e) => setRatingRange({ ...ratingRange, max: parseFloat(e.target.value) })}
                    className="flex-1"
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
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {filteredResults.map((video) => (
                  <VideoCard key={video.id} video={video} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="bg-slate-800 rounded-lg p-8 max-w-md mx-auto">
                  <Search className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">Aucun résultat trouvé</h3>
                  <p className="text-gray-400 mb-4">
                    {query 
                      ? `Aucune vidéo ne correspond à "${query}" avec les filtres appliqués.`
                      : 'Aucune vidéo ne correspond aux filtres appliqués.'
                    }
                  </p>
                  <div className="space-y-2">
                    <p className="text-gray-500 text-sm">Suggestions :</p>
                    <ul className="text-gray-400 text-sm space-y-1">
                      <li>• Vérifiez l'orthographe</li>
                      <li>• Utilisez des mots-clés plus généraux</li>
                      <li>• Supprimez certains filtres</li>
                    </ul>
                  </div>
                  {(query || activeFiltersCount > 0) && (
                    <div className="mt-6 space-x-3">
                      {query && (
                        <button
                          onClick={() => setQuery('')}
                          className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
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

export default SearchPage;
