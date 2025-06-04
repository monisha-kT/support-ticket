// import { useState, useEffect } from 'react';
// import io from 'socket.io-client';

// let socket = null;
// let connectionPromise = null;

// export const validateToken = async (token) => {
//   try {
//     const response = await fetch('http://localhost:5000/api/auth/validate', {
//       method: 'GET',
//       headers: { Authorization: `Bearer ${token}` },
//     });
//     const data = await response.json();
//     if (!response.ok) {
//       console.warn('Token validation failed:', response.status, data.error);
//       return false;
//     }
//     return true;
//   } catch (err) {
//     console.error('Token validation error:', err.message);
//     return false;
//   }
// };

// const initSocket = async () => {
//   if (socket && socket.connected) {
//     console.log('Socket already connected:', socket.id);
//     return socket;
//   }

//   const token = localStorage.getItem('token');
//   if (!token) {
//     console.warn('No token available for socket connection');
//     return null;
//   }

//   const isValid = await validateToken(token);
//   if (!isValid) {
//     console.warn('Invalid token, clearing auth data');
//     return null;
//   }

//   socket = io('http://localhost:5000', {
//     query: { token },
//     transports: ['websocket', 'polling'],
//     reconnection: true,
//     reconnectionAttempts: 5,
//     reconnectionDelay: 2000,
//     timeout: 10000,
//   });

//   return new Promise((resolve, reject) => {
//     const timeoutId = setTimeout(() => {
//       socket.disconnect();
//       socket = null;
//       reject(new Error('Socket connection timed out after 15 seconds'));
//     }, 15000);

//     socket.on('connect', () => {
//       clearTimeout(timeoutId);
//       console.log('Socket connected:', socket.id);
//       resolve(socket);
//     });

//     socket.on('connect_error', (error) => {
//       clearTimeout(timeoutId);
//       console.error('Socket connection error:', error.message);
//       socket = null;
//       reject(new Error(`Socket connection failed: ${error.message}`));
//     });

//     socket.on('error', (error) => {
//       console.error('Socket error:', error.message || error);
//     });

//     socket.on('disconnect', (reason) => {
//       console.log('Socket disconnected:', reason);
//       socket = null;
//     });
//   });
// };

// export const getSocket = async () => {
//   if (socket && socket.connected) {
//     return socket;
//   }

//   if (connectionPromise) {
//     return connectionPromise;
//   }

//   connectionPromise = initSocket().finally(() => {
//     connectionPromise = null;
//   });

//   try {
//     socket = await connectionPromise;
//     return socket;
//   } catch (error) {
//     console.error('Failed to get socket:', error.message);
//     return null;
//   }
// };

// export const disconnectSocket = () => {
//   if (socket) {
//     socket.off('connect');
//     socket.off('connect_error');
//     socket.off('error');
//     socket.off('disconnect');
//     socket.disconnect();
//     console.log('Socket disconnected');
//     socket = null;
//   }
// };

// export const useSocket = () => {
//   const [isConnected, setIsConnected] = useState(socket?.connected || false);
//   const [error, setError] = useState(null);

//   useEffect(() => {
//     const initializeSocket = async () => {
//       try {
//         const socketInstance = await getSocket();
//         if (!socketInstance) {
//           setError('Failed to initialize socket: No valid token or connection failed');
//           setIsConnected(false);
//           return;
//         }

//         setIsConnected(socketInstance.connected);
//         setError(null);

//         socketInstance.on('connect', () => {
//           setIsConnected(true);
//           setError(null);
//         });

//         socketInstance.on('disconnect', (reason) => {
//           setIsConnected(false);
//           setError(`Socket disconnected: ${reason}`);
//         });

//         socketInstance.on('error', (err) => {
//           setError(err.message || 'Socket error');
//           setIsConnected(false);
//         });

//         socketInstance.on('connect_error', (err) => {
//           setError(err.message || 'Connection error');
//           setIsConnected(false);
//         });

//         return () => {
//           socketInstance.off('connect');
//           socketInstance.off('disconnect');
//           socketInstance.off('error');
//           socketInstance.off('connect_error');
//         };
//       } catch (err) {
//         setError(err.message || 'Failed to initialize socket');
//         setIsConnected(false);
//       }
//     };

//     initializeSocket();
//   }, []);

//   return { isConnected, error };
// };


import { useState, useEffect } from 'react';
import io from 'socket.io-client';

class EventEmitter {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  emit(event, ...args) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(...args);
        } catch (err) {
          console.error(`Error in ${event} listener:`, err);
        }
      });
    }
  }
}

const socketEmitter = new EventEmitter();

let socket = null;
let connectionPromise = null;
let isConnecting = false;
let hasLoggedSocket = false;

