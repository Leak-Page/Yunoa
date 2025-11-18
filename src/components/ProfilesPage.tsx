
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit3, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ProfilesPage = () => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState([
    {
      id: 1,
      name: user?.username || 'Utilisateur',
      avatar: '👤',
      isKids: false,
      color: 'bg-red-600'
    },
    {
      id: 2,
      name: 'Enfants',
      avatar: '🧒',
      isKids: true,
      color: 'bg-yellow-500'
    }
  ]);

  const [isManaging, setIsManaging] = useState(false);

  const handleAddProfile = () => {
    const newProfile = {
      id: profiles.length + 1,
      name: `Profil ${profiles.length + 1}`,
      avatar: '👤',
      isKids: false,
      color: `bg-${['blue', 'green', 'purple', 'pink'][Math.floor(Math.random() * 4)]}-600`
    };
    setProfiles([...profiles, newProfile]);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-white text-4xl md:text-6xl font-normal mb-8">
          {isManaging ? 'Gérer les profils :' : 'Qui regarde ?'}
        </h1>

        <div className="flex flex-wrap justify-center gap-8 mb-8">
          {profiles.map((profile) => (
            <div key={profile.id} className="text-center group cursor-pointer">
              <Link to="/" className="block">
                <div className={`w-32 h-32 md:w-40 md:h-40 ${profile.color} rounded-lg flex items-center justify-center text-4xl md:text-6xl group-hover:ring-4 group-hover:ring-white transition-all mb-3 relative`}>
                  {profile.avatar}
                  {isManaging && (
                    <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Edit3 className="w-8 h-8 text-white" />
                    </div>
                  )}
                </div>
              </Link>
              <div className="text-gray-300 text-lg md:text-xl font-normal group-hover:text-white transition-colors">
                {profile.name}
              </div>
              {profile.isKids && (
                <div className="text-yellow-500 text-sm mt-1">ENFANTS</div>
              )}
            </div>
          ))}

          {/* Add Profile Button */}
          {profiles.length < 5 && isManaging && (
            <div className="text-center group cursor-pointer" onClick={handleAddProfile}>
              <div className="w-32 h-32 md:w-40 md:h-40 bg-gray-700 rounded-lg flex items-center justify-center group-hover:bg-gray-600 transition-colors mb-3">
                <Plus className="w-12 h-12 text-gray-400" />
              </div>
              <div className="text-gray-300 text-lg md:text-xl font-normal">
                Ajouter un profil
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setIsManaging(!isManaging)}
          className="text-gray-400 hover:text-white border border-gray-400 hover:border-white px-6 py-2 transition-colors text-lg tracking-wider"
        >
          {isManaging ? 'TERMINÉ' : 'GÉRER LES PROFILS'}
        </button>
      </div>
    </div>
  );
};

export default ProfilesPage;
