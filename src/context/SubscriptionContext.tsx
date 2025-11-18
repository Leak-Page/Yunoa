import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isExpired as isExpiredUtil } from '@/utils/dateUtils';

interface AuthUser {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  role: 'membre' | 'admin';
  createdAt: string;
}

interface SubscriptionContextType {
  isSubscribed: boolean;
  subscriptionTier: string | null;
  subscriptionEnd: string | null;
  loading: boolean;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

const useCurrentUser = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const isLoadingRef = useRef(false);
  
  const loadUser = useCallback(async () => {
    if (isLoadingRef.current) return;
    
    try {
      isLoadingRef.current = true;
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (authUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();
        
        if (profile) {
          setUser({
            id: authUser.id,
            email: authUser.email || '',
            username: profile.username || '',
            avatar: profile.avatar || '',
            role: (profile.role as 'membre' | 'admin') || 'membre',
            createdAt: profile.created_at || new Date().toISOString()
          });
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      // En production, on peut logger vers un service comme Sentry
      // console.error('Error loading user profile:', error);
      setUser(null);
    } finally {
      setUserLoading(false);
      isLoadingRef.current = false;
    }
  }, []);
  
  useEffect(() => {
    loadUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        loadUser();
      }
    });
    
    return () => subscription.unsubscribe();
  }, [loadUser]);
  
  return { user, userLoading };
};

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  const { user, userLoading } = useCurrentUser();
  const isCheckingRef = useRef(false);
  const lastCheckedUserRef = useRef<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkSubscription = useCallback(async (force = false) => {
    if (isCheckingRef.current && !force) return;

    if (!user) {
      setIsSubscribed(false);
      setSubscriptionTier(null);
      setSubscriptionEnd(null);
      setLoading(false);
      lastCheckedUserRef.current = null;
      return;
    }

    if (!force && lastCheckedUserRef.current === user.id) {
      setLoading(false);
      return;
    }

    try {
      isCheckingRef.current = true;
      setLoading(true);
      
      const { data: subData, error: subError } = await supabase
        .from('subscribers')
        .select('subscribed, subscription_tier, subscription_end, email')
        .eq('user_id', user.id)
        .maybeSingle();

      let finalSubData = subData;

      if (!subData && !subError) {
        const { data: subDataByEmail, error: subErrorByEmail } = await supabase
          .from('subscribers')
          .select('subscribed, subscription_tier, subscription_end, email')
          .eq('email', user.email)
          .maybeSingle();
        
        if (subDataByEmail) {
          await supabase
            .from('subscribers')
            .update({ user_id: user.id })
            .eq('email', user.email);
          
          finalSubData = subDataByEmail;
        }
      }

      if (finalSubData) {
        const isActive = finalSubData.subscribed && 
          (!finalSubData.subscription_end || !isExpiredUtil(finalSubData.subscription_end));
        
        setIsSubscribed(isActive);
        setSubscriptionTier(finalSubData.subscription_tier);
        setSubscriptionEnd(finalSubData.subscription_end);
      } else {
        setIsSubscribed(false);
        setSubscriptionTier(null);
        setSubscriptionEnd(null);
      }

      lastCheckedUserRef.current = user.id;
      
    } catch (error) {
      // En production, logger vers un service d'erreurs
      // console.error('Subscription check error:', error);
      setIsSubscribed(false);
      setSubscriptionTier(null);
      setSubscriptionEnd(null);
    } finally {
      setLoading(false);
      isCheckingRef.current = false;
    }
  }, [user]);

  const refreshSubscription = useCallback(async () => {
    await checkSubscription(true);
  }, [checkSubscription]);

  useEffect(() => {
    if (userLoading) {
      setLoading(true);
      return;
    }

    if (lastCheckedUserRef.current && lastCheckedUserRef.current !== user?.id) {
      setIsSubscribed(false);
      setSubscriptionTier(null);
      setSubscriptionEnd(null);
      lastCheckedUserRef.current = null;
    }

    checkSubscription();
  }, [user?.id, userLoading, checkSubscription]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (user && isSubscribed) {
      intervalRef.current = setInterval(() => {
        checkSubscription(true);
      }, 15 * 60 * 1000); // 15 minutes en production
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user, isSubscribed, checkSubscription]);

  useEffect(() => {
    const handleSubscriptionUpdate = () => {
      refreshSubscription();
    };

    window.addEventListener('subscription-updated', handleSubscriptionUpdate);
    return () => {
      window.removeEventListener('subscription-updated', handleSubscriptionUpdate);
    };
  }, [refreshSubscription]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      isCheckingRef.current = false;
      lastCheckedUserRef.current = null;
    };
  }, []);

  const value = {
    isSubscribed,
    subscriptionTier,
    subscriptionEnd,
    loading: loading || userLoading,
    refreshSubscription,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};