// Token validation
export const validateToken = async (token) => {
  try {
    const response = await fetch('http://localhost:5000/api/auth/validate', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || 'Token validation failed';
      const status = response.status;
      throw new Error(JSON.stringify({ message: errorMessage, status }));
    }
    return { valid: true };
  } catch (err) {
    let errorDetails;
    try {
      errorDetails = JSON.parse(err.message);
    } catch {
      errorDetails = { message: err.message, status: 500 };
    }
    console.error('Token validation error:', errorDetails.message, `Status: ${errorDetails.status}`);
    return { valid: false, error: errorDetails.message, status: errorDetails.status };
  }
};

const setupSocketListeners = () => {
  if (socket._listenersInitialized) return;
  socket._listenersInitialized = true;

  const events = [
    'new_ticket',
    'ticket_reassigned',
    'ticket_status_update',
    'reassignment_notification',
    'ticket_accepted',
    'ticket_rejected',
    'ticket_closed',
    'ticket_reopened',
    'chat_inactive',
  ];

  events.forEach(event => {
    socket.on(event, (data) => {
      console.log(`Emitting ${event} event`, data ?? '');
      socketEmitter.emit(event, data);
    });
  });
};

const initSocket = async () => {
  if (socket && socket.connected) {
    if (!hasLoggedSocket) {
      console.log('Returning existing socket:', socket.id);
      hasLoggedSocket = true;
    }
    return socket;
  }

  if (isConnecting) {
    return connectionPromise;
  }

  isConnecting = true;
  const token = localStorage.getItem('token');
  if (!token) {
    console.warn('No token for socket connection');
    isConnecting = false;
    return null;
  }

  const validationResult = await validateToken(token);
  if (!validationResult.valid) {
    localStorage.removeItem('token');
    isConnecting = false;
    return null;
  }

  socket = io('http://localhost:5000', {
    query: { token },
    transports: ['websocket', 'polling'],
    reconnection: false,
    timeout: 10000,
  });

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
      console.error('Socket connection timed out');
      isConnecting = false;
      reject(new Error('Socket connection timed out'));
    }, 15000);

    socket.on('connect', () => {
      clearTimeout(timeoutId);
      setupSocketListeners();
      console.log('Socket connected:', socket.id);
      isConnecting = false;
      resolve(socket);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connect error:', error.message);
      clearTimeout(timeoutId);
      socket = null;
      isConnecting = false;
      reject(error);
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error.message || error);
      socketEmitter.emit('socket_error', error.message || error);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      socket = null;
      socketEmitter.emit('socket_disconnect', reason);
    });
  });
};

export const getSocket = async () => {
  if (socket && socket.connected) {
    if (!hasLoggedSocket) {
      console.log('Returning existing socket:', socket.id);
      hasLoggedSocket = true;
    }
    return socket;
  }

  if (connectionPromise) {
    try {
      return await connectionPromise;
    } catch (err) {
      connectionPromise = null;
    }
  }

  connectionPromise = initSocket().finally(() => {
    connectionPromise = null;
  });

  try {
    return await connectionPromise;
  } catch (err) {
    console.error('Socket connection failed:', err.message);
    throw err;
  }
};

export const disconnectSocket = () => {
  if (socket) {
    try {
      const socketId = socket.id;
      socket.disconnect();
      console.log('Socket manually disconnected:', socketId);
    } catch (err) {
      console.error('Error disconnecting socket:', err.message);
    } finally {
      socket = null;
      hasLoggedSocket = false;
    }
  }
};

export const socketEvents = {
  on: (event, callback) => socketEmitter.on(event, callback),
  off: (event, callback) => socketEmitter.off(event, callback),
};

export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cleanup = () => {};

    const initializeSocket = async () => {
      try {
        const socketInstance = await getSocket();
        if (!socketInstance) {
          setError('Failed to initialize socket');
          return;
        }

        setIsConnected(socketInstance.connected);

        const onConnect = () => setIsConnected(true);
        const onDisconnect = (reason) => {
          setIsConnected(false);
          setError(`Disconnected: ${reason}`);
        };
        const onError = (err) => setError(err || 'Socket error');
        const onConnectError = (err) => setError(err || 'Connection error');

        socketInstance.on('connect', onConnect);
        socketInstance.on('disconnect', onDisconnect);
        socketInstance.on('error', onError);
        socketInstance.on('connect_error', onConnectError);

        const handleSocketError = (err) => setError(err || 'Socket error');
        const handleSocketDisconnect = (reason) => {
          setIsConnected(false);
          setError(`Disconnected: ${reason}`);
        };

        socketEmitter.on('socket_error', handleSocketError);
        socketEmitter.on('socket_disconnect', handleSocketDisconnect);

        cleanup = () => {
          socketInstance.off('connect', onConnect);
          socketInstance.off('disconnect', onDisconnect);
          socketInstance.off('error', onError);
          socketInstance.off('connect_error', onConnectError);
          socketEmitter.off('socket_error', handleSocketError);
          socketEmitter.off('socket_disconnect', handleSocketDisconnect);
        };
      } catch (err) {
        setError(err.message);
        console.error('useSocket error:', err.message);
      }
    };

    initializeSocket();
    return () => cleanup();
  }, []);

  return { isConnected, error };
};
