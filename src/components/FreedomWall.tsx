"use client";

import React, { useEffect, useRef, useState } from 'react';
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

const CLEAR_VOTE_TARGET = 35;

export default function FreedomWall() {
  const { user, profile } = useAuth();

  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDraggingPin, setIsDraggingPin] = useState(false);
  const [draftPosition, setDraftPosition] = useState({ x: 50, y: 50 });
  const [clearVoteCount, setClearVoteCount] = useState(0);
  const [hasVotedToClear, setHasVotedToClear] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [isVoteFeatureAvailable, setIsVoteFeatureAvailable] = useState(true);
  const boardRef = useRef<HTMLDivElement | null>(null);

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const clearProgress = Math.min(100, (clearVoteCount / CLEAR_VOTE_TARGET) * 100);

  const getPostColor = (post: Post) => {
    if (post.profiles?.custom_bg_url && post.profiles.custom_bg_url.startsWith('#')) {
      return post.profiles.custom_bg_url;
    }
    let charCode = 0;
    if (post.id) charCode = post.id.charCodeAt(post.id.length - 1) || 0;
    return PASTEL_COLORS[charCode % PASTEL_COLORS.length];
  };

  const fetchClearVotes = async () => {
    if (!user) {
      setClearVoteCount(0);
      setHasVotedToClear(false);
      setVoteError(null);
      return;
    }

    try {
      const [{ count, error: countError }, { data: myVotes, error: myVotesError }] = await Promise.all([
        supabase.from('freedom_wall_clear_votes').select('user_id', { count: 'exact', head: true }),
        supabase.from('freedom_wall_clear_votes').select('user_id').eq('user_id', user.id).limit(1),
      ]);

      if (countError?.code === '42P01' || myVotesError?.code === '42P01') {
        setIsVoteFeatureAvailable(false);
        return;
      }

      if (countError) throw countError;
      if (myVotesError) throw myVotesError;

      setIsVoteFeatureAvailable(true);
      setClearVoteCount(count ?? 0);
      setHasVotedToClear((myVotes?.length ?? 0) > 0);
      setVoteError(null);
    } catch (err: any) {
      console.error('Error fetching clear votes:', err?.message || err);
      setVoteError('Vote status is temporarily unavailable.');
    }
  };

  const fetchPosts = async (showSpinner = true) => {
    try {
      if (showSpinner) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
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
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      setIsLoading(true);
      fetchPosts(true);
      fetchClearVotes();
      return;
    }

    setPosts([]);
    setClearVoteCount(0);
    setHasVotedToClear(false);
    setVoteError(null);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const refresh = () => {
      fetchPosts(false);
      fetchClearVotes();
    };

    const intervalId = setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const voteChannel = supabase
      .channel('freedom_wall_clear_vote_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'freedom_wall_clear_votes' },
        () => {
          fetchClearVotes();
        }
      )
      .subscribe();

    return () => {
      voteChannel.unsubscribe();
    };
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
    const placedX = Math.round(clamp(draftPosition.x, 5, 92));
    const placedY = Math.round(clamp(draftPosition.y, 5, 92));

    try {
      const optimisticPost: Post = {
        id: optimisticId,
        content: currentContent,
        author_id: user.id,
        author_name: profile?.name || 'Loading...',
        is_anonymous: currentIsAnonymous,
        created_at: createdAt,
        x_pos: placedX,
        y_pos: placedY,
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
          x_pos: placedX,
          y_pos: placedY,
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

  const updateDraftPositionFromPoint = (clientX: number, clientY: number) => {
    const board = boardRef.current;
    if (!board) return;

    const rect = board.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;

    setDraftPosition({
      x: clamp(x, 5, 92),
      y: clamp(y, 5, 92),
    });
  };

  const handleBoardPlacement = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-note-card="true"]') || target.closest('[data-draft-pin="true"]')) return;
    updateDraftPositionFromPoint(e.clientX, e.clientY);
  };

  const handleDraftPinPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPin(true);
    updateDraftPositionFromPoint(e.clientX, e.clientY);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      updateDraftPositionFromPoint(moveEvent.clientX, moveEvent.clientY);
    };

    const handlePointerUp = () => {
      setIsDraggingPin(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
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

  const handleVoteToClear = async () => {
    if (!user || hasVotedToClear || !isVoteFeatureAvailable) return;

    setIsVoting(true);
    setVoteError(null);
    try {
      const { error: voteInsertError } = await supabase
        .from('freedom_wall_clear_votes')
        .upsert({ user_id: user.id, created_at: new Date().toISOString() }, { onConflict: 'user_id' });

      if (voteInsertError?.code === '42P01') {
        setIsVoteFeatureAvailable(false);
        setVoteError('Clear-vote feature is not set up in the database yet.');
        return;
      }

      if (voteInsertError) throw voteInsertError;
      await fetchClearVotes();
    } catch (err: any) {
      console.error('Error voting to clear wall:', err?.message || err);
      setVoteError('Could not submit your vote right now.');
    } finally {
      setIsVoting(false);
    }
  };

  const handleAdminClearAll = async () => {
    if (profile?.role !== 'admin') return;

    const confirmed = confirm('Clear all Freedom Wall notes now? This cannot be undone.');
    if (!confirmed) return;

    setIsClearing(true);
    setVoteError(null);
    try {
      const postIds = posts.map((post) => post.id);
      if (postIds.length > 0) {
        const { error: deletePostsError } = await supabase
          .from('freedom_wall')
          .delete()
          .in('id', postIds);

        if (deletePostsError) throw deletePostsError;
      }

      const { error: resetVotesError } = await supabase
        .from('freedom_wall_clear_votes')
        .delete()
        .not('user_id', 'is', null);

      if (resetVotesError && resetVotesError.code !== '42P01') {
        throw resetVotesError;
      }

      setPosts([]);
      setClearVoteCount(0);
      setHasVotedToClear(false);
      setSelectedPost(null);
    } catch (err: any) {
      console.error('Error clearing Freedom Wall:', err?.message || err);
      setVoteError('Could not clear the wall right now.');
    } finally {
      setIsClearing(false);
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
    <div className="flex min-h-[calc(100dvh-11rem)] flex-col">
      {user && (
        <div className="relative z-20 mb-4 shrink-0 overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:mb-6 sm:rounded-2xl">
          <form onSubmit={handleSubmit} className="p-4 sm:p-6">
            {isRefreshing && (
              <p className="mb-3 text-xs text-slate-500">Refreshing posts...</p>
            )}
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

            {isVoteFeatureAvailable && (
              <div className="mb-4 rounded-lg border border-slate-300 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-900/60">
                <div className="flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <span>Clear Wall Vote Progress</span>
                  <span>{clearVoteCount}/{CLEAR_VOTE_TARGET}</span>
                </div>

                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${clearProgress}%` }}
                  />
                </div>

                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Vote progress is shown for transparency. Admins can clear the wall anytime.
                </p>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleVoteToClear}
                    disabled={isVoting || hasVotedToClear || !user}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {hasVotedToClear ? 'You already voted' : isVoting ? 'Submitting vote...' : 'Vote to clear wall'}
                  </button>

                  {profile?.role === 'admin' && (
                    <button
                      type="button"
                      onClick={handleAdminClearAll}
                      disabled={isClearing || posts.length === 0}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isClearing ? 'Clearing wall...' : 'Admin clear all now'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {!isVoteFeatureAvailable && (
              <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                Vote-to-clear is not configured in the database yet.
              </div>
            )}

            {voteError && <p className="mb-4 text-sm text-red-500">{voteError}</p>}

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

              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-400"
                >
                  {isSubmitting ? 'Pinning...' : 'Pin Note'}
                </button>
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Drag the blue pin on the board to place your next note.
            </p>
          </form>
        </div>
      )}

      <div className="relative mb-4 min-h-[460px] flex-1 overflow-hidden rounded-xl border-4 border-amber-800/80 bg-[url('https://www.transparenttextures.com/patterns/cork-board.png')] bg-[#d4a88c] shadow-inner sm:mb-8 sm:min-h-[400px] sm:border-8">
        <div className="absolute inset-0 overflow-auto">
          <div
            ref={boardRef}
            className="relative h-full w-full"
            onClick={handleBoardPlacement}
          >
            {user && (
              <button
                type="button"
                data-draft-pin="true"
                onPointerDown={handleDraftPinPointerDown}
                aria-label="Drag to place the next note"
                title="Drag to place the next note"
                className={`absolute z-20 h-5 w-5 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full border-2 border-white bg-blue-500 shadow-lg ring-4 ring-blue-500/20 transition ${isDraggingPin ? 'cursor-grabbing scale-110' : 'cursor-grab'}`}
                style={{
                  top: `${draftPosition.y}%`,
                  left: `${draftPosition.x}%`,
                }}
              />
            )}

            {posts.map((post) => {
              let rotateDeg = 0;
              if (post.id) rotateDeg = (post.id.charCodeAt(0) % 10) - 5;
              return (
                <motion.div
                  layoutId={`post-${post.id}`}
                  key={post.id}
                  data-note-card="true"
                  onClick={() => {
                    setSelectedPost(post);
                  }}
                  className="group absolute flex h-28 w-28 cursor-pointer flex-col overflow-hidden p-2.5 shadow-md transition-shadow hover:shadow-xl sm:h-32 sm:w-32 sm:p-3"
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
