
// Système de fallback pour les erreurs de base de données
export const fallbackData = {
  videos: [],
  categories: ['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi'],
  users: [],
  stats: {
    totalVideos: 0,
    totalUsers: 0,
    totalViews: 0
  }
};

export function getFallbackResponse(type, error) {
  console.log(`Using fallback data for ${type} due to:`, error.message);
  
  const baseResponse = {
    error: false,
    fallback: true,
    message: 'Données temporaires - service en cours de restauration'
  };

  switch (type) {
    case 'videos':
      return { ...baseResponse, data: fallbackData.videos };
    case 'categories':
      return { ...baseResponse, data: fallbackData.categories };
    case 'users':
      return { ...baseResponse, data: fallbackData.users };
    case 'stats':
      return { ...baseResponse, data: fallbackData.stats };
    default:
      return { ...baseResponse, data: null };
  }
}

export function shouldUseFallback(error) {
  return error.code === 'ETIMEDOUT' || 
         error.message?.includes('timeout') ||
         error.message?.includes('connection') ||
         error.code === 'DATABASE_TIMEOUT';
}
