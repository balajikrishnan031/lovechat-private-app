import React, { useState, useEffect } from 'react';
import { X, Users, Check } from 'lucide-react';

export default function NewGroupModal({ onClose, onCreateGroup }) {
  const [groupName, setGroupName] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/users', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setUsers(data);
      })
      .catch(console.error);
  }, []);

  const toggleUserSelection = (userId) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter((id) => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!groupName.trim() || selectedUserIds.length === 0) {
      alert('Please enter group name and select at least one contact.');
      return;
    }
    onCreateGroup(groupName.trim(), selectedUserIds);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <div className="modal-header">
          <h2>👥 Create New Private Group</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Group Subject / Name</label>
            <input
              type="text"
              placeholder="e.g. UCE Panruti CSE 2026 Project Group"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: '14px', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>
            SELECT MEMBERS ({selectedUserIds.length} SELECTED)
          </div>

          <div style={{ maxHeight: '250px', overflowY: 'auto', marginBottom: '20px' }}>
            {users.map((user) => {
              const isSelected = selectedUserIds.includes(user.id);
              return (
                <div
                  key={user.id}
                  onClick={() => toggleUserSelection(user.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    background: isSelected ? '#202c33' : 'transparent',
                    marginBottom: '4px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img src={user.avatar} alt="Avatar" className="avatar" style={{ width: '36px', height: '36px' }} />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>{user.username}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{user.email}</div>
                    </div>
                  </div>
                  <div
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      border: '2px solid var(--border-color)',
                      background: isSelected ? 'var(--accent-primary)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isSelected && <Check size={14} style={{ color: '#fff' }} />}
                  </div>
                </div>
              );
            })}
          </div>

          <button type="submit" className="btn-primary">
            Create Group Chat
          </button>
        </form>
      </div>
    </div>
  );
}
