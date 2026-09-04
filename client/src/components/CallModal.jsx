import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone, Volume2 } from 'lucide-react';

export default function CallModal({
  callState, // { active, isIncoming, callerName, callerAvatar, callType, offerSignal, peerUserId, fromSocketId }
  onAcceptCall,
  onRejectCall,
  onEndCall,
  socket,
}) {
  const [micMuted, setMicMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const durationTimerRef = useRef(null);

  // Initialize WebRTC P2P Connection & Ringtone
  useEffect(() => {
    if (!callState) return;

    // Web Audio API synth ringtone for incoming calls
    let ringInterval = null;
    let audioCtx = null;

    if (callState.isIncoming) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const playRingTone = () => {
          if (!audioCtx || audioCtx.state === 'closed') return;
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, audioCtx.currentTime); // A4 note
          osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.2); // A5 note
          gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.8);
        };
        playRingTone();
        ringInterval = setInterval(playRingTone, 2000);
      } catch (err) {
        console.error('Ringtone synth error:', err);
      }
    }

    if (!callState.connected) {
      return () => {
        if (ringInterval) clearInterval(ringInterval);
        if (audioCtx) audioCtx.close();
      };
    }

    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };

    const pc = new RTCPeerConnection(configuration);
    peerConnectionRef.current = pc;

    // Start call duration timer
    durationTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    // Get User Local Media Stream (Camera & Mic)
    navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: callState.callType === 'video',
      })
      .then((stream) => {
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });
      })
      .catch((err) => {
        console.warn('Physical camera/mic not available or permission denied:', err);
      });

    // Handle Remote Track Received (Live P2P Stream)
    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Handle ICE Candidates for Live Connection
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice_candidate', {
          targetUserId: callState.peerUserId,
          toSocketId: callState.fromSocketId,
          candidate: event.candidate,
        });
      }
    };

    // Listen for peer ICE candidate
    socket.on('ice_candidate', async ({ candidate }) => {
      try {
        if (candidate && peerConnectionRef.current) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error('ICE candidate error:', err);
      }
    });

    return () => {
      clearInterval(durationTimerRef.current);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, [callState]);

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoOff(!videoTrack.enabled);
      }
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!callState) return null;

  return (
    <div className="call-overlay">
      {/* Header Info */}
      <div className="call-header">
        <img
          src={callState.callerAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${callState.callerName}`}
          alt="Avatar"
          className="avatar"
          style={{ width: '80px', height: '80px', margin: '0 auto' }}
        />
        <h2>{callState.callerName}</h2>
        <p>
          {callState.isIncoming
            ? `Incoming ${callState.callType === 'video' ? 'Video' : 'Voice'} Call...`
            : callState.connected
            ? `🔴 Live HD Video Stream • ${formatDuration(callDuration)}`
            : `Calling...`}
        </p>
      </div>

      {/* Video Stream Container (Video Call) */}
      {callState.callType === 'video' && (
        <div className="video-grid">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="remote-video"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="local-video"
          />
        </div>
      )}

      {/* Controls Bar */}
      <div className="call-controls">
        {callState.isIncoming ? (
          <>
            <button
              className="call-control-btn"
              style={{ background: 'var(--accent-primary)', width: '60px', height: '60px' }}
              onClick={onAcceptCall}
              title="Answer Call"
            >
              <Phone size={24} />
            </button>
            <button
              className="call-control-btn end"
              onClick={onRejectCall}
              title="Decline Call"
            >
              <PhoneOff size={24} />
            </button>
          </>
        ) : (
          <>
            <button
              className={`call-control-btn ${micMuted ? 'active' : ''}`}
              onClick={toggleMic}
              title={micMuted ? 'Unmute Mic' : 'Mute Mic'}
            >
              {micMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            {callState.callType === 'video' && (
              <button
                className={`call-control-btn ${videoOff ? 'active' : ''}`}
                onClick={toggleVideo}
                title={videoOff ? 'Turn Video On' : 'Turn Video Off'}
              >
                {videoOff ? <VideoOff size={20} /> : <Video size={20} />}
              </button>
            )}

            <button
              className="call-control-btn end"
              onClick={() => onEndCall(callDuration)}
              title="End Call"
            >
              <PhoneOff size={24} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
