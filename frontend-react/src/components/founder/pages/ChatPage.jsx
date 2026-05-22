import React, { useState, useEffect, useRef, useCallback } from 'react';
import PageHeader from '../../shared/PageHeader';
import Card from '../../shared/Card';
import LoadingSpinner from '../../shared/LoadingSpinner';
import toast from 'react-hot-toast';
import { chatAPI } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { MessageSquare } from '../../shared/Icons';

// ─── helpers ──────────────────────────────────────────────────────────────────

const msgTime = (d) => {
  const date = new Date(d);
  const now = new Date();
  const diff = Math.floor((now - date) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const Avatar = ({ src, name, size = 40 }) => {
  const fb = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=84CC16&color=fff&size=${size * 2}`;
  const url = src ? (src.startsWith('http') ? src : `${window.location.origin}${src}`) : fb;
  return (
    <img src={url} alt={name} onError={e => { e.target.src = fb; }}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ChatPage({ setChatCount, openUserId }) {
  const { user } = useAuth();
  const [convs, setConvs] = useState([]);
  const [selected, setSelected] = useState(null); // { _id, name, profilePicture }
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showWindow, setShowWindow] = useState(false);
  const endRef = useRef(null);
  const pollRef = useRef(null);
  const inputRef = useRef(null);

  // Detect mobile
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Load conversations on mount
  useEffect(() => {
    loadConvs();
    return () => clearInterval(pollRef.current);
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Poll messages every 5s when a conversation is open
  useEffect(() => {
    clearInterval(pollRef.current);
    if (selected) {
      pollRef.current = setInterval(() => loadMsgs(selected._id, true), 5000);
    }
    return () => clearInterval(pollRef.current);
  }, [selected]);

  // Auto-open a specific user's conversation when openUserId is provided
  useEffect(() => {
    if (!openUserId || convs.length === 0) return;
    const conv = convs.find(c => c._id?.toString() === openUserId?.toString());
    if (conv) {
      openConv(conv);
    } else {
      // User not in conversations yet — create a placeholder and open
      // This handles the case where they haven't messaged yet but are connected
      const placeholder = { _id: openUserId, name: 'New Conversation', profilePicture: '' };
      openConv(placeholder);
    }
  }, [openUserId, convs]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadConvs = async () => {
    setLoadingConvs(true);
    try {
      const data = await chatAPI.getConversations();
      const arr = Array.isArray(data) ? data : [];
      setConvs(arr);
      if (setChatCount) setChatCount(0);
    } catch (err) {
      console.error('Convs error:', err);
      toast.error('Failed to load conversations');
    } finally {
      setLoadingConvs(false);
    }
  };

  const loadMsgs = async (partnerId, silent = false) => {
    if (!silent) setLoadingMsgs(true);
    try {
      const data = await chatAPI.getMessages(partnerId);
      const arr = Array.isArray(data) ? data : [];
      setMessages(arr);
    } catch (err) {
      if (!silent) toast.error('Failed to load messages');
    } finally {
      if (!silent) setLoadingMsgs(false);
    }
  };

  const openConv = useCallback((conv) => {
    setSelected(conv);
    setMessages([]);
    loadMsgs(conv._id);
    if (window.innerWidth < 768) setShowWindow(true);
    // Focus input after opening
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const back = () => {
    setShowWindow(false);
    setSelected(null);
    clearInterval(pollRef.current);
    // Clear the userId from hash so navigating back works cleanly
    const hash = window.location.hash.split('?')[0];
    window.history.replaceState(null, '', hash);
  };

  const send = async (e) => {
    e.preventDefault();
    if (!input.trim() || !selected) return;
    const text = input.trim();
    setInput('');
    setSending(true);

    // Optimistic update
    const optimistic = {
      _id: `opt-${Date.now()}`,
      senderId: { _id: user._id },
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      await chatAPI.sendMessage(selected._id, text);
      // Refresh to get server version
      setTimeout(() => loadMsgs(selected._id, true), 300);
      // Update last message in conv list
      setConvs(prev => {
        const exists = prev.find(c => c._id?.toString() === selected._id?.toString());
        if (exists) {
          return prev.map(c => c._id?.toString() === selected._id?.toString() ? { ...c, lastMessage: text } : c);
        }
        // Add new conversation to list
        return [{ ...selected, lastMessage: text }, ...prev];
      });
    } catch (err) {
      toast.error(err.message || 'Failed to send');
      setInput(text);
      setMessages(prev => prev.filter(m => m._id !== optimistic._id));
    } finally {
      setSending(false);
    }
  };

  const filtered = convs.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()));

  const getSenderId = (msg) => {
    if (!msg.senderId) return '';
    if (typeof msg.senderId === 'object') return msg.senderId._id?.toString() || '';
    return msg.senderId.toString();
  };

  // ─── Sidebar (conversation list) ─────────────────────────────────────────────
  const renderSidebar = () => (
    <div style={{
      width: isMobile ? '100%' : 300,
      borderRight: isMobile ? 'none' : '1px solid var(--border-color)',
      display: isMobile ? (showWindow ? 'none' : 'flex') : 'flex',
      flexDirection: 'column',
      background: 'var(--bg-surface, white)',
      flexShrink: 0,
      height: '100%',
    }}>
      {/* Search */}
      <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
        <input
          className="form-input"
          placeholder="Search conversations…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginBottom: 0 }}
        />
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loadingConvs ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
            {convs.length === 0
              ? 'No conversations yet.\nAccept a connection request to start chatting.'
              : 'No results'}
          </div>
        ) : (
          filtered.map(conv => {
            const isActive = selected?._id?.toString() === conv._id?.toString();
            return (
              <div
                key={conv._id}
                onClick={() => openConv(conv)}
                style={{
                  padding: '0.875rem 1rem',
                  borderBottom: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  background: isActive ? '#F0FDF4' : 'transparent',
                  display: 'flex', gap: '0.75rem', alignItems: 'center',
                  transition: 'background 0.15s',
                  borderLeft: isActive ? '3px solid #84CC16' : '3px solid transparent',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover, #F9FAFB)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <Avatar src={conv.profilePicture} name={conv.name} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conv.name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                    {conv.lastMessage || 'Start chatting…'}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  // ─── Message window ───────────────────────────────────────────────────────────
  const renderWindow = () => (
    <div style={{
      flex: 1,
      display: isMobile ? (showWindow ? 'flex' : 'none') : 'flex',
      flexDirection: 'column',
      minWidth: 0,
      height: '100%',
      // On mobile, take full screen
      ...(isMobile && showWindow ? {
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: 'var(--bg, #F8FAFC)',
      } : {}),
    }}>
      {!selected ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <MessageSquare size={48} color="#D1D5DB" />
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Select a conversation to start messaging
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* ── Chat header ── */}
          <div style={{
            padding: '0.75rem 1rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            background: 'white',
            flexShrink: 0,
            // On mobile, add safe area for status bar
            paddingTop: isMobile ? 'max(0.75rem, env(safe-area-inset-top))' : '0.75rem',
          }}>
            {/* Back button — always visible on mobile */}
            {isMobile && (
              <button
                onClick={back}
                aria-label="Back to conversations"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#374151', padding: '6px', marginLeft: -4,
                  display: 'flex', alignItems: 'center', borderRadius: 8,
                  flexShrink: 0,
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            <Avatar src={selected.profilePicture} name={selected.name} size={38} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selected.name}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#6B7280' }}>
                {selected.role ? selected.role.charAt(0).toUpperCase() + selected.role.slice(1) : 'Connected'}
              </div>
            </div>
          </div>

          {/* ── Messages ── */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.625rem',
            background: '#F8FAFC',
          }}>
            {loadingMsgs ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                <LoadingSpinner message="Loading messages…" />
              </div>
            ) : messages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👋</div>
                <p style={{ fontSize: '0.9rem' }}>No messages yet. Say hi to <strong>{selected.name}</strong>!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const senderId = getSenderId(msg);
                const isOwn = senderId === user?._id?.toString();
                return (
                  <div key={msg._id} style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: '0.5rem' }}>
                    {/* Avatar for other person */}
                    {!isOwn && (
                      <Avatar src={selected.profilePicture} name={selected.name} size={28} />
                    )}
                    <div style={{
                      maxWidth: isMobile ? '80%' : '65%',
                      padding: '0.625rem 0.875rem',
                      borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      background: isOwn ? '#84CC16' : 'white',
                      color: isOwn ? '#0F172A' : '#111827',
                      fontSize: '0.9rem',
                      lineHeight: 1.5,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                      wordBreak: 'break-word',
                    }}>
                      <div>{msg.content}</div>
                      <div style={{ fontSize: '0.68rem', opacity: 0.6, textAlign: 'right', marginTop: '3px' }}>
                        {msgTime(msg.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={endRef} />
          </div>

          {/* ── Input bar ── */}
          <form
            onSubmit={send}
            style={{
              padding: '0.75rem 1rem',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              gap: '0.5rem',
              background: 'white',
              flexShrink: 0,
              alignItems: 'center',
              // Safe area for iPhone home bar
              paddingBottom: isMobile ? 'max(0.75rem, env(safe-area-inset-bottom))' : '0.75rem',
            }}
          >
            <input
              ref={inputRef}
              className="form-input"
              placeholder="Type a message…"
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={sending}
              style={{ flex: 1, marginBottom: 0, borderRadius: 24, padding: '0.625rem 1rem' }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); } }}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send message"
              style={{
                width: 42, height: 42, borderRadius: '50%',
                background: input.trim() ? '#84CC16' : '#E5E7EB',
                border: 'none', cursor: input.trim() ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'background 0.15s',
              }}
            >
              {sending ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? '#0F172A' : '#9CA3AF'} strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" strokeDasharray="31.4" strokeDashoffset="10" style={{ animation: 'spin 1s linear infinite' }} />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? '#0F172A' : '#9CA3AF'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </form>
        </>
      )}
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Hide page header on mobile when chat window is open */}
      {!(isMobile && showWindow) && (
        <PageHeader title="Messages" subtitle="Chat with your connections" />
      )}

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          display: 'flex',
          height: isMobile ? 'calc(100dvh - 140px)' : '600px',
          minHeight: isMobile ? 400 : 500,
          position: 'relative',
        }}>
          {renderSidebar()}
          {renderWindow()}
        </div>
      </Card>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
