
import { Link } from 'react-router-dom';
import { Home, Search, Film } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-8">
          <Film className="w-24 h-24 text-red-600 mx-auto mb-4" />
          <h1 className="text-6xl font-bold text-white mb-4">404</h1>
          <h2 className="text-2xl font-bold text-white mb-4">Page non trouvée</h2>
          <p className="text-gray-400 mb-8">
            Désolé, nous n'avons pas pu trouver la page que vous recherchez. 
            Elle a peut-être été déplacée ou supprimée.
          </p>
        </div>
        
        <div className="space-y-4">
          <Link
            to="/"
            className="flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors w-full"
          >
            <Home className="w-5 h-5" />
            <span>Retour à l'accueil</span>
          </Link>
          
          <Link
            to="/search"
            className="flex items-center justify-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white px-8 py-3 rounded-lg font-semibold transition-colors w-full"
          >
            <Search className="w-5 h-5" />
            <span>Rechercher du contenu</span>
          </Link>
        </div>
        
        <div className="mt-8 text-sm text-gray-500">
          <p>Code d'erreur: 404</p>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
