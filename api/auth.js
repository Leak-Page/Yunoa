import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery, handleDbError } from './_lib/db.js';
import { shouldUseFallback } from './_lib/fallback.js';
import { authenticateToken, corsHeaders, JWT_SECRET } from './_lib/auth.js';
import { 
  checkUserLimits, 
  checkIpLimits, 
  recordFailedAttempt, 
  resetAttempts,
  getClientIp,
  sanitizeInput,
  isVpnIp
} from './_lib/security.js';

export default async (req, res) => {
  const headers = corsHeaders();
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Correction ici : compatible Vercel
    const route = req.query?.route;

    console.log('Auth API called - Route:', route, 'Method:', req.method, 'Query:', req.query);

    if (!route) {
      return res.status(400).json({ error: 'Paramètre "route" manquant dans l\'URL (ex: ?route=login)' });
    }

    if (route === 'login' && req.method === 'POST') {
      try {
        const { username, password } = req.body;
        const clientIp = getClientIp(req);
        
        // Nettoyer les inputs
        const cleanUsername = sanitizeInput(username);
        const cleanPassword = sanitizeInput(password);
        
        // Vérifier les limites IP
        const ipCheck = checkIpLimits(clientIp);
        if (!ipCheck.allowed) {
          return res.status(429).json({ 
            error: 'Identifiants incorrects',
            code: 'RATE_LIMITED'
          });
        }
        
        // Vérifier les limites utilisateur
        const userCheck = checkUserLimits(cleanUsername);
        if (!userCheck.allowed) {
          return res.status(429).json({ 
            error: 'Identifiants incorrects',
            code: 'RATE_LIMITED'
          });
        }
        
        // Vérifier VPN (optionnel)
        if (isVpnIp(clientIp)) {
          recordFailedAttempt(cleanUsername, clientIp);
          return res.status(403).json({ 
            error: 'Identifiants incorrects',
            code: 'VPN_BLOCKED' 
          });
        }

        // Requête préparée sécurisée - PostgreSQL
        const [users] = await executeQuery(
          'SELECT uuid as id, username, email, password, role FROM users WHERE username = ? OR email = ?',
          [cleanUsername, cleanUsername]
        );

        if (users.length === 0) {
          recordFailedAttempt(cleanUsername, clientIp);
          return res.status(401).json({ error: 'Identifiants incorrects' });
        }

        const user = users[0];
        const validPassword = await bcrypt.compare(cleanPassword, user.password);
        if (!validPassword) {
          recordFailedAttempt(cleanUsername, clientIp);
          return res.status(401).json({ error: 'Identifiants incorrects' });
        }
        
        // Réinitialiser les tentatives après succès
        resetAttempts(cleanUsername, clientIp);

        const token = jwt.sign(
          {
            id: user.id,
            username: user.username,
            role: user.role,
            email: user.email
          },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        return res.json({
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
          }
        });
      } catch (dbError) {
        console.error('Login database error:', dbError);

        if (shouldUseFallback(dbError)) {
          return res.status(503).json({
            error: 'Service temporairement indisponible',
            code: 'DATABASE_TIMEOUT',
            retry: true
          });
        }

        const errorResponse = handleDbError(dbError, 'connexion');
        return res.status(500).json(errorResponse);
      }
    }

    if (route === 'register' && req.method === 'POST') {
      try {
        const { username, email, password } = req.body;
        const clientIp = getClientIp(req);
        
        // Nettoyer les inputs
        const cleanUsername = sanitizeInput(username);
        const cleanEmail = sanitizeInput(email);
        const cleanPassword = sanitizeInput(password);
        
        // Vérifier VPN (optionnel)
        if (isVpnIp(clientIp)) {
          return res.status(403).json({ 
            error: 'Inscription non autorisée depuis un VPN',
            code: 'VPN_BLOCKED' 
          });
        }

        // Requête préparée sécurisée - PostgreSQL
        const [existingUsers] = await executeQuery(
          'SELECT username, email FROM users WHERE username = ? OR email = ?',
          [cleanUsername, cleanEmail]
        );

        if (existingUsers.length > 0) {
          const existingData = existingUsers[0];
          if (existingData.username === username && existingData.email === email) {
            return res.status(400).json({ error: 'Ce nom d\'utilisateur et cet email sont déjà utilisés' });
          } else if (existingData.username === username) {
            return res.status(400).json({ error: 'Ce nom d\'utilisateur est déjà utilisé' });
          } else if (existingData.email === email) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé' });
          }
        }

        const hashedPassword = await bcrypt.hash(cleanPassword, 12);
        const userId = uuidv4();

        await executeQuery(
          'INSERT INTO users (uuid, username, email, password, role, "createdAt", "isFirstLogin", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [userId, cleanUsername, cleanEmail, hashedPassword, 'membre', new Date(), 0, new Date()]
        );

        const token = jwt.sign(
          { id: userId, username: cleanUsername, role: 'membre', email: cleanEmail },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        return res.json({
          token,
          user: { id: userId, username: cleanUsername, email: cleanEmail, role: 'membre' }
        });
      } catch (dbError) {
        console.error('Register database error:', dbError);

        if (shouldUseFallback(dbError)) {
          return res.status(503).json({
            error: 'Service temporairement indisponible',
            code: 'DATABASE_TIMEOUT',
            retry: true
          });
        }

        const errorResponse = handleDbError(dbError, 'inscription');
        return res.status(500).json(errorResponse);
      }
    }

    if (route === 'verify' && req.method === 'GET') {
      try {
        const user = authenticateToken(req);
        return res.json({ user });
      } catch (authError) {
        console.error('Verify token error:', authError);
        return res.status(401).json({ error: 'Token invalide' });
      }
    }

    if (route === 'send-code' && req.method === 'POST') {
      console.log('Send code route accessed - Body:', req.body);
      try {
        const { email } = req.body;

        if (!email) {
          return res.status(400).json({ error: 'Email requis' });
        }

        // Vérifier si l'email est déjà associé à un compte
        const [existingUser] = await executeQuery(
          'SELECT email FROM users WHERE email = ?',
          [email]
        );

        if (existingUser.length > 0) {
          return res.status(400).json({ error: 'Cet email est déjà associé à un compte existant' });
        }

        const [existingCodes] = await executeQuery(
          'SELECT code, "expiresAt" FROM email_verification_codes WHERE email = ? AND used = 0 AND "expiresAt" > CURRENT_TIMESTAMP ORDER BY "createdAt" DESC LIMIT 1',
          [email]
        );

        let verificationCode;

        if (existingCodes.length > 0) {
          verificationCode = existingCodes[0].code;
          console.log('Using existing code for:', email);
        } else {
          verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
          console.log('Generated new code for:', email);

          const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

          await executeQuery(
            'INSERT INTO email_verification_codes (email, code, "expiresAt", used, "createdAt") VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
            [email, verificationCode, expiresAt, 0]
          );
        }

        try {
          const { sendVerificationEmail } = await import('./_lib/email.js');
          await sendVerificationEmail(email, verificationCode);
          console.log('Email sent successfully to:', email);
        } catch (emailError) {
          console.error('Email sending failed:', emailError);
        }

        return res.json({
          success: true,
          message: 'Code de vérification envoyé par email'
        });

      } catch (dbError) {
        console.error('Send code database error:', dbError);

        if (shouldUseFallback(dbError)) {
          return res.status(503).json({
            error: 'Service temporairement indisponible',
            code: 'DATABASE_TIMEOUT',
            retry: true
          });
        }

        const errorResponse = handleDbError(dbError, 'envoi du code de vérification');
        return res.status(500).json(errorResponse);
      }
    }

    if (route === 'verify-code' && req.method === 'POST') {
      console.log('Verify code route accessed - Body:', req.body);
      try {
        const { email, code } = req.body;

        if (!email || !code) {
          return res.status(400).json({ error: 'Email et code requis' });
        }

        const [verificationCodes] = await executeQuery(
          'SELECT id FROM email_verification_codes WHERE email = ? AND code = ? AND used = 0 AND "expiresAt" > CURRENT_TIMESTAMP',
          [email, code]
        );

        if (verificationCodes.length === 0) {
          return res.status(400).json({ error: 'Code invalide, expiré ou déjà utilisé' });
        }

        await executeQuery(
          'UPDATE email_verification_codes SET used = 1 WHERE id = ?',
          [verificationCodes[0].id]
        );

        console.log('Code verified successfully for:', email);
        return res.json({
          success: true,
          message: 'Code vérifié avec succès'
        });

      } catch (dbError) {
        console.error('Verify code database error:', dbError);

        if (shouldUseFallback(dbError)) {
          return res.status(503).json({
            error: 'Service temporairement indisponible',
            code: 'DATABASE_TIMEOUT',
            retry: true
          });
        }

        const errorResponse = handleDbError(dbError, 'vérification du code');
        return res.status(500).json(errorResponse);
      }
    }

    if (route === 'forgot-password' && req.method === 'POST') {
      try {
        const { email } = req.body;

        if (!email) {
          return res.status(400).json({ error: 'Email requis' });
        }

        // Vérifier si l'email existe
        const [existingUser] = await executeQuery(
          'SELECT uuid FROM users WHERE email = ?',
          [email]
        );

        if (existingUser.length === 0) {
          return res.status(400).json({ 
            error: 'Cet email n\'est associé à aucun compte. Veuillez vérifier si vous l\'avez bien écrit ou si vous avez un compte.' 
          });
        }

        const userId = existingUser[0].uuid;

        // Générer un token sécurisé
        const resetToken = jwt.sign(
          { 
            id: userId, 
            email: email,
            purpose: 'password_reset',
            timestamp: Date.now()
          },
          JWT_SECRET,
          { expiresIn: '15m' }
        );

        // Supprimer les anciens tokens de reset pour cet email
        await executeQuery('DELETE FROM password_resets WHERE email = ?', [email]);

        // Insérer le nouveau token
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        await executeQuery(
          'INSERT INTO password_resets (email, token, expires_at, created_at) VALUES (?, ?, ?, ?)',
          [email, resetToken, expiresAt, new Date()]
        );

        // Envoyer l'email de reset
        try {
          const { sendPasswordResetEmail } = await import('./_lib/email.js');
          await sendPasswordResetEmail(email, resetToken);
        } catch (emailError) {
          console.error('Email sending failed:', emailError);
        }

        return res.json({ message: 'Email de réinitialisation envoyé' });
      } catch (dbError) {
        console.error('Forgot password database error:', dbError);

        if (shouldUseFallback(dbError)) {
          return res.status(503).json({
            error: 'Service temporairement indisponible',
            code: 'DATABASE_TIMEOUT',
            retry: true
          });
        }

        const errorResponse = handleDbError(dbError, 'demande de réinitialisation');
        return res.status(500).json(errorResponse);
      }
    }

    if (route === 'reset-password' && req.method === 'POST') {
      try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
          return res.status(400).json({ error: 'Token et nouveau mot de passe requis' });
        }

        if (newPassword.length < 6) {
          return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
        }

        // Vérifier le token JWT
        const decoded = jwt.verify(token, JWT_SECRET);
        
        if (decoded.purpose !== 'password_reset') {
          return res.status(400).json({ error: 'Token invalide' });
        }

        // Vérifier que le token existe en base et n'est pas expiré
        const [resetRecord] = await executeQuery(
          'SELECT email, expires_at FROM password_resets WHERE token = ? AND expires_at > CURRENT_TIMESTAMP',
          [token]
        );

        if (resetRecord.length === 0) {
          return res.status(400).json({ error: 'Token invalide ou expiré' });
        }

        const email = resetRecord[0].email;

        // Hasher le nouveau mot de passe
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Mettre à jour le mot de passe
        await executeQuery(
          'UPDATE users SET password = ?, "updatedAt" = ? WHERE email = ?',
          [hashedPassword, new Date(), email]
        );

        // Supprimer le token de reset utilisé
        await executeQuery('DELETE FROM password_resets WHERE token = ?', [token]);

        return res.json({ message: 'Mot de passe réinitialisé avec succès' });
      } catch (error) {
        console.error('Reset password error:', error);
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
          return res.status(400).json({ error: 'Token invalide ou expiré' });
        }

        if (shouldUseFallback(error)) {
          return res.status(503).json({
            error: 'Service temporairement indisponible',
            code: 'DATABASE_TIMEOUT',
            retry: true
          });
        }

        const errorResponse = handleDbError(error, 'réinitialisation du mot de passe');
        return res.status(500).json(errorResponse);
      }
    }

    console.log('No matching route found for auth:', route, 'Method:', req.method);
    return res.status(404).json({ error: 'Route non trouvée' });
  } catch (connectionError) {
    console.error('Database connection error:', connectionError);

    if (shouldUseFallback(connectionError)) {
      return res.status(503).json({
        error: 'Service temporairement indisponible',
        code: 'DATABASE_TIMEOUT',
        retry: true
      });
    }

    const errorResponse = handleDbError(connectionError, 'connexion à la base de données');
    return res.status(500).json(errorResponse);
  }
};
