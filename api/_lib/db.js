import pg from 'pg';
const { Pool } = pg;

// Configuration de la base de données
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/streamflix',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Fonction pour exécuter une requête
export async function executeQuery(query, params = []) {
  try {
    const result = await pool.query(query, params);
    return [result.rows, null];
  } catch (error) {
    console.error('Database query error:', error);
    return [null, error];
  }
}

// Fonction pour gérer les erreurs de base de données
export function handleDbError(error, context = '') {
  console.error(`Database error ${context}:`, error);
  
  if (error.code === 'ECONNREFUSED') {
    return {
      error: 'Base de données non disponible',
      code: 'DB_CONNECTION_FAILED'
    };
  }
  
  if (error.code === '23505') { // Violation de contrainte unique
    return {
      error: 'Cette ressource existe déjà',
      code: 'DUPLICATE_ENTRY'
    };
  }
  
  if (error.code === '23503') { // Violation de clé étrangère
    return {
      error: 'Référence non valide',
      code: 'FOREIGN_KEY_VIOLATION'
    };
  }
  
  return {
    error: 'Erreur de base de données',
    code: 'DB_ERROR',
    details: error.message
  };
}

export default { executeQuery, handleDbError };