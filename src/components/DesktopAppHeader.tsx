import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, Bell, User, LogOut, Settings, Heart, History, ChevronDown, X, Monitor, Maximize2, Minimize2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useVideo } from '../context/VideoContext';

const DesktopAppHeader = () => {
  const { user, logout, notifications, unreadCount, markNotificationAsRead, markAllNotificationsAsRead } = useAuth();
  const { searchVideos } = useVideo();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Gestion du plein écran pour l'app desktop
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // Fermeture automatique des menus
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
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
    const baseClass = "relative px-3 py-2 rounded-lg font-medium transition-all duration-300 hover:bg-white/10 text-sm";
    const activeClass = isActivePage(path) 
      ? 'text-white bg-red-600/20 border border-red-500/30' 
      : 'text-gray-300 hover:text-white';
    return `${baseClass} ${activeClass}`;
  };

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-xl border-b border-gray-800/50 shadow-lg">
      <div className="flex items-center justify-between h-14 px-4">
        {/* Logo section - plus compact */}
        <div className="flex items-center space-x-6">
          <Link to="/" className="flex items-center space-x-2 group">
            <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-red-800 rounded-lg flex items-center justify-center shadow-lg group-hover:shadow-red-500/25 transition-all">
              <span className="text-white font-bold text-sm">Y</span>
            </div>
            <span className="text-red-600 text-xl font-bold tracking-wider hidden sm:block">
              YUNOA
            </span>
            <div className="hidden lg:flex items-center space-x-1 text-xs text-gray-400">
              <Monitor className="w-3 h-3" />
              <span>Desktop</span>
            </div>
          </Link>

          {/* Navigation compacte */}
          {!isAuthPage && (
            <nav className="hidden md:flex items-center space-x-1">
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
                <Link to="/my-list" className={navLinkClass('/my-list')}>
                  Ma liste
                </Link>
              )}
            </nav>
          )}
        </div>

        {/* Section droite */}
        <div className="flex items-center space-x-2">
          {/* Recherche compacte */}
          {!isAuthPage && user && (
            <div className="relative" ref={searchRef}>
              <div className={`flex items-center transition-all duration-300 ${
                showSearchResults ? 'bg-black/80' : 'bg-black/50'
              } border border-gray-600/50 rounded-lg px-3 py-2 hover:border-white/30 focus-within:border-red-500/50 backdrop-blur-sm`}>
                <Search className="w-4 h-4 text-gray-400 mr-2" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-white placeholder-gray-400 outline-none w-24 md:w-32 text-sm"
                />
              </div>

              {/* Résultats de recherche - optimisés pour desktop */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-black/95 backdrop-blur-xl border border-gray-700/50 rounded-xl shadow-2xl overflow-hidden max-h-80">
                  {searchResults.map(video => (
                    <button
                      key={video.id}
                      onClick={() => handleSearchSelect(video.id)}
                      className="w-full flex items-center space-x-3 p-3 hover:bg-gray-800/50 transition-colors text-left group"
                    >
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="w-12 h-8 object-cover rounded group-hover:scale-105 transition-transform"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium truncate group-hover:text-red-400 transition-colors text-sm">
                          {video.title}
                        </h4>
                        <p className="text-gray-400 text-xs truncate">{video.category}</p>
                      </div>
                    </button>
                  ))}
                  
                  {searchQuery && (
                    <Link
                      to={`/search?q=${encodeURIComponent(searchQuery)}`}
                      className="block w-full p-3 text-center text-red-400 hover:bg-gray-800/50 transition-colors border-t border-gray-700/50 font-medium text-sm"
                      onClick={() => {
                        setShowSearchResults(false);
                        setSearchQuery('');
                      }}
                    >
                      Voir tous les résultats
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}


          {user ? (
            <>
              {/* Notifications compactes */}
              <div className="relative" ref={notificationsRef}>
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/10"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Menu des notifications - optimisé pour desktop */}
                {showNotifications && (
                  <div className="absolute top-full right-0 mt-2 w-72 bg-black/95 backdrop-blur-xl border border-gray-700/50 rounded-xl shadow-2xl overflow-hidden max-h-80">
                    <div className="p-3 border-b border-gray-700/50 bg-gradient-to-r from-red-600/10 to-purple-600/10 flex items-center justify-between">
                      <h3 className="text-white font-semibold text-sm">Notifications</h3>
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
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="max-h-56 overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.slice(0, 8).map((notification) => (
                          <div
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification.id)}
                            className={`p-3 hover:bg-gray-800/30 transition-colors cursor-pointer border-l-2 ${
                              notification.isRead 
                                ? 'border-transparent bg-gray-800/20' 
                                : 'border-red-500 bg-red-600/5'
                            }`}
                          >
                            <div className="flex items-start space-x-2">
                              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${
                                notification.isRead ? 'bg-gray-600' : 'bg-red-500'
                              }`}></div>
                              <div className="flex-1 min-w-0">
                                <h4 className={`font-semibold text-xs ${
                                  notification.isRead ? 'text-gray-300' : 'text-white'
                                }`}>
                                  {notification.title}
                                </h4>
                                <p className="text-gray-400 text-xs mt-1 line-clamp-2">
                                  {notification.message}
                                </p>
                                <p className="text-gray-500 text-xs mt-1">
                                  {new Date(notification.createdAt).toLocaleDateString('fr-FR', {
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
                        <div className="p-6 text-center">
                          <Bell className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                          <p className="text-gray-400 text-sm">Aucune notification</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Menu utilisateur compact */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 p-2 rounded-lg hover:bg-white/10 transition-all group"
                >
                  <div className="w-6 h-6 bg-gradient-to-br from-red-600 to-red-800 rounded-lg flex items-center justify-center shadow-lg">
                    <User className="w-3 h-3 text-white" />
                  </div>
                  <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                </button>

                {showUserMenu && (
                  <div className="absolute top-full right-0 mt-2 w-52 bg-black/95 backdrop-blur-xl border border-gray-700/50 rounded-xl shadow-2xl overflow-hidden">
                    <div className="p-3 border-b border-gray-700/50 bg-gradient-to-r from-red-600/10 to-pink-600/10">
                      <p className="text-white font-semibold text-sm">{user.username}</p>
                      <p className="text-gray-400 text-xs truncate">{user.email}</p>
                    </div>
                    
                    <div className="py-1">
                      <Link
                        to="/profile"
                        className="flex items-center space-x-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-800/50 transition-all group text-sm"
                        onClick={() => setShowUserMenu(false)}
                      >
                        <User className="w-4 h-4 group-hover:text-blue-400 transition-colors" />
                        <span>Profil</span>
                      </Link>
                      
                      <Link
                        to="/my-list"
                        className="flex items-center space-x-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-800/50 transition-all group text-sm"
                        onClick={() => setShowUserMenu(false)}
                      >
                        <Heart className="w-4 h-4 group-hover:text-red-400 transition-colors" />
                        <span>Ma liste</span>
                      </Link>
                      
                      <Link
                        to="/history"
                        className="flex items-center space-x-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-800/50 transition-all group text-sm"
                        onClick={() => setShowUserMenu(false)}
                      >
                        <History className="w-4 h-4 group-hover:text-green-400 transition-colors" />
                        <span>Historique</span>
                      </Link>
                      
                      <Link
                        to="/settings"
                        className="flex items-center space-x-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-800/50 transition-all group text-sm"
                        onClick={() => setShowUserMenu(false)}
                      >
                        <Settings className="w-4 h-4 group-hover:text-purple-400 transition-colors" />
                        <span>Paramètres</span>
                      </Link>
                    </div>
                    
                    <div className="border-t border-gray-700/50">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          handleLogout();
                        }}
                        className="flex items-center space-x-2 w-full px-3 py-2 text-gray-300 hover:text-red-400 hover:bg-red-600/10 transition-all group text-sm"
                      >
                        <LogOut className="w-4 h-4 group-hover:text-red-400 transition-colors" />
                        <span>Déconnexion</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center space-x-2">
              <Link
                to="/login"
                className="text-gray-300 hover:text-white transition-colors font-medium text-sm px-3 py-2 rounded-lg hover:bg-white/10"
              >
                Connexion
              </Link>
              <Link
                to="/register"
                className="bg-red-600 hover:bg-red-700 text-white font-medium px-3 py-2 rounded-lg transition-all text-sm"
              >
                S'inscrire
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default DesktopAppHeader;