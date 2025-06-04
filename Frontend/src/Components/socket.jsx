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

// Simple Event Emitter for broadcasting socket events to components
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
let isConnecting = false; // Prevent multiple simultaneous connection attempts

// Enhanced token validation with detailed error codes
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

const initSocket = async () => {
  if (socket && socket.connected) {
    console.log('Socket already connected:', socket.id);
    return socket;
  }

  if (isConnecting) {
    console.log('Socket connection already in progress, awaiting result');
    return connectionPromise;
  }

  isConnecting = true;
  console.log('Initiating socket connection at:', new Date().toISOString());

  const token = localStorage.getItem('token');
  if (!token) {
    console.warn('No token found for socket connection');
    isConnecting = false;
    return null;
  }

  const validationResult = await validateToken(token);
  if (!validationResult.valid) {
    console.warn('Invalid token, removing from localStorage');
    localStorage.removeItem('token');
    isConnecting = false;
    return null;
  }

  socket = io('http://localhost:5000', {
    query: { token },
    transports: ['websocket', 'polling'],
    reconnection: false, // We'll handle reconnection manually
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    timeout: 10000,
  });

  // Set up global socket event listeners once
  const setupSocketListeners = () => {
    socket.on('new_ticket', (data) => {
      console.log('Emitting new_ticket event:', data);
      socketEmitter.emit('new_ticket', data);
    });

    socket.on('ticket_reassigned', (data) => {
      console.log('Emitting ticket_reassigned event:', data);
      socketEmitter.emit('ticket_reassigned', data);
    });

    socket.on('ticket_status_update', () => {
      console.log('Emitting ticket_status_update event');
      socketEmitter.emit('ticket_status_update');
    });

    socket.on('reassignment_notification', (data) => {
      console.log('Emitting reassignment_notification event:', data);
      socketEmitter.emit('reassignment_notification', data);
    });

    socket.on('ticket_accepted', (data) => {
      console.log('Emitting ticket_accepted event:', data);
      socketEmitter.emit('ticket_accepted', data);
    });

    socket.on('ticket_rejected', (data) => {
      console.log('Emitting ticket_rejected event:', data);
      socketEmitter.emit('ticket_rejected', data);
    });

    socket.on('ticket_closed', (data) => {
      console.log('Emitting ticket_closed event:', data);
      socketEmitter.emit('ticket_closed', data);
    });

    socket.on('ticket_reopened', () => {
      console.log('Emitting ticket_reopened event');
      socketEmitter.emit('ticket_reopened');
    });

    socket.on('chat_inactive', (data) => {
      console.log('Emitting chat_inactive event:', data);
      socketEmitter.emit('chat_inactive', data);
    });
  };

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
      console.log('Socket connected at:', new Date().toISOString(), 'Socket ID:', socket.id);
      clearTimeout(timeoutId);
      setupSocketListeners(); // Set up listeners only after connection
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
    console.log('Returning existing socket:', socket.id);
    return socket;
  }

  if (connectionPromise) {
    try {
      console.log('Awaiting existing connection promise');
      return await connectionPromise;
    } catch (err) {
      console.error('Previous connection attempt failed:', err.message);
      connectionPromise = null;
    }
  }

  console.log('Initiating new socket connection');
  connectionPromise = initSocket().finally(() => {
    console.log('Connection promise resolved');
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
      const socketId = socket.id; // Store ID before disconnecting
      socket.disconnect();
      console.log('Socket disconnected manually at:', new Date().toISOString(), 'Socket ID:', socketId || 'N/A');
    } catch (err) {
      console.error('Error disconnecting socket:', err.message);
    } finally {
      socket = null;
    }
  } else {
    console.log('No socket to disconnect');
  }
};

// Expose the event emitter for components to subscribe to socket events
export const socketEvents = {
  on: (event, callback) => socketEmitter.on(event, callback),
  off: (event, callback) => socketEmitter.off(event, callback),
};

// Hook to manage socket connection state
export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
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

        // Subscribe to socket events via the emitter
        const handleSocketError = (err) => setError(err || 'Socket error');
        const handleSocketDisconnect = (reason) => {
          setIsConnected(false);
          setError(`Disconnected: ${reason}`);
        };

        socketEmitter.on('socket_error', handleSocketError);
        socketEmitter.on('socket_disconnect', handleSocketDisconnect);

        return () => {
          socketInstance.off('connect', onConnect);
          socketInstance.off('disconnect', onDisconnect);
          socketInstance.off('error', onError);
          socketInstance.off('connect_error', onConnectError);
          socketEmitter.off('socket_error', handleSocketError);
          socketEmitter.off('socket_disconnect', handleSocketDisconnect);
        };
      } catch (err) {
        setError(err.message);
        console.error('useSocket initialization error:', err.message);
      }
    };

    initializeSocket();
  }, []);

  return { isConnected, error };
};