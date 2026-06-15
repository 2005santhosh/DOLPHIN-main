/**
 * BubblesPage — Group chat rooms (like WhatsApp groups).
 * Shared across all three dashboards (founder, investor, provider).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { bubblesAPI, connectionsAPI } from '../../services/api';
import toast from 'react-hot-toast';
import PageHeader from './PageHeader';
import Card from './Card';
import LoadingSpinner from './LoadingSpinner';
import Modal from './Modal';
import VerifiedBadge from './VerifiedBadge';

function isPaidVerified(u) {
  return u?.isVerified === true && u?.verifiedSource === 'payment' && !!u?.verifiedUntil && new Date(u.verifiedUntil) > new Date();
}

const ts = (d) => {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const Avatar = ({ src, name, size = 40, online }) => {
  const fb = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'B')}&background=84CC16&color=fff&size=${size * 2}`;
  const url = src ? (src.startsWith('http') ? src : `${window.location.origin}${src}`) : fb;
  return (
    <div style={{ position: 'relative', flexShrink: 0, width: size, height: size }}>
      <img src={url} alt={name} onError={e => { e.target.src = fb; }}
        style={{ width: size, height: size, borderRadius: online !== undefined ? '50%' : 10, objectFit: 'cover', display: 'block' }} />
      {online && <span style={{ position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: '50%', background: '#22C55E', border: '2px solid white' }} />}
    </div>
  );
};

export default function BubblesPage() {
  const { user } = useAuth();
  const [bubbles, setBubbles]         = useState([]);
  const [selected, setSelected]       = useState(null);
  const [messages, setMessages]       = useState([]);
  const [loadingBubbles, setLB]       = useState(true);
  const [loadingMsgs, setLM]          = useState(false);
  const [input, setInput]             = useState('');
  const [sending, setSending]         = useState(false);
  const [isMobile, setIsMobile]       = useState(window.innerWidth < 768);
  const [showWindow, setShowWindow]   = useState(false);

  // Modals
  const [createOpen, setCreateOpen]   = useState(false);
  const [createName, setCreateName]   = useState('');
  const [createDesc, setCreateDesc]   = useState('');
  const [creating, setCreating]       = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editName, setEditName]         = useState('');
  const [editDesc, setEditDesc]         = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const [inviteOpen, setInviteOpen]   = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [connections, setConnections] = useState([]);
  const [inviting, setInviting]       = useState({});

  // 3-dot menu state
  const [menuOpen, setMenuOpen]       = useState(false);
  // Media upload state
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const mediaInputRef = useRef(null);

  const endRef    = useRef(null);
  const pollRef   = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => { loadBubbles(); }, []);

  useEffect(() => {
    clearInterval(pollRef.current);
    if (selected) {
      pollRef.current = setInterval(() => loadMessages(selected._id, true), 5000);
    }
    return () => clearInterval(pollRef.current);
  }, [selected?._id]); // eslint-disable-line

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Socket: listen for new bubble messages
  useEffect(() => {
    const sock = window._socket;
    if (!sock) return;
    const handler = ({ bubbleId, message }) => {
      if (selected?._id?.toString() === bubbleId?.toString()) {
        setMessages(prev => [...prev, message]);
      }
      setBubbles(prev => prev.map(b =>
        b._id?.toString() === bubbleId?.toString()
          ? { ...b, lastMessage: message.content, lastMessageAt: message.createdAt }
          : b
      ));
    };
    sock.on('bubbleMessage', handler);
    return () => sock.off('bubbleMessage', handler);
  }, [selected?._id]);

  const loadBubbles = async () => {
    setLB(true);
    try { setBubbles(await bubblesAPI.getMyBubbles()); }
    catch { toast.error('Failed to load Bubbles'); }
    finally { setLB(false); }
  };

  const loadMessages = async (id, silent = false) => {
    if (!silent) setLM(true);
    try {
      const data = await bubblesAPI.getBubble(id);
      setMessages(data.messages || []);
      if (!silent) setSelected(data);
    } catch { if (!silent) toast.error('Failed to load messages'); }
    finally { if (!silent) setLM(false); }
  };

  const openBubble = async (b) => {
    setSelected(b);
    setShowWindow(true);
    await loadMessages(b._id);
    setTimeout(() => inputRef.current?.focus(), 150);
  };

  const back = () => { setShowWindow(false); setSelected(null); setMessages([]); clearInterval(pollRef.current); };

  const send = async () => {
    if (!input.trim() || !selected || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    const opt = { _id: `opt-${Date.now()}`, senderId: { _id: user._id }, senderName: user.name, senderPicture: user.profilePicture || '', content: text, createdAt: new Date().toISOString(), _opt: true };
    setMessages(prev => [...prev, opt]);
    try {
      const msg = await bubblesAPI.sendMessage(selected._id, text);
      setMessages(prev => prev.map(m => m._id === opt._id ? { ...msg, senderName: user.name, senderPicture: user.profilePicture || '' } : m));
      setBubbles(prev => prev.map(b => b._id?.toString() === selected._id?.toString() ? { ...b, lastMessage: text, lastMessageAt: new Date().toISOString() } : b));
    } catch { setMessages(prev => prev.filter(m => m._id !== opt._id)); toast.error('Failed to send'); setInput(text); }
    finally { setSending(false); setTimeout(() => inputRef.current?.focus(), 50); }
  };

  const createBubble = async (e) => {
    e.preventDefault();
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const b = await bubblesAPI.createBubble(createName.trim(), createDesc.trim());
      setBubbles(prev => [b, ...prev]);
      setCreateOpen(false); setCreateName(''); setCreateDesc('');
      toast.success(`Bubble "${b.name}" created!`);
      openBubble(b);
    } catch (err) { toast.error(err.message || 'Failed'); }
    finally { setCreating(false); }
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await bubblesAPI.updateBubble(selected._id, { name: editName, description: editDesc });
      setSelected(prev => ({ ...prev, name: editName, description: editDesc }));
      setBubbles(prev => prev.map(b => b._id?.toString() === selected._id?.toString() ? { ...b, name: editName } : b));
      setSettingsOpen(false);
      toast.success('Updated!');
    } catch { toast.error('Failed'); }
    finally { setSavingSettings(false); }
  };

  const openSettings = () => { setEditName(selected.name); setEditDesc(selected.description || ''); setSettingsOpen(true); };

  const loadConnections = async () => {
    try {
      // Fetch from both Connection model AND gamification/me for live counts
      // Use the same gamificationAPI approach that guarantees all connections
      const { gamificationAPI: gAPI } = await import('../../services/api');
      const stats = await gAPI.getMyStats().catch(() => null);

      // Get connections from both models via the connections API
      const data = await connectionsAPI.getConnections();
      const fromConn = [
        ...(data.incoming || []).filter(c => c.status === 'accepted'),
        ...(data.sent    || []).filter(c => c.status === 'accepted'),
      ].map(c => ({ _id: c.otherUser?._id, ...c.otherUser }));

      // Also try to get IntroRequest-based connections via gamification profile
      // The connections API should now return all accepted — deduplicate by _id
      const seen = new Set();
      const all = fromConn.filter(u => {
        const uid = u?._id?.toString();
        if (!uid || seen.has(uid)) return false;
        seen.add(uid); return true;
      });

      setConnections(all);
    } catch { /* ignore */ }
  };

  // Upload media directly to Cloudinary then send as message
  const sendMedia = async (file) => {
    if (!selected || !file) return;
    setUploadingMedia(true);
    const uploadToastId = toast.loading('Uploading media…', { duration: Infinity });
    try {
      const sigData = await bubblesAPI.getUploadSignature(selected._id);
      const isVideo = file.type.startsWith('video/');
      const isAudio = file.type.startsWith('audio/');
      const resourceType = isVideo ? 'video' : isAudio ? 'raw' : 'image';

      const fd = new FormData();
      fd.append('file', file);
      fd.append('api_key', sigData.apiKey);
      fd.append('timestamp', String(sigData.timestamp));
      fd.append('signature', sigData.signature);
      fd.append('folder', sigData.folder);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${sigData.cloudName}/${resourceType}/upload`);
      await new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
          else reject(new Error('Upload failed'));
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.timeout = 10 * 60 * 1000;
        xhr.send(fd);
      }).then(async (result) => {
        const mediaType = isVideo ? 'video' : isAudio ? 'audio' : 'image';
        const msg = await bubblesAPI.sendMessage(selected._id, '', result.secure_url, mediaType);
        setMessages(prev => [...prev, { ...msg, senderName: user.name, senderPicture: user.profilePicture || '' }]);
        setBubbles(prev => prev.map(b => b._id?.toString() === selected._id?.toString() ? { ...b, lastMessage: `📎 ${mediaType}`, lastMessageAt: new Date().toISOString() } : b));
        toast.success('Media sent!', { id: uploadToastId, duration: 2000 });
      });
    } catch (err) {
      toast.error('Failed to upload media', { id: uploadToastId, duration: 3000 });
    } finally {
      setUploadingMedia(false);
      if (mediaInputRef.current) mediaInputRef.current.value = '';
    }
  };

  // Change bubble profile picture
  const changePicture = async (file) => {
    if (!file || !selected) return;
    const uploadToastId = toast.loading('Uploading picture…', { duration: Infinity });
    try {
      const fd = new FormData();
      fd.append('picture', file);
      const result = await bubblesAPI.uploadPicture(selected._id, fd);
      setSelected(prev => ({ ...prev, picture: result.picture }));
      setBubbles(prev => prev.map(b => b._id?.toString() === selected._id?.toString() ? { ...b, picture: result.picture } : b));
      toast.success('Picture updated!', { id: uploadToastId, duration: 2000 });
    } catch { toast.error('Failed', { id: uploadToastId, duration: 2000 }); }
  };

  const openInvite = () => { loadConnections(); setInviteSearch(''); setInviteOpen(true); };

  const invite = async (userId) => {
    setInviting(p => ({ ...p, [userId]: true }));
    try {
      await bubblesAPI.inviteMember(selected._id, userId);
      toast.success('Member added!');
      const data = await bubblesAPI.getBubble(selected._id);
      setSelected(data);
    } catch (err) { toast.error(err.message || 'Failed'); }
    finally { setInviting(p => ({ ...p, [userId]: false })); }
  };

  const removeMember = async (userId) => {
    if (!window.confirm('Remove this member?')) return;
    try {
      await bubblesAPI.removeMember(selected._id, userId);
      const data = await bubblesAPI.getBubble(selected._id);
      setSelected(data);
      toast.success('Member removed');
    } catch (err) { toast.error(err.message || 'Failed'); }
  };

  const leaveBubble = async () => {
    if (!window.confirm('Leave this Bubble?')) return;
    try {
      await bubblesAPI.removeMember(selected._id, user._id);
      setBubbles(prev => prev.filter(b => b._id?.toString() !== selected._id?.toString()));
      back();
      toast.success('Left Bubble');
    } catch (err) { toast.error(err.message || 'Failed'); }
  };

  const isMyAdmin = selected?.members?.some(m => m.userId?._id?.toString() === user._id?.toString() && m.role === 'admin');
  const alreadyInBubble = (uid) => selected?.members?.some(m => m.userId?._id?.toString() === uid);
  const filteredConn = connections.filter(c => (c?.name || '').toLowerCase().includes(inviteSearch.toLowerCase()));

  const getSenderId = (msg) => {
    if (!msg.senderId) return '';
    return typeof msg.senderId === 'object' ? msg.senderId._id?.toString() : msg.senderId.toString();
  };

  const getSenderName  = (msg) => msg.senderName  || (typeof msg.senderId === 'object' ? msg.senderId.name  : '') || 'User';
  const getSenderPic   = (msg) => msg.senderPicture|| (typeof msg.senderId === 'object' ? msg.senderId.profilePicture : '') || '';

  // ── Sidebar ────────────────────────────────────────────────────────────────
  const sidebar = (
    <div style={{ width: isMobile ? '100%' : 300, borderRight: isMobile ? 'none' : '1px solid #E5E7EB', display: isMobile ? (showWindow ? 'none' : 'flex') : 'flex', flexDirection: 'column', background: 'white', height: '100%' }}>
      <div style={{ padding: '1rem', borderBottom: '1px solid #F3F4F6' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Bubbles</h3>
          <button onClick={() => setCreateOpen(true)} style={{ background: '#84CC16', color: 'white', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>+ New</button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loadingBubbles ? <div style={{ padding: '2rem', textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
          : bubbles.length === 0 ? (
            <div style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🫧</div>
              <p style={{ color: '#9CA3AF', fontSize: '0.875rem' }}>No Bubbles yet.<br/>Create one to start a group!</p>
            </div>
          ) : bubbles.map(b => {
            const active = selected?._id?.toString() === b._id?.toString();
            return (
              <div key={b._id} onClick={() => openBubble(b)} style={{ padding: '0.875rem 1rem', cursor: 'pointer', background: active ? '#F0FDF4' : 'transparent', display: 'flex', gap: '0.75rem', alignItems: 'center', borderLeft: `3px solid ${active ? '#84CC16' : 'transparent'}`, borderBottom: '1px solid #F9FAFB', transition: 'background 0.12s' }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#F9FAFB'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                <Avatar src={b.picture} name={b.name} size={46} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, color: '#111827', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{b.name}</span>
                    <span style={{ fontSize: '0.72rem', color: '#9CA3AF', flexShrink: 0 }}>{ts(b.lastMessageAt)}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.lastMessage || `${b.memberCount || 1} members`}</div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );

  // ── Chat window ────────────────────────────────────────────────────────────
  const chatWindow = (
    <div style={{ flex: 1, display: isMobile ? (showWindow ? 'flex' : 'none') : 'flex', flexDirection: 'column', minWidth: 0, height: '100%', background: '#F0F2F5', ...(isMobile && showWindow ? { position: 'fixed', inset: 0, zIndex: 2000 } : {}) }}>
      {!selected ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🫧</div>
            <h3 style={{ margin: '0 0 0.5rem', color: '#374151' }}>Your Bubbles</h3>
            <p style={{ color: '#9CA3AF', fontSize: '0.875rem', margin: 0 }}>Select a Bubble to start chatting</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {/* Header */}
          <div style={{ padding: '0.75rem 1rem', background: 'white', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', zIndex: 10 }}>
            {isMobile && (
              <button onClick={back} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#374151', padding: '4px 8px 4px 0' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              </button>
            )}
            <Avatar src={selected.picture} name={selected.name} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.name}</div>
              <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>{selected.members?.length || 0} members</div>
            </div>
            {/* Actions — 3-dot menu */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setMenuOpen(v => !v)} style={{ background: 'none', border: '1px solid #E5E7EB', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', color: '#374151', fontSize: '1.1rem', fontWeight: 700 }}>⋮</button>
              {menuOpen && (
                <div style={{ position: 'absolute', top: 38, right: 0, background: 'white', border: '1px solid #E5E7EB', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 160, overflow: 'hidden' }}>
                  {[
                    { label: '👤 Invite', action: () => { setMenuOpen(false); openInvite(); } },
                    isMyAdmin && { label: '✏️ Edit Bubble', action: () => { setMenuOpen(false); openSettings(); } },
                    isMyAdmin && { label: '📷 Change Picture', action: () => { setMenuOpen(false); document.getElementById('bubble-pic-input').click(); } },
                    isMyAdmin && { label: '🛡️ Manage Permissions', action: () => { setMenuOpen(false); openSettings(); } },
                    { label: '🚪 Leave', action: () => { setMenuOpen(false); leaveBubble(); }, danger: true },
                  ].filter(Boolean).map((item, i) => (
                    <button key={i} onClick={item.action} style={{ width: '100%', background: 'none', border: 'none', padding: '0.75rem 1rem', textAlign: 'left', cursor: 'pointer', fontSize: '0.875rem', color: item.danger ? '#EF4444' : '#111827', borderBottom: i < 3 ? '1px solid #F3F4F6' : 'none' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
              {/* Hidden picture input */}
              <input type="file" id="bubble-pic-input" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) changePicture(e.target.files[0]); e.target.value = ''; }} />
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#F0F2F5', backgroundImage: 'radial-gradient(circle, #E5E7EB 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
            {loadingMsgs ? <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><LoadingSpinner message="Loading…" /></div>
              : messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#9CA3AF' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🫧</div>
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>No messages yet. Say hi!</p>
                </div>
              ) : messages.map((msg, i) => {
                const senderId = getSenderId(msg);
                const isOwn = senderId === user._id?.toString();
                const senderName = getSenderName(msg);
                const senderPic  = getSenderPic(msg);
                const prevSenderId = i > 0 ? getSenderId(messages[i - 1]) : null;
                const showSender = !isOwn && senderId !== prevSenderId;
                const fb = `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=84CC16&color=fff&size=64`;

                return (
                  <div key={msg._id} style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start', marginBottom: 2 }}>
                    {showSender && (
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.4rem', marginBottom: 2, paddingLeft: 4 }}>
                        <img src={senderPic || fb} alt={senderName} onError={e => { e.target.src = fb; }} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
                        <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600 }}>{senderName}</span>
                      </div>
                    )}
                    <div style={{ maxWidth: '72%', padding: '0.5rem 0.875rem', borderRadius: isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: isOwn ? '#84CC16' : 'white', color: isOwn ? '#0F172A' : '#111827', fontSize: '0.9rem', lineHeight: 1.5, boxShadow: '0 1px 2px rgba(0,0,0,0.1)', wordBreak: 'break-word', opacity: msg._opt ? 0.7 : 1 }}>
                      {msg.deletedForEveryone
                        ? <em style={{ color: '#9CA3AF' }}>🚫 Message deleted</em>
                        : msg.mediaUrl
                          ? (
                            <div>
                              {msg.mediaType === 'image' && <img src={msg.mediaUrl} alt="media" style={{ maxWidth: '100%', borderRadius: 8, display: 'block' }} />}
                              {msg.mediaType === 'video' && <video src={msg.mediaUrl} controls style={{ maxWidth: '100%', borderRadius: 8, display: 'block' }} />}
                              {msg.mediaType === 'audio' && <audio src={msg.mediaUrl} controls style={{ width: '100%' }} />}
                              {(!['image','video','audio'].includes(msg.mediaType)) && <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" style={{ color: isOwn ? '#0F172A' : '#2563EB' }}>📎 Download file</a>}
                              {msg.content && <p style={{ margin: '4px 0 0', fontSize: '0.875rem' }}>{msg.content}</p>}
                            </div>
                          )
                          : msg.content
                      }
                      <div style={{ fontSize: '0.7rem', color: isOwn ? 'rgba(15,23,42,0.5)' : '#9CA3AF', textAlign: 'right', marginTop: 2 }}>{ts(msg.createdAt)}</div>
                    </div>
                  </div>
                );
              })
            }
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '0.625rem 0.75rem', background: '#F0F2F5', borderTop: '1px solid #E5E7EB', display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexShrink: 0 }}>
            {/* Media attach button */}
            <button onClick={() => mediaInputRef.current?.click()} disabled={uploadingMedia} title="Attach media"
              style={{ width: 40, height: 40, borderRadius: '50%', background: '#E5E7EB', border: 'none', cursor: uploadingMedia ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: uploadingMedia ? 0.5 : 1 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
              </svg>
            </button>
            <input ref={mediaInputRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx" style={{ display: 'none' }}
              onChange={e => { if (e.target.files[0]) sendMedia(e.target.files[0]); }} />
            <div style={{ flex: 1, background: 'white', borderRadius: 24, border: '1px solid #E5E7EB', display: 'flex', alignItems: 'flex-end', padding: '0.5rem 0.875rem', minHeight: 42, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && window.innerWidth >= 768) { e.preventDefault(); send(); } }}
                placeholder="Message…" rows={1} disabled={sending}
                style={{ width: '100%', border: 'none', outline: 'none', resize: 'none', fontSize: '1rem', background: 'transparent', fontFamily: 'inherit', lineHeight: 1.5, maxHeight: 100 }}
              />
            </div>
            <button onClick={send} disabled={!input.trim() || sending}
              style={{ width: 40, height: 40, borderRadius: '50%', background: input.trim() ? '#84CC16' : '#E5E7EB', border: 'none', cursor: input.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? '#0F172A' : '#9CA3AF'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader title="Bubbles" subtitle="Group conversations with your network" />

      <Card style={{ padding: 0, overflow: 'hidden', borderRadius: 12 }}>
        <div style={{ display: 'flex', height: isMobile ? 'calc(100dvh - 60px - 56px - 60px - env(safe-area-inset-bottom,0px))' : 640, minHeight: isMobile ? 360 : 520, position: 'relative' }}>
          {sidebar}
          {chatWindow}
        </div>
      </Card>

      {/* Create Bubble Modal */}
      <Modal isOpen={createOpen} onClose={() => !creating && setCreateOpen(false)} title="Create a Bubble" maxWidth="440px">
        <form onSubmit={createBubble}>
          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label">Bubble Name *</label>
            <input className="form-input" value={createName} onChange={e => setCreateName(e.target.value)} placeholder="e.g. Startup Ideas, Deal Flow…" maxLength={100} required autoFocus />
          </div>
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Description (optional)</label>
            <textarea className="form-textarea" value={createDesc} onChange={e => setCreateDesc(e.target.value)} placeholder="What's this Bubble about?" rows={3} maxLength={300} />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="submit" disabled={!createName.trim() || creating} className="btn btn-primary" style={{ flex: 1 }}>{creating ? 'Creating…' : '🫧 Create Bubble'}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setCreateOpen(false)} disabled={creating} style={{ flex: 1 }}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Settings Modal */}
      <Modal isOpen={settingsOpen} onClose={() => !savingSettings && setSettingsOpen(false)} title={`Edit: ${selected?.name || ''}`} maxWidth="440px">
        <form onSubmit={saveSettings}>
          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label">Bubble Name</label>
            <input className="form-input" value={editName} onChange={e => setEditName(e.target.value)} maxLength={100} required />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} maxLength={300} />
          </div>
          {/* Member list with remove + promote/demote */}
          {selected?.members?.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">Members ({selected.members.length})</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: 200, overflowY: 'auto' }}>
                {selected.members.map(m => {
                  const u = m.userId || {};
                  const uid = u._id?.toString?.() || u.toString?.() || '';
                  const isMe = uid === user._id?.toString();
                  const memberIsAdmin = m.role === 'admin';
                  return (
                    <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.5rem', background: '#F9FAFB', borderRadius: 8 }}>
                      <Avatar src={u.profilePicture} name={u.name || 'User'} size={32} />
                      <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 500 }}>{u.name || 'User'}</span>
                      <span style={{ fontSize: '0.72rem', color: memberIsAdmin ? '#16A34A' : '#6B7280', background: memberIsAdmin ? '#F0FDF4' : '#F3F4F6', padding: '1px 6px', borderRadius: 9999 }}>{m.role}</span>
                      {!isMe && isMyAdmin && (
                        memberIsAdmin ? (
                          <button type="button" onClick={async () => {
                            try { await bubblesAPI.demoteFromAdmin(selected._id, uid); const d = await bubblesAPI.getBubble(selected._id); setSelected(d); toast.success('Admin removed'); } catch { toast.error('Failed'); }
                          }} style={{ background: 'none', border: '1px solid #E5E7EB', borderRadius: 6, padding: '2px 8px', fontSize: '0.72rem', cursor: 'pointer', color: '#6B7280', whiteSpace: 'nowrap' }}>
                            Remove admin
                          </button>
                        ) : (
                          <button type="button" onClick={async () => {
                            try { await bubblesAPI.promoteToAdmin(selected._id, uid); const d = await bubblesAPI.getBubble(selected._id); setSelected(d); toast.success('Made admin!'); } catch { toast.error('Failed'); }
                          }} style={{ background: 'none', border: '1px solid #84CC16', borderRadius: 6, padding: '2px 8px', fontSize: '0.72rem', cursor: 'pointer', color: '#16A34A', whiteSpace: 'nowrap' }}>
                            Make admin
                          </button>
                        )
                      )}
                      {!isMe && (
                        <button type="button" onClick={() => removeMember(uid)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '0.8rem', padding: '2px 4px' }}>Remove</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Permissions — admin only */}
          {isMyAdmin && (
            <div style={{ marginBottom: '1rem', background: '#F0FDF4', borderRadius: 10, padding: '0.75rem', border: '1px solid #BBF7D0' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: '0.75rem' }}>🛡️ Group Permissions</div>
              {[
                { key: 'allowMembersToInvite',   label: 'Allow all members to invite people' },
                { key: 'allowMembersToEditInfo',  label: 'Allow all members to edit group info' },
              ].map(({ key, label }) => {
                const checked = !!(selected?.permissions?.[key]);
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                    <span style={{ fontSize: '0.82rem', color: '#374151' }}>{label}</span>
                    {/* Custom toggle switch */}
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const result = await bubblesAPI.updatePermissions(selected._id, { [key]: !checked });
                          setSelected(prev => ({ ...prev, permissions: result.permissions }));
                          toast.success('Permission updated');
                        } catch { toast.error('Failed to update permission'); }
                      }}
                      style={{
                        position: 'relative',
                        width: 44, height: 24,
                        borderRadius: 12,
                        background: checked ? '#16A34A' : '#D1D5DB',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        flexShrink: 0,
                        outline: 'none',
                        padding: 0,
                      }}
                      aria-checked={checked}
                      role="switch"
                    >
                      <span style={{
                        position: 'absolute',
                        top: 3, left: checked ? 23 : 3,
                        width: 18, height: 18,
                        borderRadius: '50%',
                        background: 'white',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        transition: 'left 0.2s',
                      }} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="submit" disabled={savingSettings} className="btn btn-primary" style={{ flex: 1 }}>{savingSettings ? 'Saving…' : 'Save'}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setSettingsOpen(false)} disabled={savingSettings} style={{ flex: 1 }}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Invite Modal */}
      <Modal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite to Bubble" maxWidth="420px">
        <input className="form-input" placeholder="Search connections…" value={inviteSearch} onChange={e => setInviteSearch(e.target.value)} style={{ marginBottom: '0.75rem' }} />
        <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filteredConn.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#9CA3AF', padding: '1.5rem 0' }}>No connections found.</p>
          ) : filteredConn.map(person => {
            const uid = person?._id?.toString();
            const inBubble = alreadyInBubble(uid);
            return (
              <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', background: '#F9FAFB', borderRadius: 10 }}>
                <Avatar src={person?.profilePicture} name={person?.name} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.875rem' }}>{person?.name || 'User'}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6B7280', textTransform: 'capitalize' }}>{person?.role || ''}</div>
                </div>
                <button onClick={() => !inBubble && invite(uid)} disabled={inBubble || inviting[uid]}
                  style={{ padding: '5px 14px', background: inBubble ? '#D1FAE5' : '#84CC16', color: inBubble ? '#065F46' : 'white', border: 'none', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, cursor: inBubble ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
                  {inviting[uid] ? '…' : inBubble ? '✓ Added' : '+ Add'}
                </button>
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
