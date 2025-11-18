
# Streaming App Server

## Installation

1. Créez la base de données MySQL `streamingdb`
2. Exécutez le script SQL fourni pour créer les tables
3. Installez les dépendances :

```bash
cd server
npm install
```

## Configuration

Assurez-vous que votre configuration MySQL correspond à celle dans `server.js` :

```javascript
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'streamingdb',
  port: 3306
};
```

## Démarrage

```bash
# Mode production
npm start

# Mode développement (avec nodemon)
npm run dev
```

Le serveur démarre sur le port 3001.

## API Endpoints

### Authentication
- POST `/api/auth/login` - Connexion
- POST `/api/auth/register` - Inscription

### Videos
- GET `/api/videos` - Liste des vidéos
- GET `/api/videos/:id` - Détails d'une vidéo
- POST `/api/videos/:id/views` - Incrémenter les vues
- GET `/api/search?q=query` - Recherche de vidéos
- GET `/api/top-rated?limit=12` - Vidéos les mieux notées

### Categories
- GET `/api/categories` - Liste des catégories

### Favorites (Auth required)
- GET `/api/favorites/:userId` - Favoris de l'utilisateur
- POST `/api/favorites` - Ajouter aux favoris
- DELETE `/api/favorites/:userId/:videoId` - Supprimer des favoris

### Watch History (Auth required)
- GET `/api/watch-history/:userId` - Historique de visionnage
- POST `/api/watch-history` - Ajouter à l'historique

### Ratings (Auth required)
- GET `/api/ratings/:userId/:videoId` - Note de l'utilisateur
- POST `/api/ratings` - Noter une vidéo
