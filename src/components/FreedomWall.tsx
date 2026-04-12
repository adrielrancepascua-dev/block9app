"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/SupabaseAuthContext';
import { supabase } from '@/utils/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2 } from 'lucide-react';

interface ProfileData {
  name: string;
  custom_bg_url?: string;
}

interface Post {
  id: string;
  content: string;
  author_id: string;
  author_name: string;
  is_anonymous: boolean;
  created_at: string;
  x_pos: number;
  y_pos: number;
  profiles?: ProfileData;
}

const PASTEL_COLORS = [
  '#fdfd96', // yellow
  '#ffb7b2', // pink/red
  '#ffdac1', // peach
  '#e2f0cb', // light green
  '#b5ead7', // green
  '#c7ceea', // blue/purple
];

export default function FreedomWall() {
  const { user, profile } = useAuth();

  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const getPostColor = (post: Post) => {
    if (post.profiles?.custom_bg_url && post.profiles.custom_bg_url.startsWith('#')) {
      return post.profiles.custom_bg_url;
    }
    let charCode = 0;
    if (post.id) charCode = post.id.charCodeAt(post.id.length - 1) || 0;
    return PASTEL_COLORS[charCode % PASTEL_COLORS.length];
  };

  const fetchPosts = async () => {
    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('freedom_wall')
        .select('*, profiles(name, custom_bg_url)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (fetchError) throw fetchError;

      const postsWithAuthors = (data || []).map((post: any) => ({
        ...post,
        author_name: post.profiles?.name || 'Unknown User',
        x_pos: post.x_pos ?? Math.floor(Math.random() * 70) + 10,
        y_pos: post.y_pos ?? Math.floor(Math.random() * 70) + 10,
      }));

      setPosts(postsWithAuthors);
    } catch (err: any) {
      console.error('Error fetching posts:', err?.message || err);
      setError('Failed to load posts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPosts();
    }
  }, [user]);

  useEffect(() => {
    const channel = supabase
      .channel('freedom_wall_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'freedom_wall' },
        async (payload: any) => {
          const newPost = payload.new;

          // avoid duplicates
          setPosts((prev) => {
            if (prev.some((p) => p.id === newPost.id)) return prev;
            return prev;
          });

          const { data: profileData } = await supabase
            .from('profiles')
            .select('name, custom_bg_url')
            .eq('user_id', newPost.author_id)
            .single();

          const postWithAuthor: Post = {
            id: newPost.id,
            content: newPost.content,
            author_id: newPost.author_id,
            author_name: profileData?.name || 'Unknown User',
            is_anonymous: newPost.is_anonymous,
            created_at: newPost.created_at,
            x_pos: newPost.x_pos ?? Math.floor(Math.random() * 70) + 10,
            y_pos: newPost.y_pos ?? Math.floor(Math.random() * 70) + 10,
            profiles: profileData ? { name: profileData.name, custom_bg_url: profileData.custom_bg_url } : undefined,
          };

          setPosts((prev) => {
            if (prev.some((p) => p.id === newPost.id)) return prev;
            return [postWithAuthor, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'freedom_wall' },
        (payload: any) => {
          setPosts((prev) => prev.filter((p) => p.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim() || !user) {
      setError('Please write something before posting');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const currentContent = content.trim();
    const currentIsAnonymous = isAnonymous;
    const createdAt = new Date().toISOString();
    const optimisticId = `temp-${Date.now()}`;
    const randomX = Math.floor(Math.random() * 70) + 10;
    const randomY = Math.floor(Math.random() * 70) + 10;

    try {
      const optimisticPost: Post = {
        id: optimisticId,
        content: currentContent,
        author_id: user.id,
        author_name: profile?.name || 'Loading...',
        is_anonymous: currentIsAnonymous,
        created_at: createdAt,
        x_pos: randomX,
        y_pos: randomY,
        profiles: { name: profile?.name || 'Loading...', custom_bg_url: profile?.custom_bg_url || undefined },
      };

      // optimistic update
      setPosts((prev) => [optimisticPost, ...prev]);
      setContent('');
      setIsAnonymous(false);

      const { data, error: insertError } = await supabase
        .from('freedom_wall')
        .insert({
          content: currentContent,
          author_id: user.id,
          is_anonymous: currentIsAnonymous,
          created_at: createdAt,
          x_pos: randomX,
          y_pos: randomY,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (data) {
        // replace optimistic id with real id
        setPosts((prev) => prev.map((post) => (post.id === optimisticId ? { ...post, id: data.id } : post)));
      }
    } catch (err: any) {
      console.error('Error posting:', err?.message || err);
      setError('Failed to post. Please try again.');
      setPosts((prev) => prev.filter((post) => post.id !== optimisticId));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (postId: string) => {
    if (profile?.role !== 'admin') return;
    try {
      const { error: deleteError } = await supabase.from('freedom_wall').delete().eq('id', postId);
      if (deleteError) throw deleteError;
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setSelectedPost(null);
    } catch (err: any) {
      console.error('Error deleting:', err?.message || err);
      alert('Failed to delete post: ' + (err?.message || err));
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      {user && (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 shrink-0 relative z-20 overflow-visible">
          <form onSubmit={handleSubmit} className="p-6">
            <div className="mb-4">
              <label htmlFor="content" className="sr-only">What's on your mind?</label>
              <textarea
                id="content"
                rows={3}
                placeholder="What's on your mind? (Pin it to the board!)"
                className="w-full resize-none rounded-lg border border-slate-300 p-3 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <label className="flex items-center space-x-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  disabled={isSubmitting}
                />
                <span>Post anonymously</span>
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-400"
              >
                {isSubmitting ? 'Pinning...' : 'Pin Note'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="relative flex-1 overflow-hidden rounded-xl border-8 border-amber-800/80 bg-[url('https://www.transparenttextures.com/patterns/cork-board.png')] bg-[#d4a88c] shadow-inner mb-8 min-h-[400px]">
        <div className="absolute inset-0 overflow-auto">
          <div className="relative w-[200%] h-[150%] md:w-full md:h-full">
            {posts.map((post) => {
              let rotateDeg = 0;
              if (post.id) rotateDeg = (post.id.charCodeAt(0) % 10) - 5;
              return (
                <motion.div
                  layoutId={`post-${post.id}`}
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                  className="absolute w-32 h-32 cursor-pointer shadow-md hover:shadow-xl transition-shadow p-3 flex flex-col group overflow-hidden"
                  style={{
                    top: `${post.y_pos}%`,
                    left: `${post.x_pos}%`,
                    backgroundColor: getPostColor(post),
                    transform: `rotate(${rotateDeg}deg)`,
                  }}
                  whileHover={{ scale: 1.05, zIndex: 10 }}
                >
                  <div className="absolute top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-red-500 shadow-sm border border-red-700 z-10">
                    <div className="w-1 h-1 bg-white/60 rounded-full absolute top-[2px] left-[2px]" />
                  </div>

                  <p className="text-black/80 mt-3 text-xs line-clamp-4 font-mono font-medium leading-snug whitespace-pre-wrap">
                    {post.content}
                  </p>

                  <div className="absolute bottom-0 left-0 right-0 bg-black/5 p-1 text-[10px] text-black/60 truncate font-semibold border-t border-black/10">
                    {post.is_anonymous ? 'Anonymous' : post.author_name}
                  </div>
                </motion.div>
              );
            })}

            {posts.length === 0 && !isLoading && (
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="text-center rounded-xl bg-white/70 backdrop-blur-sm p-6 text-amber-900 border border-white/60 shadow-sm">
                  <p className="text-lg font-bold">The whiteboard is empty</p>
                  <p className="text-sm mt-1">Be the first to pin a note!</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedPost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 cursor-pointer"
              onClick={() => setSelectedPost(null)}
            />

            <motion.div
              layoutId={`post-${selectedPost.id}`}
              className="relative w-full max-w-md p-8 shadow-2xl z-10 flex flex-col max-h-[80vh] overflow-y-auto rounded-sm"
              style={{
                backgroundColor: getPostColor(selectedPost),
                minHeight: '300px',
              }}
            >
              <div className="absolute top-4 right-4 flex gap-2">
                {profile?.role === 'admin' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(selectedPost.id);
                    }}
                    className="p-2 text-black/60 hover:text-red-600 hover:bg-black/10 rounded-full transition-colors focus:outline-none"
                    title="Delete Post"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
                <button
                  onClick={() => setSelectedPost(null)}
                  className="p-2 text-black/60 hover:text-black hover:bg-black/10 rounded-full transition-colors focus:outline-none"
                  title="Close"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 mt-6">
                <p className="text-black/90 text-lg sm:text-xl font-medium font-mono whitespace-pre-wrap leading-relaxed">
                  {selectedPost.content}
                </p>
              </div>

              <div className="mt-8 border-t border-black/20 pt-4 flex justify-between items-center text-sm text-black/70">
                <span className="font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-black/20" />
                  {selectedPost.is_anonymous ? 'Anonymous' : selectedPost.author_name}
                </span>
                <span className="opacity-80">
                  {new Date(selectedPost.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
