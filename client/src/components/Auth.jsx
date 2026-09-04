import React, { useState } from 'react';
import { Heart, Lock, Mail, User, Clock } from 'lucide-react';

export default function Auth({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [pendingNotice, setPendingNotice] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setPendingNotice(false);
    setLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const payload = isLogin
      ? { email, password }
      : { username, email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        if (data.status === 'pending') {
          setPendingNotice(true);
          return;
        }
        setError(data.error || 'Authentication failed');
        return;
      }

      if (data.status === 'pending') {
        setPendingNotice(true);
        setSuccessMsg(data.message);
      } else {
        localStorage.setItem('token', data.token);
        onLoginSuccess(data.user, data.token);
      }
    } catch (err) {
      setLoading(false);
      setError('Server connection error. Ensure server is running.');
    }
  };

  return (
    <div className="auth-container">
      {/* Floating background heart particles */}
      <div className="heart-particle" style={{ top: '15%', left: '10%', animationDelay: '0s', fontSize: '24px' }}>💖</div>
      <div className="heart-particle" style={{ top: '70%', left: '85%', animationDelay: '1s', fontSize: '32px' }}>💕</div>
      <div className="heart-particle" style={{ top: '25%', left: '80%', animationDelay: '2s', fontSize: '28px' }}>💗</div>
      <div className="heart-particle" style={{ top: '75%', left: '15%', animationDelay: '1.5s', fontSize: '20px' }}>🌸</div>

      <div className="auth-box">
        <div className="auth-header">
          <h1>
            <Heart style={{ color: 'var(--accent-primary)', fill: 'var(--accent-primary)' }} size={36} /> LoveChat
          </h1>
          <p>💖 Private Rose & Heart Communication App 💖</p>
        </div>

        {pendingNotice ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Clock size={56} style={{ color: 'var(--warning-color)', marginBottom: '16px' }} />
            <h2 style={{ fontSize: '20px', marginBottom: '10px' }}>Approval Pending</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.5' }}>
              Your registration request has been received! The Admin must approve your account before you can access the private network.
            </p>
            <button
              className="btn-primary"
              style={{ marginTop: '24px' }}
              onClick={() => {
                setPendingNotice(false);
                setIsLogin(true);
              }}
            >
              Back to Login
            </button>
          </div>
        ) : (
          <>
            <div className="auth-tabs">
              <button
                className={`auth-tab ${isLogin ? 'active' : ''}`}
                onClick={() => {
                  setIsLogin(true);
                  setError('');
                }}
              >
                Sign In
              </button>
              <button
                className={`auth-tab ${!isLogin ? 'active' : ''}`}
                onClick={() => {
                  setIsLogin(false);
                  setError('');
                }}
              >
                Register
              </button>
            </div>

            {error && (
              <div style={{ background: 'rgba(234, 67, 53, 0.15)', color: '#ff6b6b', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
                {error}
              </div>
            )}

            {successMsg && (
              <div style={{ background: 'rgba(0, 168, 132, 0.15)', color: 'var(--accent-hover)', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
                {successMsg}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {!isLogin && (
                <div className="form-group">
                  <label>Full Name / Display Username</label>
                  <div className="search-input-wrapper">
                    <User size={18} />
                    <input
                      type="text"
                      placeholder="e.g. Balaji Vignesh"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Email Address</label>
                <div className="search-input-wrapper">
                  <Mail size={18} />
                  <input
                    type="email"
                    placeholder="user@private.app"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Password</label>
                <div className="search-input-wrapper">
                  <Lock size={18} />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Please wait...' : isLogin ? 'Sign In to Private App' : 'Create Account'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
