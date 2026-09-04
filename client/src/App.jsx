import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import Auth from './components/Auth';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import CallModal from './components/CallModal';
import AdminPanel from './components/AdminPanel';
import NewGroupModal from './components/NewGroupModal';
import { encryptMessage, decryptMessage } from './utils/crypto';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);

  // WebRTC Call State
  const [callState, setCallState] = useState(null);

  const socketRef = useRef(null);

  // Authenticate stored JWT token on startup
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoadingUser(false);
      return;
    }

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.id) {
          setCurrentUser(data);
          initializeSocket(data.id);
        } else {
          localStorage.removeItem('token');
        }
        setLoadingUser(false);
      })
      .catch((err) => {
        console.error('Auth verification error:', err);
        setLoadingUser(false);
      });
  }, []);

  // Initialize Socket.IO connection
  const initializeSocket = (userId) => {
    if (socketRef.current) socketRef.current.disconnect();

    const socket = io('/', {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('user_connected', userId);
      fetchUserChats();
    });

    // Listen for incoming messages & decrypt E2EE on client
    socket.on('receive_message', async (message) => {
      const decryptedText = await decryptMessage(message.content, message.chat_id);
      const decryptedMsg = { ...message, content: decryptedText };

      setMessages((prevMessages) => {
        if (activeChat && activeChat.id === message.chat_id) {
          return [...prevMessages, decryptedMsg];
        }
        return prevMessages;
      });

      fetchUserChats();
    });

    // Listen for status changes
    socket.on('user_status_changed', () => {
      fetchUserChats();
    });

    // WebRTC: Incoming Call
    socket.on('incoming_call', ({ callerId, callerName, callerAvatar, callType, offerSignal, fromSocketId }) => {
      setCallState({
        active: true,
        isIncoming: true,
        connected: false,
        callerName,
        callerAvatar,
        callType,
        offerSignal,
        peerUserId: callerId,
        fromSocketId,
      });
    });

    // WebRTC: Call Ended by Peer
    socket.on('call_ended', () => {
      setCallState(null);
    });

    // WebRTC: Call Rejected
    socket.on('call_rejected', () => {
      alert('Call was declined by recipient.');
      setCallState(null);
    });

    return socket;
  };

  const fetchUserChats = () => {
    if (socketRef.current) {
      socketRef.current.emit('fetch_user_chats', (res) => {
        if (res && res.chats) {
          setChats(res.chats);
        }
      });
    }
  };

  const handleLoginSuccess = (user, token) => {
    setCurrentUser(user);
    initializeSocket(user.id);
  };

  const handleLogout = () => {
    if (socketRef.current) socketRef.current.disconnect();
    localStorage.removeItem('token');
    setCurrentUser(null);
    setActiveChat(null);
    setChats([]);
  };

  const handleSelectChat = (chat) => {
    setActiveChat(chat);
    if (socketRef.current) {
      socketRef.current.emit('join_chat', { chatId: chat.id }, async (res) => {
        if (res && res.messages) {
          const decryptedMessages = await Promise.all(
            res.messages.map(async (msg) => ({
              ...msg,
              content: await decryptMessage(msg.content, msg.chat_id),
            }))
          );
          setMessages(decryptedMessages);
        }
      });
    }
  };

  const handleStartDirectChat = (targetUserId) => {
    if (socketRef.current) {
      socketRef.current.emit('get_or_create_direct_chat', { targetUserId }, (res) => {
        if (res && res.chatId) {
          fetchUserChats();
          setTimeout(() => {
            handleSelectChat({ id: res.chatId, type: 'direct' });
          }, 300);
        }
      });
    }
  };

  const handleSendMessage = async (msgPayload) => {
    if (socketRef.current) {
      // Encrypt text message payload before sending over socket
      let encryptedContent = msgPayload.content;
      if (msgPayload.type === 'text' && msgPayload.content) {
        encryptedContent = await encryptMessage(msgPayload.content, msgPayload.chatId);
      }

      socketRef.current.emit('send_message', {
        ...msgPayload,
        content: encryptedContent,
      });
    }
  };

  const handleCreateGroup = (name, memberIds) => {
    if (socketRef.current) {
      socketRef.current.emit('create_group_chat', { name, memberIds }, (res) => {
        if (res && res.chatId) {
          setShowNewGroupModal(false);
          fetchUserChats();
        }
      });
    }
  };

  // Initiate Voice or Video Call
  const handleStartCall = (targetUserId, callType) => {
    const targetUser = activeChat?.partner;
    setCallState({
      active: true,
      isIncoming: false,
      connected: true,
      callerName: targetUser ? targetUser.username : 'Contact',
      callerAvatar: targetUser ? targetUser.avatar : null,
      callType,
      peerUserId: targetUserId,
    });

    if (socketRef.current) {
      socketRef.current.emit('call_user', {
        targetUserId,
        callType,
      });
    }
  };

  const handleAcceptCall = () => {
    if (!callState) return;
    setCallState({
      ...callState,
      isIncoming: false,
      connected: true,
    });
  };

  const handleRejectCall = () => {
    if (socketRef.current && callState) {
      socketRef.current.emit('reject_call', { callerId: callState.peerUserId });
    }
    setCallState(null);
  };

  const handleEndCall = (duration) => {
    if (socketRef.current && callState) {
      socketRef.current.emit('end_call', {
        targetUserId: callState.peerUserId,
        duration,
        callType: callState.callType,
      });
    }
    setCallState(null);
  };

  if (loadingUser) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b141a', color: 'var(--accent-primary)', fontSize: '18px', fontWeight: '600' }}>
        Loading Private App...
      </div>
    );
  }

  if (!currentUser) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className={`app-container ${activeChat ? 'chat-active' : ''}`}>
      <Sidebar
        currentUser={currentUser}
        chats={chats}
        activeChat={activeChat}
        onSelectChat={handleSelectChat}
        onStartDirectChat={handleStartDirectChat}
        onOpenNewGroup={() => setShowNewGroupModal(true)}
        onOpenAdmin={() => setShowAdminPanel(true)}
        onLogout={handleLogout}
        socket={socketRef.current}
      />

      <ChatArea
        currentUser={currentUser}
        activeChat={activeChat}
        messages={messages}
        onSendMessage={handleSendMessage}
        onStartCall={handleStartCall}
        socket={socketRef.current}
      />

      {/* WebRTC Call Modal Overlay */}
      {callState && (
        <CallModal
          callState={callState}
          onAcceptCall={handleAcceptCall}
          onRejectCall={handleRejectCall}
          onEndCall={handleEndCall}
          socket={socketRef.current}
        />
      )}

      {/* Admin Panel Modal */}
      {showAdminPanel && <AdminPanel onClose={() => setShowAdminPanel(false)} />}

      {/* Create Group Modal */}
      {showNewGroupModal && (
        <NewGroupModal
          onClose={() => setShowNewGroupModal(false)}
          onCreateGroup={handleCreateGroup}
        />
      )}
    </div>
  );
}
