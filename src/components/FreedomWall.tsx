"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/SupabaseAuthContext';
import { supabase } from '@/utils/supabase';

// --- Types ---

interface ProfileData {
  name: string;
}

interface Post {
  id: string;
  content: string;
  author_id: string;
  author_name: string;
  is_anonymous: boolean;
  created_at: string;
  profiles?: ProfileData;
}

// --- Component ---

export default function FreedomWall() {
  const { user, profile } = useAuth();
  
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch posts from Supabase with author names in a single query
  const fetchPosts = async () => {
    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('freedom_wall')
        .select('*, profiles(name)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;

      // Transform data to include author_name
      const postsWithAuthors = (data || []).map((post: any) => ({
        ...post,
        author_name: post.profiles?.name || 'Unknown User',
      }));

      setPosts(postsWithAuthors);
    } catch (err: any) {
      console.error('Error fetching posts:', err.message);
      setError('Failed to load posts');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchPosts();
  }, []);

  // Real-time subscription to new posts
  useEffect(() => {
    const channel = supabase
      .channel('freedom_wall_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'freedom_wall',
        },
        async (payload: any) => {
          const newPost = payload.new;
          
          // Fetch author profile for the new post
          const { data: profileData } = await supabase
            .from('profiles')
            .select('name')
            .eq('user_id', newPost.author_id)
            .single();

          const postWithAuthor: Post = {
            id: newPost.id,
            content: newPost.content,
            author_id: newPost.author_id,
            author_name: profileData?.name || 'Unknown User',
            is_anonymous: newPost.is_anonymous,
            created_at: newPost.created_at,
            profiles: profileData ? { name: profileData.name } : undefined,
          };

          // Add new post to the top of the list
          setPosts((prevPosts) => [postWithAuthor, ...prevPosts]);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim() || !user) {
      setError('Please write something before posting');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from('freedom_wall')
        .insert({
          content: content.trim(),
          author_id: user.id,
          is_anonymous: isAnonymous,
          created_at: new Date().toISOString(),
        });

      if (insertError) throw insertError;

      // Reset form
      setContent('');
      setIsAnonymous(false);
    } catch (err: any) {
      console.error('Error posting:', err.message);
      setError('Failed to post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete (admins only)
  const handleDelete = async (postId: string) => {
    if (profile?.role !== 'admin') return;

    try {
      const { error: deleteError } = await supabase
        .from('freedom_wall')
        .delete()
        .eq('id', postId);

      if (deleteError) throw deleteError;

      // Remove from local state
      setPosts((prevPosts) => prevPosts.filter((post) => post.id !== postId));
    } catch (err: any) {
      console.error('Error deleting post:', err.message);
      setError('Failed to delete post');
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 p-4">
      {/* Create Post Form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
      >
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
          What's on your mind?
        </h2>

        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        )}

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share your thoughts..."
          disabled={isSubmitting}
          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
          rows={4}
        />

        <div className="mt-4 flex items-center justify-between">
          <label className="flex cursor-pointer items-center space-x-3">
            <div className="relative">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                disabled={isSubmitting}
              />
              <div className="h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:bg-slate-700 dark:border-gray-600 dark:peer-focus:ring-blue-800"></div>
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Post Anonymously
            </span>
          </label>

          <button
            type="submit"
            disabled={!content.trim() || isSubmitting}
            className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </form>

      {/* Posts List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="py-8 text-center text-slate-500 dark:text-slate-400">
            Loading posts...
          </div>
        ) : posts.length === 0 ? (
          <p className="py-8 text-center text-slate-500 dark:text-slate-400">
            No posts yet. Be the first to share!
          </p>
        ) : (
          posts.map((post) => {
            const displayName = post.is_anonymous ? 'Anonymous Student' : post.author_name;
            const displayInitials = displayName
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);

            const publishedDate = new Date(post.created_at).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={post.id}
                className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800"
              >
                {/* Admin Delete Button */}
                {profile?.role === 'admin' && (
                  <button
                    onClick={() => handleDelete(post.id)}
                    className="absolute right-4 top-4 rounded-md p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                    aria-label="Delete post"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                )}

                <div className="flex items-start space-x-4">
                  {/* Avatar */}
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-blue-100 font-semibold text-blue-700 dark:border-slate-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {displayInitials}
                  </div>

                  {/* Post Content */}
                  <div className="flex-1 min-w-0 pr-8">
                    <div className="flex items-baseline space-x-2">
                      <h3 className="truncate font-semibold text-slate-900 dark:text-white">
                        {displayName}
                      </h3>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {publishedDate}
                      </span>
                    </div>

                    <p className="mt-2 whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                      {post.content}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
