import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            display_name: displayName,
          },
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast({
            variant: 'destructive',
            title: t('common.error'),
            description: t('auth.userExists'),
          });
        } else {
          toast({
            variant: 'destructive',
            title: t('common.error'),
            description: error.message,
          });
        }
        return { error };
      }

      toast({
        title: t('common.success'),
        description: t('auth.signupSuccess'),
      });

      return { data, error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { error };
    }
  }, [toast, t]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          variant: 'destructive',
          title: t('common.error'),
          description: t('auth.invalidCredentials'),
        });
        return { error };
      }

      toast({
        title: t('common.success'),
        description: t('auth.loginSuccess'),
      });

      return { data, error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { error };
    }
  }, [toast, t]);

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        toast({
          variant: 'destructive',
          title: t('common.error'),
          description: error.message,
        });
        return { error };
      }

      toast({
        title: t('common.success'),
        description: t('auth.logoutSuccess'),
      });

      return { error: null };
    } catch (error) {
      console.error('Sign out error:', error);
      return { error };
    }
  }, [toast, t]);

  return {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    isAuthenticated: !!session,
  };
}