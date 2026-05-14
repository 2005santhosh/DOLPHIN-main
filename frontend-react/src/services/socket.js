import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://api.dolphinorg.in';

let socket = null;
let userId = null;

// Initialize socket connection
export const initializeSocket = (currentUserId) => {
  if (socket && socket.connected) {
    return socket;
  }

  userId = currentUserId;

  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    timeout: 10000,
    withCredentials: true,
  });

  socket.on('connect', () => {
    console.log('🔌 Socket connected:', socket.id);
    if (userId) {
      socket.emit('join', userId);
    }
  });

  socket.on('connect_error', (err) => {
    console.warn('Socket connection failed:', err.message);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  return socket;
};

// Get socket instance
export const getSocket = () => {
  return socket;
};

// Disconnect socket
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// Socket event listeners
export const onReceiveMessage = (callback) => {
  if (socket) {
    socket.on('receiveMessage', callback);
  }
};

export const onNewRequest = (callback) => {
  if (socket) {
    socket.on('newRequest', callback);
  }
};

export const onRequestStatusUpdate = (callback) => {
  if (socket) {
    socket.on('requestStatusUpdate', callback);
  }
};

export const onNewNotification = (callback) => {
  if (socket) {
    socket.on('newNotification', callback);
  }
};

// Remove event listeners
export const offReceiveMessage = () => {
  if (socket) {
    socket.off('receiveMessage');
  }
};

export const offNewRequest = () => {
  if (socket) {
    socket.off('newRequest');
  }
};

export const offRequestStatusUpdate = () => {
  if (socket) {
    socket.off('requestStatusUpdate');
  }
};

export const offNewNotification = () => {
  if (socket) {
    socket.off('newNotification');
  }
};

export default {
  initializeSocket,
  getSocket,
  disconnectSocket,
  onReceiveMessage,
  onNewRequest,
  onRequestStatusUpdate,
  onNewNotification,
  offReceiveMessage,
  offNewRequest,
  offRequestStatusUpdate,
  offNewNotification,
};
