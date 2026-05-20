import React, { useState, useEffect, useRef, useCallback } from 'react';
import PageHeader from '../../shared/PageHeader';
import Card from '../../shared/Card';
import LoadingSpinner from '../../shared/LoadingSpinner';
import toast from 'react-hot-toast';
import { chatAPI } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { MessageSquare } from '../../shared/Icons';

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

export default function ChatPage({ setChatCount }) {
  const { user } = useAuth();
  const [convs, setConvs] = useState([]);
  const [selected, setSelected] = useState(null); // { _id, name, profilePicture }
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showWindow, setShowWindow] = useState(false);
  const endRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    loadConvs();
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); clearInterval(pollRef.current); };
  }, []);

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

  const loadConvs = async () => {
    setLoadingConvs(true);
    try {
      const data = await chatAPI.getConversations();
      // data is now a plain array: [{ _id, name, profilePicture, lastMessage }, ...]
      const arr = Array.isArray(data) ? data : [];
      setConvs(arr);
      if (setChatCount) setChatCount(0); // unread count not tracked server-side currently
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
      // data is plain array of message objects
      const arr = Array.isArray(data) ? data : [];
      setMessages(arr);
    } catch (err) {
      if (!silent) toast.error('Failed to load messages');
    } finally {
      if (!silent) setLoadingMsgs(false);
    }
  };

  const openConv = (conv) => {
    setSelected(conv);
    setMessages([]);
    loadMsgs(conv._id);
    if (isMobile) setShowWindow(true);
  };

  const back = () => {
    setShowWindow(false);
    setSelected(null);
    clearInterval(pollRef.current);
  };

  const send = async (e) => {
    e.preventDefault();
    if (!input.trim() || !selected) return;
    const text = input.trim();
    setInput('');
    setSending(true);

    // Optimistic
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
      setConvs(prev => prev.map(c => c._id === selected._id ? { ...c, lastMessage: text } : c));
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

  // ─── Layout ──────────────────────────────────────────────────────────────────
  const sidebarStyle = {
    width: isMobile ? '100%' : '300px',
    borderRight: isMobile ? 'none' : '1px solid var(--border-color)',
    display: isMobile ? (showWindow ? 'none' : 'flex') : 'flex',
    flexDirection: 'column',
    background: 'var(--bg-surface)',
    flexShrink: 0,
  };

  const windowStyle = {
    flex: 1,
    display: isMobile ? (showWindow ? 'flex' : 'none') : 'flex',
    flexDirection: 'column',
    minWidth: 0,
  };

  return (
    <div>
      <PageHeader title="Messages" subtitle="Chat with your connections" />

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', height: isMobile ? 'calc(100vh - 200px)' : '600px', minHeight: '400px' }}>

          {/* ── Conversations sidebar ── */}
          <div style={sidebarStyle}>
            <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
              <input
                className="form-input"
                placeholder="Search conversations…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ marginBottom: 0 }}
              />
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loadingConvs ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading…</div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  {convs.length === 0 ? 'No conversations yet.\nAccept a request to start chatting.' : 'No results'}
                </div>
              ) : (
                filtered.map(conv => (
                  <div
                    key={conv._id}
                    onClick={() => openConv(conv)}
                    style={{
                      padding: '0.875rem 1rem',
                      borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      background: selected?._id === conv._id ? 'var(--primary-bg)' : 'transparent',
                      display: 'flex', gap: '0.75rem', alignItems: 'center',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (selected?._id !== conv._id) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { if (selected?._id !== conv._id) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Avatar src={conv.profilePicture} name={conv.name} size={44} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conv.name}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conv.lastMessage || 'Start chatting…'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Messages window ── */}
          <div style={windowStyle}>
            {!selected ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                    <MessageSquare size={48} color="#D1D5DB" />
                  </div>
                  <p>Select a conversation to start messaging</p>
                </div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg-surface)' }}>
                  {isMobile && (
                    <button onClick={back} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', marginRight: '4px' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                      </svg>
                    </button>
                  )}
                  <Avatar src={selected.profilePicture} name={selected.name} size={38} />
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selected.name}</span>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {loadingMsgs ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Loading…</div>
                  ) : messages.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No messages yet. Say hi!</div>
                  ) : (
                    messages.map((msg) => {
                      const senderId = getSenderId(msg);
                      const isOwn = senderId === user?._id?.toString();
                      return (
                        <div key={msg._id} style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
                          <div style={{
                            maxWidth: '70%', padding: '0.625rem 0.875rem',
                            borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                            background: isOwn ? 'var(--primary)' : 'var(--bg-hover)',
                            color: isOwn ? '#000' : 'var(--text-primary)',
                            fontSize: '0.9rem', lineHeight: 1.5,
                          }}>
                            <div>{msg.content}</div>
                            <div style={{ fontSize: '0.7rem', opacity: 0.65, textAlign: 'right', marginTop: '2px' }}>
                              {msgTime(msg.createdAt)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={endRef} />
                </div>

                {/* Input */}
                <form onSubmit={send} style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '0.5rem', background: 'var(--bg-surface)' }}>
                  <input
                    className="form-input"
                    placeholder="Type a message…"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    disabled={sending}
                    style={{ flex: 1, marginBottom: 0 }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); } }}
                  />
                  <button type="submit" className="btn btn-primary" disabled={sending || !input.trim()} style={{ flexShrink: 0 }}>
                    {sending ? '…' : 'Send'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
