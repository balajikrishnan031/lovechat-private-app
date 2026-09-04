import React, { useState, useEffect, useRef } from 'react';
import { Phone, Video, Send, Paperclip, Mic, Image, FileText, Camera, Check, CheckCheck, Smile, X, Play, Pause } from 'lucide-react';

export default function ChatArea({
  currentUser,
  activeChat,
  messages,
  onSendMessage,
  onStartCall,
  socket,
}) {
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [previewMedia, setPreviewMedia] = useState(null); // { file, fileUrl, type, name }
  const [enlargedImage, setEnlargedImage] = useState(null);

  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, partnerTyping]);

  // Listen for partner typing indicator
  useEffect(() => {
    if (!socket || !activeChat) return;

    const handleUserTyping = ({ chatId, isTyping }) => {
      if (chatId === activeChat.id) {
        setPartnerTyping(isTyping);
      }
    };

    socket.on('user_typing', handleUserTyping);
    return () => {
      socket.off('user_typing', handleUserTyping);
    };
  }, [socket, activeChat]);

  // Typing debounce timer
  const handleInputChange = (e) => {
    setInputText(e.target.value);
    if (!isTyping && activeChat) {
      setIsTyping(true);
      socket.emit('typing', { chatId: activeChat.id, isTyping: true });
    }

    clearTimeout(window.typingTimeout);
    window.typingTimeout = setTimeout(() => {
      setIsTyping(false);
      if (activeChat) socket.emit('typing', { chatId: activeChat.id, isTyping: false });
    }, 2000);
  };

  const handleSendText = (e) => {
    e.preventDefault();
    if (!inputText.trim() && !previewMedia) return;

    if (previewMedia) {
      handleUploadAndSend();
      return;
    }

    onSendMessage({
      chatId: activeChat.id,
      content: inputText.trim(),
      type: 'text',
    });

    setInputText('');
    socket.emit('typing', { chatId: activeChat.id, isTyping: false });
    setIsTyping(false);
  };

  // Handle File Selection (Images, Videos, PDFs)
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setShowAttachmentMenu(false);
    let type = 'file';
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type.startsWith('video/')) type = 'video';
    else if (file.type.startsWith('audio/')) type = 'audio';

    const fileUrl = URL.createObjectURL(file);
    setPreviewMedia({
      file,
      fileUrl,
      type,
      name: file.name,
    });
  };

  // Upload Selected File & Send Message
  const handleUploadAndSend = async () => {
    if (!previewMedia || !previewMedia.file) return;

    const formData = new FormData();
    formData.append('file', previewMedia.file);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        onSendMessage({
          chatId: activeChat.id,
          content: inputText.trim() || previewMedia.name,
          type: previewMedia.type,
          fileUrl: data.fileUrl,
          fileName: data.fileName,
          fileSize: data.fileSize,
        });
        setPreviewMedia(null);
        setInputText('');
      } else {
        alert('File upload failed');
      }
    } catch (err) {
      console.error('Upload Error:', err);
      alert('Upload server error');
    }
  };

  // Start Voice Note Recording
  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });

        const formData = new FormData();
        formData.append('file', audioFile);

        const token = localStorage.getItem('token');
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        const data = await res.json();
        if (res.ok) {
          onSendMessage({
            chatId: activeChat.id,
            content: `🎤 Voice Note (${recordingSeconds}s)`,
            type: 'audio',
            fileUrl: data.fileUrl,
            fileName: data.fileName,
          });
        }

        // Stop stream tracks
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecordingAudio(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      alert('Microphone access denied or not available');
    }
  };

  // Stop Audio Recording
  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      mediaRecorderRef.current.stop();
      setIsRecordingAudio(false);
      clearInterval(recordingTimerRef.current);
    }
  };

  if (!activeChat) {
    return (
      <div className="chat-area" style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px', background: 'radial-gradient(circle at 50% 50%, #fff0f3 0%, #fff5f7 100%)' }}>
        <div style={{ background: '#ffffff', padding: '40px', borderRadius: '28px', border: '2px solid var(--border-color)', maxWidth: '420px', boxShadow: '0 20px 50px rgba(255, 77, 109, 0.15)', position: 'relative' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>💖</div>
          <h2 style={{ fontSize: '24px', marginBottom: '8px', color: 'var(--accent-primary)', fontFamily: 'var(--font-display)' }}>LoveChat Private App</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6' }}>
            Select a loved one or contact from the sidebar to start sending romantic messages, voice notes, photos, or making high quality voice & video calls! 🌸
          </p>
        </div>
      </div>
    );
  }

  const partnerUser = activeChat.partner;

  return (
    <div className="chat-area">
      {/* Header Bar */}
      <div className="chat-header">
        <div className="chat-header-info">
          <img
            src={activeChat.displayAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${activeChat.id}`}
            alt="Avatar"
            className="avatar"
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2>{activeChat.displayName}</h2>
              <span
                style={{
                  fontSize: '10px',
                  background: 'rgba(255, 77, 109, 0.15)',
                  color: 'var(--accent-primary)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  border: '1px solid var(--border-color)',
                }}
                title="Messages are end-to-end encrypted with AES-256-GCM. No one else can read them."
              >
                🔒 End-to-End Encrypted
              </span>
            </div>
            <p>
              {partnerTyping ? (
                <span style={{ color: 'var(--accent-primary)', fontWeight: '600' }}>typing...</span>
              ) : partnerUser ? (
                partnerUser.online ? (
                  <span style={{ color: 'var(--accent-primary)' }}>Online</span>
                ) : (
                  'Offline'
                )
              ) : (
                'Group Chat'
              )}
            </p>
          </div>
        </div>

        <div className="chat-header-actions">
          {activeChat.type === 'direct' && partnerUser && (
            <>
              <button
                className="call-btn"
                onClick={() => onStartCall(partnerUser.id, 'voice')}
                title="Start 1-to-1 Voice Call"
              >
                <Phone size={16} /> Voice Call
              </button>
              <button
                className="call-btn"
                onClick={() => onStartCall(partnerUser.id, 'video')}
                title="Start 1-to-1 Video Call"
              >
                <Video size={16} /> Video Call
              </button>
            </>
          )}
        </div>
      </div>

      {/* Messages Stream */}
      <div className="messages-container">
        {messages.map((msg, idx) => {
          const isOut = msg.sender_id === currentUser.id;
          return (
            <div key={msg.id || idx} className={`message-row ${isOut ? 'out' : 'in'}`}>
              <div className={`message-bubble ${isOut ? 'out' : 'in'}`}>
                {!isOut && activeChat.type === 'group' && (
                  <div className="message-sender-title">{msg.sender_name}</div>
                )}

                {/* Text Content */}
                {msg.type === 'text' && <div>{msg.content}</div>}

                {/* Image Media Attachment */}
                {msg.type === 'image' && (
                  <div>
                    <img
                      src={msg.file_url}
                      alt="Shared attachment"
                      className="media-image-preview"
                      onClick={() => setEnlargedImage(msg.file_url)}
                    />
                    {msg.content && msg.content !== msg.file_name && <div>{msg.content}</div>}
                  </div>
                )}

                {/* Video Media Attachment */}
                {msg.type === 'video' && (
                  <div>
                    <video src={msg.file_url} controls className="media-video-player" />
                    {msg.content && msg.content !== msg.file_name && <div>{msg.content}</div>}
                  </div>
                )}

                {/* Audio Voice Note */}
                {msg.type === 'audio' && (
                  <div>
                    <audio src={msg.file_url} controls className="media-audio-player" />
                  </div>
                )}

                {/* File / Document Attachment */}
                {msg.type === 'file' && (
                  <a href={msg.file_url} download target="_blank" rel="noreferrer" className="doc-download-card">
                    <FileText size={28} style={{ color: 'var(--accent-primary)' }} />
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '13px' }}>{msg.file_name || 'Document'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Click to download</div>
                    </div>
                  </a>
                )}

                <div className="message-meta">
                  <span>
                    {new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isOut && <CheckCheck size={14} style={{ color: 'var(--accent-primary)' }} />}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Media Upload Preview Modal */}
      {previewMedia && (
        <div style={{ padding: '12px 16px', background: '#111b21', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {previewMedia.type === 'image' ? (
              <img src={previewMedia.fileUrl} alt="Preview" style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover' }} />
            ) : (
              <FileText size={32} style={{ color: 'var(--accent-primary)' }} />
            )}
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600' }}>{previewMedia.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ready to send</div>
            </div>
          </div>
          <button className="icon-btn" onClick={() => setPreviewMedia(null)}>
            <X size={20} />
          </button>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileSelect}
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
      />

      {/* Attachment Popover */}
      {showAttachmentMenu && (
        <div
          style={{
            position: 'absolute',
            bottom: '70px',
            left: '20px',
            background: '#111b21',
            borderRadius: '14px',
            padding: '10px',
            display: 'flex',
            gap: '12px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 20,
          }}
        >
          <button
            className="icon-btn"
            style={{ flexDirection: 'column', height: 'auto', gap: '4px' }}
            onClick={() => fileInputRef.current.click()}
          >
            <Image size={24} style={{ color: '#00a884' }} />
            <span style={{ fontSize: '10px' }}>Media</span>
          </button>
          <button
            className="icon-btn"
            style={{ flexDirection: 'column', height: 'auto', gap: '4px' }}
            onClick={() => fileInputRef.current.click()}
          >
            <FileText size={24} style={{ color: '#53bdeb' }} />
            <span style={{ fontSize: '10px' }}>Document</span>
          </button>
        </div>
      )}

      {/* Input Bar */}
      <div className="chat-input-bar">
        <button className="icon-btn" onClick={() => setShowAttachmentMenu(!showAttachmentMenu)} title="Attach File or Image">
          <Paperclip size={20} />
        </button>

        {isRecordingAudio ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', background: '#2a3942', padding: '10px 16px', borderRadius: '24px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--danger-color)', animation: 'pulse 1s infinite' }} />
            <span style={{ fontSize: '13px', fontWeight: '600' }}>Recording Voice Note... {recordingSeconds}s</span>
            <button
              onClick={stopAudioRecording}
              style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: '12px', background: 'var(--danger-color)', color: '#fff', fontSize: '12px', fontWeight: '600' }}
            >
              Stop & Send
            </button>
          </div>
        ) : (
          <form onSubmit={handleSendText} className="chat-input-wrapper">
            <input
              type="text"
              placeholder="Type a message..."
              value={inputText}
              onChange={handleInputChange}
            />
            <button
              type="button"
              className="icon-btn"
              onClick={() => onSendMessage({ chatId: activeChat.id, content: '❤️', type: 'text' })}
              title="Send Heart"
            >
              <span style={{ fontSize: '20px' }}>❤️</span>
            </button>
            <button type="submit" className="send-btn" title="Send Message">
              <Send size={18} />
            </button>
          </form>
        )}

        {!isRecordingAudio && !inputText.trim() && (
          <button className="icon-btn" onClick={startAudioRecording} title="Record Voice Note">
            <Mic size={20} style={{ color: 'var(--accent-primary)' }} />
          </button>
        )}
      </div>

      {/* Image Zoom Modal */}
      {enlargedImage && (
        <div className="modal-backdrop" onClick={() => setEnlargedImage(null)}>
          <img src={enlargedImage} alt="Enlarged preview" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '12px' }} />
        </div>
      )}
    </div>
  );
}
