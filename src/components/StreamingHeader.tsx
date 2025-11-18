import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, Bell, User, LogOut, Settings, Heart, History, ChevronDown, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useVideo } from '../context/VideoContext';

const StreamingHeader = () => {
  const { user, logout, notifications, unreadCount, markNotificationAsRead, markAllNotificationsAsRead } = useAuth();
  const { searchVideos } = useVideo();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Fermeture automatique des menus en cliquant à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleSearch = async () => {
      if (searchQuery.trim()) {
        const results = await searchVideos(searchQuery);
        setSearchResults(results.slice(0, 5));
        setShowSearchResults(true);
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    };

    const debounceTimer = setTimeout(handleSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, searchVideos]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSearchSelect = (videoId: string) => {
    navigate(`/video/${videoId}`);
    setSearchQuery('');
    setShowSearchResults(false);
  };

  const handleNotificationClick = async (notificationId: string) => {
    await markNotificationAsRead(notificationId);
  };

  const handleMarkAllAsRead = async () => {
    await markAllNotificationsAsRead();
  };

  const isActivePage = (path: string) => {
    return location.pathname === path;
  };

  const navLinkClass = (path: string) => {
    const baseClass = "relative px-4 py-2 rounded-lg font-medium transition-all duration-300 hover:bg-white/10";
    const activeClass = isActivePage(path) 
      ? 'text-white bg-red-600/20 border border-red-500/30' 
      : 'text-gray-300 hover:text-white';
    return `${baseClass} ${activeClass}`;
  };

  // Logique pour afficher différents liens selon la page
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
      isScrolled 
        ? 'bg-black/95 backdrop-blur-xl border-b border-gray-800/50 shadow-2xl' 
        : 'bg-gradient-to-b from-black/90 via-black/60 to-transparent'
    }`}>
      <div className="container mx-auto px-4 md:px-16">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo amélioré */}
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-red-800 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-red-500/25 transition-all">
                <span className="text-white font-bold text-lg">Y</span>
              </div>
              <span className="text-red-600 text-2xl md:text-3xl font-bold tracking-wider">
                YUNOA
              </span>
            </Link>

            {/* Navigation - Desktop */}
            {!isAuthPage && (
              <nav className="hidden md:flex items-center space-x-2">
                <Link to="/" className={navLinkClass('/')}>
                  Accueil
                </Link>
                <Link to="/series" className={navLinkClass('/series')}>
                  Séries
                </Link>
                <Link to="/movies" className={navLinkClass('/movies')}>
                  Films
                </Link>
                <Link to="/browse" className={navLinkClass('/browse')}>
                  Explorer
                </Link>
                {user && (
                  <>
                    <Link to="/my-list" className={navLinkClass('/my-list')}>
                      Ma liste
                    </Link>
                  </>
                )}
              </nav>
            )}

            {/* Navigation simplifiée pour auth pages */}
            {isAuthPage && (
              <nav className="hidden md:flex items-center">
              </nav>
            )}
          </div>

          {/* Section droite */}
          <div className="flex items-center space-x-4">
            {/* Recherche améliorée */}
            {!isAuthPage && user && (
              <div className="relative" ref={searchRef}>
                <div className={`flex items-center transition-all duration-300 ${
                  showSearchResults ? 'bg-black/80' : 'bg-black/50'
                } border border-gray-600/50 rounded-xl px-4 py-2 hover:border-white/30 focus-within:border-red-500/50 backdrop-blur-sm`}>
                  <Search className="w-4 h-4 text-gray-400 mr-3" />
                  <input
                    type="text"
                    placeholder="Titres, genres, acteurs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent text-white placeholder-gray-400 outline-none w-32 md:w-48 text-sm"
                  />
                </div>

                {/* Résultats de recherche */}
                {showSearchResults && searchResults.length > 0 && (
                  <div className="absolute top-full right-0 mt-3 w-80 bg-black/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl overflow-hidden">
                    {searchResults.map(video => (
                      <button
                        key={video.id}
                        onClick={() => handleSearchSelect(video.id)}
                        className="w-full flex items-center space-x-4 p-4 hover:bg-gray-800/50 transition-colors text-left group"
                      >
                        <img
                          src={video.thumbnail}
                          alt={video.title}
                          className="w-16 h-10 object-cover rounded-lg group-hover:scale-105 transition-transform"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white font-medium truncate group-hover:text-red-400 transition-colors">
                            {video.title}
                          </h4>
                          <p className="text-gray-400 text-sm truncate">{video.category}</p>
                        </div>
                      </button>
                    ))}
                    
                    {searchQuery && (
                      <Link
                        to={`/search?q=${encodeURIComponent(searchQuery)}`}
                        className="block w-full p-4 text-center text-red-400 hover:bg-gray-800/50 transition-colors border-t border-gray-700/50 font-medium"
                        onClick={() => {
                          setShowSearchResults(false);
                          setSearchQuery('');
                        }}
                      >
                        Voir tous les résultats pour "{searchQuery}"
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}

            {user ? (
              <>
                {/* Notifications */}
                <div className="relative" ref={notificationsRef}>
                  <button 
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/10"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Menu des notifications */}
                  {showNotifications && (
                    <div className="absolute top-full right-0 mt-3 w-80 bg-black/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl overflow-hidden max-h-96">
                      <div className="p-4 border-b border-gray-700/50 bg-gradient-to-r from-red-600/10 to-purple-600/10 flex items-center justify-between">
                        <h3 className="text-white font-semibold">Notifications</h3>
                        <div className="flex items-center space-x-2">
                          {unreadCount > 0 && (
                            <button
                              onClick={handleMarkAllAsRead}
                              className="text-xs text-red-400 hover:text-red-300 transition-colors"
                            >
                              Tout lire
                            </button>
                          )}
                          <button
                            onClick={() => setShowNotifications(false)}
                            className="text-gray-400 hover:text-white transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="max-h-64 overflow-y-auto">
                        {notifications.length > 0 ? (
                          notifications.slice(0, 10).map((notification) => (
                            <div
                              key={notification.id}
                              onClick={() => handleNotificationClick(notification.id)}
                               className={`p-4 transition-colors cursor-pointer border-l-4 ${
                                 notification.is_read 
                                   ? "border-transparent bg-gray-800/20 hover:bg-gray-800/30" 
                                   : "border-red-500 bg-red-600/10 hover:bg-red-600/20"
                               }`}
                            >
                              <div className="flex items-start space-x-3">
                                <div className={`w-2 h-2 rounded-full mt-2 ${
                                  notification.is_read ? 'bg-gray-600' : 'bg-red-500'
                                }`}></div>
                                <div className="flex-1 min-w-0">
                                  <h4 className={`font-semibold text-sm ${
                                    notification.is_read ? 'text-gray-300' : 'text-white'
                                  }`}>
                                    {notification.title}
                                  </h4>
                                   <p className={`text-sm mt-1 line-clamp-2 ${
                                     notification.is_read ? 'text-gray-500' : 'text-gray-300'
                                   }`}>
                                     {notification.message}
                                   </p>
                                   <p className="text-gray-500 text-xs mt-2">
                                     {new Date(notification.createdAt || notification.created_at).toLocaleDateString('fr-FR', {
                                       day: 'numeric',
                                       month: 'short',
                                       hour: '2-digit',
                                       minute: '2-digit'
                                     })}
                                   </p>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-8 text-center">
                            <Bell className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-400">Aucune notification</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Menu utilisateur amélioré */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center space-x-3 p-2 rounded-xl hover:bg-white/10 transition-all group"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-red-800 rounded-lg flex items-center justify-center shadow-lg">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {showUserMenu && (
                    <div className="absolute top-full right-0 mt-3 w-64 bg-black/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl overflow-hidden">
                      <div className="p-4 border-b border-gray-700/50 bg-gradient-to-r from-red-600/10 to-pink-600/10">
                        <p className="text-white font-semibold text-lg">{user.username}</p>
                        <p className="text-gray-400 text-sm">{user.email}</p>
                      </div>
                      
                      <div className="py-2">
                        <Link
                          to="/profile"
                          className="flex items-center space-x-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800/50 transition-all group"
                          onClick={() => setShowUserMenu(false)}
                        >
                          <User className="w-5 h-5 group-hover:text-blue-400 transition-colors" />
                          <span className="font-medium">Profil</span>
                        </Link>
                        
                        <Link
                          to="/my-list"
                          className="flex items-center space-x-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800/50 transition-all group"
                          onClick={() => setShowUserMenu(false)}
                        >
                          <Heart className="w-5 h-5 group-hover:text-red-400 transition-colors" />
                          <span className="font-medium">Ma liste</span>
                        </Link>
                        
                        <Link
                          to="/history"
                          className="flex items-center space-x-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800/50 transition-all group"
                          onClick={() => setShowUserMenu(false)}
                        >
                          <History className="w-5 h-5 group-hover:text-green-400 transition-colors" />
                          <span className="font-medium">Historique</span>
                        </Link>
                        
                        <Link
                          to="/settings"
                          className="flex items-center space-x-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800/50 transition-all group"
                          onClick={() => setShowUserMenu(false)}
                        >
                          <Settings className="w-5 h-5 group-hover:text-purple-400 transition-colors" />
                          <span className="font-medium">Paramètres</span>
                        </Link>
                      </div>
                      
                      <div className="border-t border-gray-700/50">
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            handleLogout();
                          }}
                          className="flex items-center space-x-3 w-full px-4 py-3 text-gray-300 hover:text-red-400 hover:bg-red-600/10 transition-all group"
                        >
                          <LogOut className="w-5 h-5 group-hover:text-red-400 transition-colors" />
                          <span className="font-medium">Déconnexion</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  to="/login"
                  className="text-gray-300 hover:text-white transition-colors font-medium"
                >
                  Connexion
                </Link>
                <Link
                  to="/register"
                  className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-6 py-2 rounded-xl transition-all transform hover:scale-105 font-medium shadow-lg"
                >
                  S'inscrire
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Navigation mobile */}
        {!isAuthPage && user && (
          <nav className="md:hidden flex items-center justify-center space-x-6 pb-4">
            <Link to="/" className={navLinkClass('/')}>
              Accueil
            </Link>
            <Link to="/series" className={navLinkClass('/series')}>
              Séries
            </Link>
            <Link to="/movies" className={navLinkClass('/movies')}>
              Films
            </Link>
            <Link to="/browse" className={navLinkClass('/browse')}>
              Explorer
            </Link>
            <Link to="/my-list" className={navLinkClass('/my-list')}>
              Ma liste
            </Link>
          </nav>
        )}

        {/* Navigation mobile simplifiée pour auth pages */}
        {isAuthPage && (
          <nav className="md:hidden flex items-center justify-center pb-4">
          </nav>
        )}
      </div>
    </header>
  );
};

export default StreamingHeader;
