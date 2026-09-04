const { dbGet, dbAll, dbRun } = require('./db');

const onlineUsers = new Map(); // userId -> Set of socketIds

const setupSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    let currentUserId = null;

    // Register user socket
    socket.on('user_connected', async (userId) => {
      if (!userId) return;
      currentUserId = parseInt(userId);
      socket.join(`user_${currentUserId}`);

      if (!onlineUsers.has(currentUserId)) {
        onlineUsers.set(currentUserId, new Set());
      }
      onlineUsers.get(currentUserId).add(socket.id);

      // Update online status in DB
      await dbRun('UPDATE users SET online = 1 WHERE id = ?', [currentUserId]);
      io.emit('user_status_changed', { userId: currentUserId, online: true });
    });

    // Get or Create Direct Chat
    socket.on('get_or_create_direct_chat', async ({ targetUserId }, callback) => {
      try {
        if (!currentUserId || !targetUserId) return callback({ error: 'Invalid user IDs' });

        // Find existing direct chat between currentUserId and targetUserId
        const existingChat = await dbGet(
          `SELECT c.id FROM chats c
           JOIN chat_members cm1 ON c.id = cm1.chat_id
           JOIN chat_members cm2 ON c.id = cm2.chat_id
           WHERE c.type = 'direct' AND cm1.user_id = ? AND cm2.user_id = ?`,
          [currentUserId, targetUserId]
        );

        let chatId;
        if (existingChat) {
          chatId = existingChat.id;
        } else {
          // Create new chat
          const result = await dbRun(`INSERT INTO chats (type) VALUES ('direct')`);
          chatId = result.lastID;
          await dbRun(`INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)`, [chatId, currentUserId]);
          await dbRun(`INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)`, [chatId, targetUserId]);
        }

        socket.join(`chat_${chatId}`);
        if (callback) callback({ chatId });
      } catch (err) {
        console.error('get_or_create_direct_chat error:', err);
        if (callback) callback({ error: 'Failed to create chat' });
      }
    });

    // Create Group Chat
    socket.on('create_group_chat', async ({ name, memberIds }, callback) => {
      try {
        if (!currentUserId || !name || !memberIds || memberIds.length === 0) {
          return callback({ error: 'Group name and members required' });
        }

        const avatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(name)}`;
        const result = await dbRun(`INSERT INTO chats (type, name, avatar) VALUES ('group', ?, ?)`, [name, avatar]);
        const chatId = result.lastID;

        // Add creator as admin
        await dbRun(`INSERT INTO chat_members (chat_id, user_id, role) VALUES (?, ?, 'admin')`, [chatId, currentUserId]);

        // Add members
        for (const mId of memberIds) {
          if (mId !== currentUserId) {
            await dbRun(`INSERT INTO chat_members (chat_id, user_id, role) VALUES (?, ?, 'member')`, [chatId, mId]);
            // Notify members
            io.to(`user_${mId}`).emit('added_to_group', { chatId, name });
          }
        }

        socket.join(`chat_${chatId}`);
        if (callback) callback({ chatId, name, avatar });
      } catch (err) {
        console.error('create_group_chat error:', err);
        if (callback) callback({ error: 'Failed to create group' });
      }
    });

    // Fetch Recent Chats for Current User
    socket.on('fetch_user_chats', async (callback) => {
      try {
        if (!currentUserId) return callback({ error: 'User not authenticated' });

        const chats = await dbAll(
          `SELECT c.id, c.type, c.name, c.avatar, c.created_at,
                  (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
                  (SELECT type FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_type,
                  (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time
           FROM chats c
           JOIN chat_members cm ON c.id = cm.chat_id
           WHERE cm.user_id = ?
           ORDER BY last_message_time DESC, c.created_at DESC`,
          [currentUserId]
        );

        // Populate member details for direct chats
        for (let chat of chats) {
          if (chat.type === 'direct') {
            const partner = await dbGet(
              `SELECT u.id, u.username, u.avatar, u.online, u.last_seen, u.college
               FROM users u
               JOIN chat_members cm ON u.id = cm.user_id
               WHERE cm.chat_id = ? AND u.id != ?`,
              [chat.id, currentUserId]
            );
            chat.partner = partner;
            chat.displayName = partner ? partner.username : 'Unknown User';
            chat.displayAvatar = partner ? partner.avatar : null;
          } else {
            chat.displayName = chat.name;
            chat.displayAvatar = chat.avatar;
          }
        }

        if (callback) callback({ chats });
      } catch (err) {
        console.error('fetch_user_chats error:', err);
        if (callback) callback({ error: 'Failed to fetch chats' });
      }
    });

    // Join Chat Room & Fetch Messages
    socket.on('join_chat', async ({ chatId }, callback) => {
      try {
        socket.join(`chat_${chatId}`);
        const messages = await dbAll(
          `SELECT m.*, u.username as sender_name, u.avatar as sender_avatar
           FROM messages m
           JOIN users u ON m.sender_id = u.id
           WHERE m.chat_id = ?
           ORDER BY m.created_at ASC`,
          [chatId]
        );

        if (callback) callback({ messages });
      } catch (err) {
        console.error('join_chat error:', err);
        if (callback) callback({ error: 'Failed to load messages' });
      }
    });

    // Send Message
    socket.on('send_message', async ({ chatId, content, type = 'text', fileUrl = null, fileName = null, fileSize = null, replyToId = null }) => {
      try {
        if (!currentUserId || !chatId) return;

        const result = await dbRun(
          `INSERT INTO messages (chat_id, sender_id, content, type, file_url, file_name, file_size, reply_to_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [chatId, currentUserId, content, type, fileUrl, fileName, fileSize, replyToId]
        );

        const messageId = result.lastID;
        const sender = await dbGet('SELECT username, avatar FROM users WHERE id = ?', [currentUserId]);

        const fullMessage = {
          id: messageId,
          chat_id: chatId,
          sender_id: currentUserId,
          sender_name: sender.username,
          sender_avatar: sender.avatar,
          content,
          type,
          file_url: fileUrl,
          file_name: fileName,
          file_size: fileSize,
          reply_to_id: replyToId,
          created_at: new Date().toISOString(),
          status: 'delivered',
        };

        // Broadcast to chat room
        io.to(`chat_${chatId}`).emit('receive_message', fullMessage);
      } catch (err) {
        console.error('send_message error:', err);
      }
    });

    // Typing Status
    socket.on('typing', ({ chatId, isTyping }) => {
      if (!currentUserId || !chatId) return;
      socket.to(`chat_${chatId}`).emit('user_typing', { userId: currentUserId, chatId, isTyping });
    });

    // WebRTC Signaling: Call User
    socket.on('call_user', async ({ targetUserId, callType, offerSignal }) => {
      try {
        const caller = await dbGet('SELECT id, username, avatar FROM users WHERE id = ?', [currentUserId]);
        io.to(`user_${targetUserId}`).emit('incoming_call', {
          callerId: currentUserId,
          callerName: caller.username,
          callerAvatar: caller.avatar,
          callType, // 'voice' | 'video'
          offerSignal,
          fromSocketId: socket.id,
        });
      } catch (err) {
        console.error('call_user error:', err);
      }
    });

    // WebRTC Signaling: Answer Call
    socket.on('answer_call', ({ toSocketId, answerSignal }) => {
      io.to(toSocketId).emit('call_accepted', { answerSignal, fromSocketId: socket.id });
    });

    // WebRTC Signaling: ICE Candidate Exchange
    socket.on('ice_candidate', ({ targetUserId, toSocketId, candidate }) => {
      if (toSocketId) {
        io.to(toSocketId).emit('ice_candidate', { candidate });
      } else if (targetUserId) {
        io.to(`user_${targetUserId}`).emit('ice_candidate', { candidate });
      }
    });

    // End Call & Save Call Log
    socket.on('end_call', async ({ targetUserId, duration = 0, callType = 'video', status = 'completed' }) => {
      try {
        if (targetUserId) {
          io.to(`user_${targetUserId}`).emit('call_ended', { by: currentUserId });
          // Log call
          await dbRun(
            `INSERT INTO call_logs (caller_id, receiver_id, type, status, duration) VALUES (?, ?, ?, ?, ?)`,
            [currentUserId, targetUserId, callType, status, duration]
          );
        }
      } catch (err) {
        console.error('end_call error:', err);
      }
    });

    // Reject Call
    socket.on('reject_call', async ({ callerId }) => {
      if (callerId) {
        io.to(`user_${callerId}`).emit('call_rejected', { by: currentUserId });
        await dbRun(`INSERT INTO call_logs (caller_id, receiver_id, type, status, duration) VALUES (?, ?, 'video', 'rejected', 0)`, [
          callerId,
          currentUserId,
        ]);
      }
    });

    // Disconnect
    socket.on('disconnect', async () => {
      if (currentUserId && onlineUsers.has(currentUserId)) {
        const userSockets = onlineUsers.get(currentUserId);
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(currentUserId);
          await dbRun('UPDATE users SET online = 0, last_seen = CURRENT_TIMESTAMP WHERE id = ?', [currentUserId]);
          io.emit('user_status_changed', { userId: currentUserId, online: false, lastSeen: new Date().toISOString() });
        }
      }
    });
  });
};

module.exports = setupSocketHandlers;
