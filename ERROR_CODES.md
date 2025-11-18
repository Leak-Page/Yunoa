# Codes d'erreur - Système de streaming

Ce document décrit tous les codes d'erreur utilisés dans l'application et leurs solutions.

## Codes d'erreur vidéo

### VIDEO_NOT_FOUND (404)
**Description :** La vidéo demandée n'existe pas ou a été supprimée.

**Causes possibles :**
- L'ID de la vidéo est incorrect
- La vidéo a été supprimée de la base de données
- URL malformée

**Solutions :**
- Vérifier l'URL de la vidéo
- Retourner à l'accueil pour découvrir d'autres contenus
- Contacter le support si le problème persiste

---

### ACCESS_DENIED (403)
**Description :** L'utilisateur n'a pas l'autorisation de regarder ce contenu.

**Causes possibles :**
- Utilisateur non connecté
- Abonnement expiré ou insuffisant
- Contenu géo-bloqué
- Permissions insuffisantes

**Solutions :**
- Vérifier que l'utilisateur est connecté
- Vérifier la validité de l'abonnement
- Contacter le support pour obtenir les permissions nécessaires

---

### CONNECTION_TIMEOUT (408)
**Description :** Le serveur met trop de temps à répondre.

**Causes possibles :**
- Connexion internet lente
- Surcharge du serveur
- Problème de réseau temporaire
- Proxy ou firewall bloquant la connexion

**Solutions :**
- Vérifier la connexion internet
- Réessayer dans quelques instants
- Changer de réseau si possible
- Redémarrer le routeur

---

### NETWORK_ERROR (NET)
**Description :** Impossible de se connecter aux serveurs.

**Causes possibles :**
- Pas de connexion internet
- DNS défaillant
- Serveurs indisponibles
- Problème de routage réseau

**Solutions :**
- Vérifier la connexion internet
- Essayer un autre réseau
- Vider le cache DNS
- Contacter le fournisseur d'accès

---

### RATE_LIMITED (429)
**Description :** Trop de requêtes effectuées en peu de temps.

**Causes possibles :**
- Utilisation abusive de l'API
- Rechargement excessif de la page
- Bot ou script automatisé
- Limite de débit dépassée

**Solutions :**
- Attendre quelques minutes avant de réessayer
- Éviter de recharger la page plusieurs fois
- Arrêter les scripts automatisés
- Contacter le support si nécessaire

---

### TOO_MANY_STREAMS (STREAM)
**Description :** Limite de streams simultanés atteinte.

**Causes possibles :**
- Plusieurs appareils utilisent le même compte
- Sessions non fermées correctement
- Partage de compte non autorisé
- Limite d'abonnement atteinte

**Solutions :**
- Fermer les lecteurs vidéo sur d'autres appareils
- Attendre que les autres sessions se terminent
- Mettre à niveau l'abonnement
- Contacter le support pour augmenter la limite

---

### UNKNOWN_ERROR (500)
**Description :** Erreur technique inattendue.

**Causes possibles :**
- Bug dans le code
- Problème de base de données
- Erreur serveur interne
- Corruption de données

**Solutions :**
- Actualiser la page
- Vider le cache du navigateur
- Essayer plus tard
- Contacter le support technique

---

## Codes d'erreur API supplémentaires

### VIDEO_SOURCE_404
**Description :** La source vidéo n'est plus disponible.
**Solution :** Vérifier que l'URL source est toujours valide.

### VIDEO_SOURCE_403
**Description :** Accès refusé à la source vidéo.
**Solution :** Vérifier les permissions sur la source externe.

### STREAM_ERROR
**Description :** Erreur pendant le streaming.
**Solution :** Redémarrer la lecture, vérifier la connexion.

### EXTERNAL_ACCESS_BLOCKED
**Description :** Tentative d'accès depuis un domaine non autorisé.
**Solution :** Utiliser uniquement les domaines autorisés.

### INVALID_TOKEN
**Description :** Token d'authentification invalide.
**Solution :** Se reconnecter à l'application.

### KEY_ACCESS_DENIED
**Description :** Accès refusé aux clés de déchiffrement DRM.
**Solution :** Vérifier l'authentification et les permissions.

### INVALID_AUTH
**Description :** Échec de l'authentification.
**Solution :** Se reconnecter avec des identifiants valides.

### PROXY_ERROR
**Description :** Erreur générale du proxy vidéo.
**Solution :** Réessayer, contacter le support si persistant.

---

## Diagnostic et débogage

### Informations à collecter en cas d'erreur

1. **Code d'erreur exact**
2. **Heure de l'erreur**
3. **URL de la vidéo**
4. **Navigateur et version**
5. **Type de connexion internet**
6. **Messages d'erreur dans la console**

### Outils de diagnostic

- Console développeur (F12)
- Test de connexion internet
- Vérification des cookies et du cache
- Test sur différents navigateurs

### Contact support

En cas de problème persistant, contacter le support avec :
- Le code d'erreur
- Les étapes pour reproduire le problème
- Les informations système
- Captures d'écran si applicable

---

## Prévention des erreurs

### Bonnes pratiques utilisateur

- Utiliser une connexion internet stable
- Maintenir le navigateur à jour
- Éviter les rechargements excessifs
- Fermer les onglets inutilisés
- Respecter les limites d'utilisation

### Bonnes pratiques développeur

- Validation des entrées utilisateur
- Gestion appropriée des timeouts
- Retry avec backoff exponentiel
- Logs détaillés pour le débogage
- Tests de charge réguliers
- Monitoring en temps réel

---

*Document mis à jour le : $(date)*
*Version : 1.0*