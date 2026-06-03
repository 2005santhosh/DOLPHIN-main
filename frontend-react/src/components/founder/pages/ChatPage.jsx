import React, { useState, useEffect, useRef, useCallback } from 'react';
import PageHeader from '../../shared/PageHeader';
import Card from '../../shared/Card';
import LoadingSpinner from '../../shared/LoadingSpinner';
import toast from 'react-hot-toast';
import { chatAPI } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { MessageSquare } from '../../shared/Icons';
import VerifiedBadge from '../../shared/VerifiedBadge';

function isPaidVerified(u) {
  return u?.isVerified === true && u?.verifiedSource === 'payment' && !!u?.verifiedUntil && new Date(u.verifiedUntil) > new Date();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format message timestamp — short for today, date for older */
const msgTime = (d) => {
  const date = new Date(d);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  if (date.toDateString() === now.toDateString())
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/** Full timestamp for date separators */
const dayLabel = (d) => {
  const date = new Date(d);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
};

const Avatar = ({ src, name, size = 40, online = false }) => {
  const fb = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=84CC16&color=fff&size=${size * 2}`;
  const url = src ? (src.startsWith('http') ? src : `${window.location.origin}${src}`) : fb;
  return (
    <div style={{ position: 'relative', flexShrink: 0, width: size, height: size }}>
      <img src={url} alt={name} onError={e => { e.target.src = fb; }}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
      {online && (
        <span style={{
          position: 'absolute', bottom: 1, right: 1,
          width: size > 36 ? 10 : 8, height: size > 36 ? 10 : 8,
          borderRadius: '50%', background: '#22C55E',
          border: '2px solid white',
        }} />
      )}
    </div>
  );
};

/** Group consecutive messages from the same sender */
function groupMessages(messages) {
  const groups = [];
  let i = 0;
  while (i < messages.length) {
    const msg = messages[i];
    const senderId = typeof msg.senderId === 'object' ? msg.senderId?._id?.toString() : msg.senderId?.toString();
    const group = { senderId, messages: [msg] };
    let j = i + 1;
    while (j < messages.length) {
      const next = messages[j];
      const nextSenderId = typeof next.senderId === 'object' ? next.senderId?._id?.toString() : next.senderId?.toString();
      // Group if same sender and within 2 minutes
      if (nextSenderId === senderId && new Date(next.createdAt) - new Date(messages[j - 1].createdAt) < 120000) {
        group.messages.push(next);
        j++;
      } else break;
    }
    groups.push(group);
    i = j;
  }
  return groups;
}

/** Insert date separators between message groups */
function withDateSeparators(groups) {
  const result = [];
  let lastDay = null;
  for (const group of groups) {
    const day = new Date(group.messages[0].createdAt).toDateString();
    if (day !== lastDay) {
      result.push({ type: 'separator', label: dayLabel(group.messages[0].createdAt), key: `sep-${day}` });
      lastDay = day;
    }
    result.push({ type: 'group', ...group });
  }
  return result;
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ChatPage({ setChatCount, openUserId }) {
  const { user } = useAuth();
  const [convs, setConvs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showWindow, setShowWindow] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true); // track if user is at bottom

  const endRef = useRef(null);
  const pollRef = useRef(null);
  const textareaRef = useRef(null);
  const messagesRef = useRef(null);
  const isAtBottomRef = useRef(true); // ref version for use inside callbacks
  const openUserIdRef = useRef(openUserId);
  openUserIdRef.current = openUserId;

  // ── Resize detection ────────────────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Load conversations on mount ─────────────────────────────────────────────
  useEffect(() => {
    loadConvs();
    return () => clearInterval(pollRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-scroll to bottom — only when user is already near bottom ──────────
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    if (isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // ── Scroll handler — track whether user is near bottom ─────────────────────
  const handleMessagesScroll = () => {
    const el = messagesRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distFromBottom < 80;
    isAtBottomRef.current = atBottom;
    setIsAtBottom(atBottom);
  };

  const scrollToBottom = () => {
    const el = messagesRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setIsAtBottom(true);
    isAtBottomRef.current = true;
  };

  // ── Poll messages every 4s when a conversation is open ─────────────────────
  useEffect(() => {
    clearInterval(pollRef.current);
    if (selected) {
      pollRef.current = setInterval(() => loadMsgs(selected._id, true), 4000);
    }
    return () => clearInterval(pollRef.current);
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-resize textarea ────────────────────────────────────────────────────
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, [input]);

  // ── Auto-open conversation when openUserId is provided ──────────────────────
  useEffect(() => {
    if (!openUserId) return;
    // Wait for conversations to load, then open
    if (loadingConvs) return;
    const conv = convs.find(c => c._id?.toString() === openUserId?.toString());
    if (conv) {
      openConv(conv);
    } else {
      // Not in conversations yet — fetch their profile to get name/picture
      chatAPI.getUserProfile(openUserId)
        .then(profile => {
          openConv({
            _id: profile._id || openUserId,
            name: profile.name || 'User',
            profilePicture: profile.profilePicture || '',
            role: profile.role || '',
          });
        })
        .catch(() => {
          // Fallback if profile fetch fails
          openConv({ _id: openUserId, name: 'User', profilePicture: '', role: '' });
        });
    }
  }, [openUserId, loadingConvs]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Data fetching ───────────────────────────────────────────────────────────
  const loadConvs = async () => {
    setLoadingConvs(true);
    try {
      const data = await chatAPI.getConversations();
      const arr = Array.isArray(data) ? data : [];
      setConvs(arr);
      if (setChatCount) setChatCount(0);
    } catch (err) {
      console.error('Convs error:', err);
    } finally {
      setLoadingConvs(false);
    }
  };

  const loadMsgs = async (partnerId, silent = false) => {
    if (!silent) setLoadingMsgs(true);
    try {
      const data = await chatAPI.getMessages(partnerId);
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      if (!silent) toast.error('Failed to load messages');
    } finally {
      if (!silent) setLoadingMsgs(false);
    }
  };

  const openConv = useCallback((conv) => {
    setSelected(conv);
    setMessages([]);
    setIsAtBottom(true);
    isAtBottomRef.current = true;
    loadMsgs(conv._id);
    if (window.innerWidth < 768) setShowWindow(true);
    setTimeout(() => textareaRef.current?.focus(), 150);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const back = () => {
    setShowWindow(false);
    setSelected(null);
    setMessages([]);
    clearInterval(pollRef.current);
    const hash = window.location.hash.split('?')[0];
    window.history.replaceState(null, '', hash);
  };

  // ── Send message ────────────────────────────────────────────────────────────
  const send = async () => {
    if (!input.trim() || !selected || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Optimistic update
    const optimistic = {
      _id: `opt-${Date.now()}`,
      senderId: { _id: user._id },
      content: text,
      createdAt: new Date().toISOString(),
      optimistic: true,
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      await chatAPI.sendMessage(selected._id, text);
      setTimeout(() => loadMsgs(selected._id, true), 200);
      setConvs(prev => {
        const exists = prev.find(c => c._id?.toString() === selected._id?.toString());
        if (exists) {
          return [
            { ...exists, lastMessage: text, updatedAt: new Date().toISOString() },
            ...prev.filter(c => c._id?.toString() !== selected._id?.toString()),
          ];
        }
        return [{ ...selected, lastMessage: text, updatedAt: new Date().toISOString() }, ...prev];
      });
    } catch (err) {
      toast.error(err.message || 'Failed to send');
      setInput(text);
      setMessages(prev => prev.filter(m => m._id !== optimistic._id));
    } finally {
      setSending(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e) => {
    // On mobile, never intercept Enter — let the keyboard handle it naturally
    // On desktop, Enter sends; Shift+Enter inserts newline
    if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
      e.preventDefault();
      send();
    }
  };

  const filtered = convs.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()));

  const getSenderId = (msg) => {
    if (!msg.senderId) return '';
    if (typeof msg.senderId === 'object') return msg.senderId._id?.toString() || '';
    return msg.senderId.toString();
  };

  // ─── Sidebar ─────────────────────────────────────────────────────────────────
  const renderSidebar = () => (
    <div style={{
      width: isMobile ? '100%' : 300,
      borderRight: isMobile ? 'none' : '1px solid #E5E7EB',
      display: isMobile ? (showWindow ? 'none' : 'flex') : 'flex',
      flexDirection: 'column',
      background: 'white',
      flexShrink: 0,
      height: '100%',
    }}>
      {/* Header */}
      <div style={{ padding: '1rem', borderBottom: '1px solid #F3F4F6', background: 'white' }}>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Messages</h3>
        <div style={{ position: 'relative' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '0.5rem 0.75rem 0.5rem 2rem',
              border: '1px solid #E5E7EB', borderRadius: 20,
              fontSize: '1rem', /* min 16px prevents iOS Safari auto-zoom */
              outline: 'none', background: '#F9FAFB',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Conversation list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loadingConvs ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#9CA3AF', fontSize: '0.875rem' }}>
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '2rem 1.5rem', textAlign: 'center', color: '#9CA3AF', fontSize: '0.875rem', lineHeight: 1.6 }}>
            {convs.length === 0
              ? <>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💬</div>
                  No conversations yet.<br />Accept a connection to start chatting.
                </>
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
                  cursor: 'pointer',
                  background: isActive ? '#F0FDF4' : 'transparent',
                  display: 'flex', gap: '0.75rem', alignItems: 'center',
                  borderLeft: `3px solid ${isActive ? '#84CC16' : 'transparent'}`,
                  transition: 'background 0.12s',
                  borderBottom: '1px solid #F9FAFB',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#F9FAFB'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <Avatar src={conv.profilePicture} name={conv.name} size={46} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', overflow: 'hidden', maxWidth: '65%' }}>
                      <span style={{ fontWeight: 600, color: '#111827', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conv.name}
                      </span>
                      {isPaidVerified(conv) && <VerifiedBadge size={13} style={{ flexShrink: 0 }} />}
                    </div>
                    {conv.updatedAt && (
                      <span style={{ fontSize: '0.75rem', color: '#9CA3AF', flexShrink: 0 }}>
                        {msgTime(conv.updatedAt)}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
  const renderWindow = () => {
    const groups = withDateSeparators(groupMessages(messages));

    return (
      <div style={{
        flex: 1,
        display: isMobile ? (showWindow ? 'flex' : 'none') : 'flex',
        flexDirection: 'column',
        minWidth: 0,
        height: '100%',
        background: '#F0F2F5',
        ...(isMobile && showWindow ? {
          position: 'fixed', inset: 0, zIndex: 2000,
        } : {}),
      }}>
        {!selected ? (
          /* Empty state */
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F2F5' }}>
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}>
                <MessageSquare size={36} color="#84CC16" />
              </div>
              <h3 style={{ margin: '0 0 0.5rem', color: '#374151', fontSize: '1rem' }}>Your Messages</h3>
              <p style={{ color: '#9CA3AF', fontSize: '0.875rem', margin: 0 }}>
                Select a conversation to start messaging
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative' }}>
            {/* ── Chat header ── */}
            <div style={{
              padding: '0.75rem 1rem',
              background: 'white',
              borderBottom: '1px solid #E5E7EB',
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              flexShrink: 0,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              zIndex: 10,
              paddingTop: isMobile ? 'max(0.75rem, env(safe-area-inset-top))' : '0.75rem',
            }}>
              {isMobile && (
                <button onClick={back} aria-label="Back"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#374151', padding: '4px 8px 4px 0', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <Avatar src={selected.profilePicture} name={selected.name} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', overflow: 'hidden' }}>
                  <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selected.name}
                  </div>
                  {isPaidVerified(selected) && <VerifiedBadge size={14} style={{ flexShrink: 0 }} />}
                </div>
                {selected.role && (
                  <div style={{ fontSize: '0.8rem', color: '#6B7280', textTransform: 'capitalize' }}>
                    {selected.role}
                  </div>
                )}
              </div>
            </div>

            {/* ── Messages area ── */}
            <div
              ref={messagesRef}
              onScroll={handleMessagesScroll}
              style={{
                flex: 1, overflowY: 'auto',
                padding: '1rem 0.75rem',
                display: 'flex', flexDirection: 'column', gap: 0,
                background: '#F0F2F5',
                backgroundImage: 'radial-gradient(circle, #E5E7EB 1px, transparent 1px)',
                backgroundSize: '20px 20px',
                position: 'relative',
              }}
            >
              {loadingMsgs ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                  <LoadingSpinner message="Loading messages…" />
                </div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                  <div style={{
                    display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
                    padding: '1rem 1.5rem',
                    background: 'rgba(255,255,255,0.9)', borderRadius: 16,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  }}>
                    <span style={{ fontSize: '1.75rem' }}>👋</span>
                    <span style={{ fontSize: '0.9rem', color: '#374151', fontWeight: 600 }}>
                      Say hi to {selected.name}!
                    </span>
                    <span style={{ fontSize: '0.82rem', color: '#9CA3AF' }}>Be the first to send a message</span>
                  </div>
                </div>
              ) : (
                groups.map((item, idx) => {
                  if (item.type === 'separator') {
                    return (
                      <div key={item.key} style={{ display: 'flex', justifyContent: 'center', margin: '0.75rem 0' }}>
                        <span style={{
                          background: 'rgba(255,255,255,0.9)', color: '#6B7280',
                          fontSize: '0.78rem', fontWeight: 600,
                          padding: '4px 14px', borderRadius: 9999,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        }}>
                          {item.label}
                        </span>
                      </div>
                    );
                  }

                  const isOwn = item.senderId === user?._id?.toString();
                  const isLast = idx === groups.length - 1 || groups[idx + 1]?.type === 'separator';

                  return (
                    <div key={`group-${idx}`} style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isOwn ? 'flex-end' : 'flex-start',
                      marginBottom: '0.25rem',
                    }}>
                      {/* Show avatar for other person on first message of group */}
                      {!isOwn && (
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.4rem', marginBottom: '0.25rem' }}>
                          <Avatar src={selected.profilePicture} name={selected.name} size={26} />
                          <span style={{ fontSize: '0.8rem', color: '#6B7280', fontWeight: 600 }}>
                            {selected.name}
                          </span>
                        </div>
                      )}

                      {/* Message bubbles in this group */}
                      <div style={{
                        display: 'flex', flexDirection: 'column',
                        alignItems: isOwn ? 'flex-end' : 'flex-start',
                        gap: '2px',
                        paddingLeft: !isOwn ? 28 : 0,
                      }}>
                        {item.messages.map((msg, mIdx) => {
                          const isFirst = mIdx === 0;
                          const isLastInGroup = mIdx === item.messages.length - 1;
                          return (
                            <div key={msg._id} style={{
                              display: 'flex', alignItems: 'flex-end', gap: '4px',
                              flexDirection: isOwn ? 'row-reverse' : 'row',
                            }}>
                              <div style={{
                                maxWidth: isMobile ? '82%' : '62%',
                                padding: '0.55rem 0.875rem 0.4rem',
                                borderRadius: isOwn
                                  ? `16px 16px ${isLastInGroup ? '4px' : '16px'} 16px`
                                  : `16px 16px 16px ${isLastInGroup ? '4px' : '16px'}`,
                                background: isOwn ? '#84CC16' : 'white',
                                color: isOwn ? '#0F172A' : '#111827',
                                fontSize: '0.925rem',
                                lineHeight: 1.55,
                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                wordBreak: 'break-word',
                                overflowWrap: 'break-word',
                                position: 'relative',
                                opacity: msg.optimistic ? 0.75 : 1,
                                transition: 'opacity 0.2s',
                              }}>
                                {/* Message text */}
                                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>

                                {/* Timestamp row — only on last message in group */}
                                {isLastInGroup && (
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'flex-end',
                                    gap: '4px',
                                    marginTop: '4px',
                                    lineHeight: 1,
                                  }}>
                                    <span style={{
                                      fontSize: '0.75rem',
                                      color: isOwn ? 'rgba(15,23,42,0.55)' : '#9CA3AF',
                                      whiteSpace: 'nowrap',
                                    }}>
                                      {msgTime(msg.createdAt)}
                                    </span>
                                    {isOwn && (
                                      <span style={{
                                        fontSize: '0.72rem',
                                        fontWeight: 600,
                                        color: msg.optimistic ? 'rgba(15,23,42,0.3)' : 'rgba(15,23,42,0.55)',
                                        whiteSpace: 'nowrap',
                                      }}>
                                        {msg.optimistic ? 'Sending…' : 'Sent'}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={endRef} style={{ height: 4 }} />
            </div>

            {/* ── Scroll-to-bottom button ── */}
            {!isAtBottom && (
              <button
                onClick={scrollToBottom}
                aria-label="Scroll to latest messages"
                style={{
                  position: 'absolute',
                  bottom: isMobile ? 80 : 76,
                  right: 16,
                  zIndex: 20,
                  width: 38, height: 38,
                  borderRadius: '50%',
                  background: 'white',
                  border: '1px solid #E5E7EB',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            )}

            {/* ── Input bar ── */}
            <div style={{
              padding: '0.625rem 0.75rem',
              background: '#F0F2F5',
              borderTop: '1px solid #E5E7EB',
              display: 'flex', alignItems: 'flex-end', gap: '0.5rem',
              flexShrink: 0,
              paddingBottom: isMobile ? 'max(0.625rem, env(safe-area-inset-bottom))' : '0.625rem',
            }}>              {/* Text input */}
              <div style={{
                flex: 1, background: 'white', borderRadius: 24,
                border: '1px solid #E5E7EB',
                display: 'flex', alignItems: 'flex-end',
                padding: '0.5rem 0.875rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                minHeight: 42,
                minWidth: 0,
                overflow: 'hidden',
              }}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message…"
                  rows={1}
                  disabled={sending}
                  style={{
                    width: '100%',
                    flex: 1, border: 'none', outline: 'none', resize: 'none',
                    fontSize: '1rem', /* 16px prevents iOS Safari auto-zoom */
                    lineHeight: 1.5, background: 'transparent',
                    color: '#111827', fontFamily: 'inherit',
                    maxHeight: 120, overflowY: 'auto',
                    padding: 0, margin: 0,
                    display: 'block',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                  }}
                />
              </div>

              {/* Send button */}
              <button
                onClick={send}
                disabled={!input.trim() || sending}
                aria-label="Send"
                style={{
                  width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                  background: input.trim() ? '#84CC16' : '#E5E7EB',
                  border: 'none',
                  cursor: input.trim() ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s, transform 0.1s',
                  transform: input.trim() ? 'scale(1)' : 'scale(0.92)',
                  boxShadow: input.trim() ? '0 2px 8px rgba(132,204,22,0.35)' : 'none',
                }}
                onMouseDown={e => { if (input.trim()) e.currentTarget.style.transform = 'scale(0.92)'; }}
                onMouseUp={e => { if (input.trim()) e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke={input.trim() ? '#0F172A' : '#9CA3AF'}
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div>
      {!(isMobile && showWindow) && (
        <PageHeader title="Messages" subtitle="Chat with your connections" />
      )}

      <Card style={{ padding: 0, overflow: 'hidden', borderRadius: 12 }}>
        <div style={{
          display: 'flex',
          // Desktop: fixed comfortable height
          // Mobile: full remaining viewport after header + page header + bottom nav
          // Using dvh (dynamic viewport height) to handle mobile browser chrome correctly
          height: isMobile
            ? 'calc(100dvh - 60px - 56px - 60px - env(safe-area-inset-bottom, 0px))'
            : 640,
          minHeight: isMobile ? 360 : 520,
          position: 'relative',
        }}>
          {renderSidebar()}
          {renderWindow()}
        </div>
      </Card>

      <style>{`
        textarea::-webkit-scrollbar { width: 4px; }
        textarea::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 4px; }
        textarea::-webkit-scrollbar-thumb:hover { background: #9CA3AF; }

        /* Conversation list scrollbar */
        .chat-conv-list::-webkit-scrollbar { width: 4px; }
        .chat-conv-list::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 4px; }

        /* Messages area scrollbar */
        .chat-messages::-webkit-scrollbar { width: 5px; }
        .chat-messages::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 4px; }

        /* Prevent content jump on iOS when keyboard opens */
        @supports (height: 100dvh) {
          .chat-window-mobile {
            height: calc(100dvh - 60px - 56px - 60px - env(safe-area-inset-bottom, 0px));
          }
        }
      `}</style>
    </div>
  );
}
