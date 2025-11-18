import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const FRANCE_TIMEZONE = 'Europe/Paris';

// Convertit une date en heure française
export const toFranceTime = (date: Date | string): Date => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return toZonedTime(dateObj, FRANCE_TIMEZONE);
};

// Convertit une date française en UTC
export const fromFranceTime = (date: Date): Date => {
  return fromZonedTime(date, FRANCE_TIMEZONE);
};

// Formate une date en français
export const formatFrenchDate = (date: Date | string, pattern: string = 'dd MMMM yyyy'): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const frenchDate = toFranceTime(dateObj);
  return format(frenchDate, pattern, { locale: fr });
};

// Calcule les jours restants jusqu'à expiration (en prenant en compte le fuseau français)
export const getDaysUntilExpiry = (endDate: Date | string): number => {
  const endDateObj = typeof endDate === 'string' ? new Date(endDate) : endDate;
  const endDateFrance = toFranceTime(endDateObj);
  const nowFrance = toFranceTime(new Date());
  
  // On compare les dates à minuit pour éviter les problèmes d'heures
  const endOfDay = new Date(endDateFrance);
  endOfDay.setHours(23, 59, 59, 999);
  
  const startOfToday = new Date(nowFrance);
  startOfToday.setHours(0, 0, 0, 0);
  
  const diffTime = endOfDay.getTime() - startOfToday.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

// Vérifie si une date est expirée (en tenant compte du fuseau français)
export const isExpired = (endDate: Date | string): boolean => {
  const days = getDaysUntilExpiry(endDate);
  return days < 0;
};

// Vérifie si une date expire bientôt
export const isExpiringSoon = (endDate: Date | string, notifyBeforeDays: number = 2): boolean => {
  const days = getDaysUntilExpiry(endDate);
  return days >= 0 && days <= notifyBeforeDays;
};

// Formate une date relative (il y a X jours, etc.)
export const formatTimeAgo = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const frenchDate = toFranceTime(dateObj);
  const now = toFranceTime(new Date());
  
  const diffTime = now.getTime() - frenchDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffTime / (1000 * 60));
  
  if (diffDays > 0) {
    return `il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
  } else if (diffHours > 0) {
    return `il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
  } else if (diffMinutes > 0) {
    return `il y a ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
  } else {
    return 'à l\'instant';
  }
};