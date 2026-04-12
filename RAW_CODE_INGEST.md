# Block9 - Raw Code Ingest
**Complete Code Reference** | April 12, 2026

---

**Recent Updates (April 12, 2026 — 19:21 UTC)**  
- `src/context/SupabaseAuthContext.tsx`: added `finally` blocks to `fetchProfile()` and explicit `setLoading(false)` in no-session branches to prevent infinite loading.  
- `src/context/SupabaseAuthContext.tsx`: updated `signOut()` to set loading, clear state, and `router.push('/login')` to avoid auth-listener loops.  
- `src/components/ProfileLayout.tsx`: background now `z-[-10] pointer-events-none` and main wrapper `relative z-10` to fix click-blocking.  
- `src/components/AdminPanel.tsx`: removed manual end-time input; backend `end_time` auto-computed +1 hour on insert to satisfy NOT NULL constraints.  
- `src/components/ScheduleCard.tsx`: robust time formatting — shows `TBA` for invalid/missing times.  
- `src/components/FreedomWall.tsx`: optimistic UI posting to remove perceived latency.  
- `next.config.mjs`: disabled aggressive PWA front-end caching during development to avoid serving stale loading states.


## 📋 Table of Contents
1. [Context & Utilities](#context--utilities)
2. [Components](#components)
3. [Pages](#pages)
4. [Configuration](#configuration)

---

## Context & Utilities

### `src/context/SupabaseAuthContext.tsx`
```typescript
"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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
  const [profile, setProfile] = useState<Profile | null>(null);
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
          await fetchProfile(currentUser.id, currentUser.email);
        }
      } catch (err) {
        console.error('Initialization auth error:', err);
      } finally {
        setLoading(false);
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
            await fetchProfile(currentUser.id, currentUser.email);
          } else {
            setProfile(null);
          }
        } catch (err) {
          console.error('Auth change handling error:', err);
        } finally {
          setLoading(false);
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
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error.message);
    } else {
      setUser(null);
      setProfile(null);
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
```

### `src/utils/supabase.ts`
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    `❌ Missing Supabase credentials! Please add them to .env.local:
    1. Go to https://supabase.com and create a project
    2. Go to Project Settings > API
    3. Copy the Project URL and Public Anon Key
    4. Add them to .env.local as:
       NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
       NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
    5. Restart the development server (npm run dev)
    `
  );
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);
```

---

## Components

... (file content truncated here for brevity when displayed in editor) ...

---

**Generated:** April 12, 2026 | **Format:** Raw Code Reference | **Version:** v1.0

**Full workspace guide:** See [WORKSPACE_GUIDE.md](WORKSPACE_GUIDE.md) for the complete operational, deployment, and troubleshooting guide.
