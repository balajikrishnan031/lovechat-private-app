import React, { useState, useEffect } from 'react';
import { X, Check, ShieldAlert, Plus, Building, UserCheck, UserX } from 'lucide-react';

export default function AdminPanel({ onClose }) {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [domains, setDomains] = useState([]);
  const [newDomain, setNewDomain] = useState('');
  const [domainDesc, setDomainDesc] = useState('');
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'domains' | 'users'

  const token = localStorage.getItem('token');

  const fetchData = () => {
    // Fetch pending & all users
    fetch('/api/admin/pending-users', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.pending) setPendingUsers(data.pending);
        if (data.allUsers) setAllUsers(data.allUsers);
      })
      .catch(console.error);

    // Fetch allowed domains
    fetch('/api/admin/domains', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setDomains(data);
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = async (userId, status) => {
    try {
      const res = await fetch('/api/admin/approve-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, status }),
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddDomain = async (e) => {
    e.preventDefault();
    if (!newDomain) return;
    try {
      const res = await fetch('/api/admin/add-domain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ domain: newDomain, description: domainDesc }),
      });
      if (res.ok) {
        setNewDomain('');
        setDomainDesc('');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '650px' }}>
        <div className="modal-header">
          <h2>🛡️ Admin Management Portal</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Admin Tabs */}
        <div className="auth-tabs" style={{ marginBottom: '20px' }}>
          <button className={`auth-tab ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>
            Pending Approvals ({pendingUsers.length})
          </button>
          <button className={`auth-tab ${activeTab === 'domains' ? 'active' : ''}`} onClick={() => setActiveTab('domains')}>
            Allowed Email Whitelist
          </button>
          <button className={`auth-tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
            All Users ({allUsers.length})
          </button>
        </div>

        {/* Pending Users Tab */}
        {activeTab === 'pending' && (
          <div>
            {pendingUsers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                No pending registration requests at this time.
              </div>
            ) : (
              pendingUsers.map((user) => (
                <div
                  key={user.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: '#202c33',
                    borderRadius: '12px',
                    marginBottom: '10px',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '15px' }}>{user.username}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{user.email}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleApprove(user.id, 'approved')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '8px',
                        background: 'var(--accent-primary)',
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <UserCheck size={14} /> Approve
                    </button>
                    <button
                      onClick={() => handleApprove(user.id, 'blocked')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '8px',
                        background: 'var(--danger-color)',
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <UserX size={14} /> Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* College Email Domains Tab */}
        {activeTab === 'domains' && (
          <div>
            <form onSubmit={handleAddDomain} style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
              <input
                type="text"
                placeholder="domain.app (e.g. private.app)"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                style={{ flex: 1 }}
                required
              />
              <input
                type="text"
                placeholder="Description"
                value={domainDesc}
                onChange={(e) => setDomainDesc(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn-primary" style={{ marginTop: 0, width: 'auto', padding: '0 16px' }}>
                Add Domain
              </button>
            </form>

            {domains.map((d) => (
              <div
                key={d.domain}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: '#202c33',
                  borderRadius: '10px',
                  marginBottom: '8px',
                }}
              >
                <div>
                  <div style={{ fontWeight: '600', color: 'var(--accent-primary)' }}>@{d.domain}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{d.description}</div>
                </div>
                <span style={{ fontSize: '11px', background: 'rgba(0,168,132,0.2)', color: 'var(--accent-hover)', padding: '2px 8px', borderRadius: '12px' }}>
                  Auto-Approve Active
                </span>
              </div>
            ))}
          </div>
        )}

        {/* All Users Tab */}
        {activeTab === 'users' && (
          <div>
            {allUsers.map((user) => (
              <div
                key={user.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: '#202c33',
                  borderRadius: '10px',
                  marginBottom: '8px',
                }}
              >
                <div>
                  <div style={{ fontWeight: '600' }}>
                    {user.username} {user.role === 'admin' ? '🛡️' : ''}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{user.email}</div>
                </div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: user.status === 'approved' ? 'var(--accent-primary)' : 'var(--warning-color)' }}>
                  {user.status.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
