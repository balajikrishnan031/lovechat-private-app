import React, { useState, useEffect } from 'react';
import { Search, Plus, MessageSquare, Users, Phone, ShieldCheck, LogOut, PhoneIncoming, PhoneOutgoing, PhoneMissed, Heart, Sparkles } from 'lucide-react';

export default function Sidebar({
  currentUser,
  chats,
  activeChat,
  onSelectChat,
  onStartDirectChat,
  onOpenNewGroup,
  onOpenAdmin,
  onLogout,
  socket,
}) {
  const [activeTab, setActiveTab] = useState('chats'); // 'chats' | 'users' | 'calls'
  const [searchQuery, setSearchQuery] = useState('');
  const [usersList, setUsersList] = useState([]);
  const [callHistory, setCallHistory] = useState([]);

  // Fetch approved users directory
  useEffect(() => {
    if (activeTab === 'users') {
      const token = localStorage.getItem('token');
      fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setUsersList(data);
        })
        .catch(console.error);
    } else if (activeTab === 'calls') {
      const token = localStorage.getItem('token');
      fetch('/api/calls/history', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setCallHistory(data);
        })
        .catch(console.error);
    }
  }, [activeTab]);

  const filteredChats = chats.filter((c) =>
    (c.displayName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUsers = usersList.filter(
    (u) =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="sidebar">
      {/* Top Profile Header */}
      <div className="sidebar-header">
        <div className="user-avatar-badge">
          <img src={currentUser.avatar} alt="Avatar" className="avatar" />
          <div className="user-info">
            <h3>{currentUser.username}</h3>
            <p>{currentUser.role === 'admin' ? '👑 Admin' : '💖 Rose Member'}</p>
          </div>
        </div>
        <div className="sidebar-actions">
          {currentUser.role === 'admin' && (
            <button className="icon-btn" title="Admin Control Panel" onClick={onOpenAdmin}>
              <ShieldCheck size={20} style={{ color: 'var(--warning-color)' }} />
            </button>
          )}
          <button className="icon-btn" title="New Group Chat" onClick={onOpenNewGroup}>
            <Plus size={20} />
          </button>
          <button className="icon-btn" title="Logout" onClick={onLogout}>
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'var(--bg-header)', borderBottom: '1px solid var(--border-color)' }}>
        <button
          style={{
            flex: 1,
            padding: '10px',
            textAlign: 'center',
            fontSize: '13px',
            fontWeight: '600',
            borderBottom: activeTab === 'chats' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            color: activeTab === 'chats' ? 'var(--accent-primary)' : 'var(--text-muted)',
          }}
          onClick={() => setActiveTab('chats')}
        >
          <MessageSquare size={16} style={{ display: 'inline', marginRight: '6px' }} />
          Chats
        </button>
        <button
          style={{
            flex: 1,
            padding: '10px',
            textAlign: 'center',
            fontSize: '13px',
            fontWeight: '600',
            borderBottom: activeTab === 'users' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            color: activeTab === 'users' ? 'var(--accent-primary)' : 'var(--text-muted)',
          }}
          onClick={() => setActiveTab('users')}
        >
          <Users size={16} style={{ display: 'inline', marginRight: '6px' }} />
          Directory
        </button>
        <button
          style={{
            flex: 1,
            padding: '10px',
            textAlign: 'center',
            fontSize: '13px',
            fontWeight: '600',
            borderBottom: activeTab === 'calls' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            color: activeTab === 'calls' ? 'var(--accent-primary)' : 'var(--text-muted)',
          }}
          onClick={() => setActiveTab('calls')}
        >
          <Phone size={16} style={{ display: 'inline', marginRight: '6px' }} />
          Calls
        </button>
      </div>

      {/* Search Input */}
      <div className="search-box">
        <div className="search-input-wrapper">
          <Search size={16} />
          <input
            type="text"
            placeholder={
              activeTab === 'chats' ? 'Search or start new chat...' : activeTab === 'users' ? 'Search contacts by name/email...' : 'Filter call logs...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Chat List View */}
      {activeTab === 'chats' && (
        <div className="chat-list">
          {filteredChats.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No active conversations yet. Click <strong>Directory</strong> tab to select a contact to chat!
            </div>
          ) : (
            filteredChats.map((chat) => {
              const isActive = activeChat && activeChat.id === chat.id;
              return (
                <div
                  key={chat.id}
                  className={`chat-item ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectChat(chat)}
                >
                  <div className="chat-item-avatar">
                    <img
                      src={chat.displayAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${chat.id}`}
                      alt="Avatar"
                      className="avatar"
                    />
                    {chat.partner && chat.partner.online ? <div className="online-dot" /> : null}
                  </div>
                  <div className="chat-item-details">
                    <div className="chat-item-header">
                      <span className="chat-item-name">{chat.displayName}</span>
                      {chat.last_message_time && (
                        <span className="chat-item-time">
                          {new Date(chat.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <div className="chat-item-sub">
                      {chat.last_message ? (
                        chat.last_message_type === 'image'
                          ? '📷 Photo'
                          : chat.last_message_type === 'video'
                          ? '🎥 Video'
                          : chat.last_message_type === 'audio'
                          ? '🎵 Voice Message'
                          : chat.last_message_type === 'file'
                          ? '📄 Document'
                          : chat.last_message
                      ) : (
                        <span style={{ fontStyle: 'italic' }}>No messages yet</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Users / Directory Tab */}
      {activeTab === 'users' && (
        <div className="chat-list">
          {filteredUsers.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No contacts found in directory.
            </div>
          ) : (
            filteredUsers.map((user) => (
              <div
                key={user.id}
                className="chat-item"
                onClick={() => {
                  onStartDirectChat(user.id);
                  setActiveTab('chats');
                }}
              >
                <div className="chat-item-avatar">
                  <img src={user.avatar} alt="Avatar" className="avatar" />
                  {user.online ? <div className="online-dot" /> : null}
                </div>
                <div className="chat-item-details">
                  <div className="chat-item-header">
                    <span className="chat-item-name">{user.username}</span>
                    <span className="chat-item-time" style={{ color: user.online ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                      {user.online ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <div className="chat-item-sub">{user.email}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Call History Tab */}
      {activeTab === 'calls' && (
        <div className="chat-list">
          {callHistory.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No call history records.
            </div>
          ) : (
            callHistory.map((log) => {
              const isOutgoing = log.caller_id === currentUser.id;
              const peerName = isOutgoing ? log.receiver_name : log.caller_name;
              const peerAvatar = isOutgoing ? log.receiver_avatar : log.caller_avatar;
              const isMissed = log.status === 'rejected' || log.status === 'missed';

              return (
                <div key={log.id} className="chat-item">
                  <div className="chat-item-avatar">
                    <img src={peerAvatar} alt="Avatar" className="avatar" />
                  </div>
                  <div className="chat-item-details">
                    <div className="chat-item-header">
                      <span className="chat-item-name">{peerName}</span>
                      <span className="chat-item-time">
                        {new Date(log.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <div className="chat-item-sub" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isOutgoing ? (
                        <PhoneOutgoing size={14} style={{ color: 'var(--accent-primary)' }} />
                      ) : isMissed ? (
                        <PhoneMissed size={14} style={{ color: 'var(--danger-color)' }} />
                      ) : (
                        <PhoneIncoming size={14} style={{ color: 'var(--accent-hover)' }} />
                      )}
                      <span>{log.type === 'video' ? 'Video Call' : 'Voice Call'} • {log.duration ? `${log.duration}s` : log.status}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
