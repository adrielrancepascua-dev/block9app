"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabase';

// Define the Profile type matching your database schema
export interface Profile {
  user_id: string;
  name: string;
  role: 'student' | 'admin' | 'teacher';
  custom_bg_url: string | null;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profil
  const router = useRouter();e | null>(null);
  const [loading, setLoading] = useState(true);

  const createProfile = async (userId: string, email: string): Promise<Profile | null> => {
    try {
      const newProfile: Profile = {
        user_id: userId,
        name: email.split('@')[0], // Use email prefix as fallback name
        role: 'student',
        custom_bg_url: null,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('profiles')
        .insert([newProfile])
        .select()
        .single();

      if (error) {
        console.error('Error creating profile:', error.message);
        return null;
      }

      console.log('Auto-created profile for user:', userId);
      return data as Profile;
    } catch (err) {
      console.error('Unexpected error creating profile:', err);
      return null;
    }
  };

  const fetchProfile = async (userId: string, email?: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
        
      if (error) {
        // Profile doesn't exist - trigger auto-creation
        if (email) {
          console.warn('Profile not found for user, attempting auto-creation...');
          const createdProfile = await createProfile(userId, email);
          setProfile(createdProfile);
        } else {
          console.error('Error fetching profile:', error.message);
          setProfile(null);
        }
      } else {
        setProfile(data as Profile);
      }
    } catch (err) {
      console.error('Unexpected error fetching profile:', err);
      setProfile(null);
    } finally {
      // CRITICAL: Always clear loading state, whether fetch succeeds or fails
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error.message);
        }

        const currentUser = session?.user ?? null;
        setUser(currentUser);
        
        if (currentUser) {
          // fetchProfile has its own finally block that sets loading to false
          await fetchProfile(currentUser.id, currentUser.email);
        } else {
          // CRITICAL: No session found - must explicitly clear loading
          setLoading(false);
        }
      } catch (err) {
        console.error('Initialization auth error:', err);
        setLoading(false); // Ensure loading stops on error too
      }
    };

    initializeAuth();

    // 2. Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          const currentUser = session?.user ?? null;
          setUser(currentUser);
          
          if (currentUser) {
            // fetchProfile has its own finally block that sets loading to false
            await fetchProfile(currentUser.id, currentUser.email);
          } else {
            // CRITICAL: User logged out or no session - clear everything and stop loading
            setProfile(null);
            setLoading(false);
          }
        } catch (err) {
          console.error('Auth change handling error:', err);
          setLoading(false); // Ensure loading stops on error too
        }
      }
    );

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Error signing in:', error.message);
      throw error; // Throw error so the UI can catch and display it
    }
  };

  const signOut = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error.message);
      setLoading(false);
    } else {
      setUser(null);
      setProfile(null);
      setLoading(false);
      router.push('/login'); // Force redirect
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
