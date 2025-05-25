import io from 'socket.io-client';
import { useState, useEffect } from 'react';

let socket = null;

const initSocket = () => {
  if (!socket) {
    const token = localStorage.getItem('token');
    if (!token) return null;

    socket = io('http://localhost:5000', {
      query: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 2000,
      timeout: 10000,
    });

    socket.on('connect', () => {
      console.log('Socket connected');
    });

    socket.on('connect_success', (data) => {
      console.log('Socket connected successfully:', data);
    });

    socket.on('connect_error', (error) => {
  console.error('Socket connection error:', error.message, error);
  if (error.message === 'Invalid token') {
    console.log('Invalid token detected, disconnecting');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    socket.disconnect();
    socket = null;
  }
});

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });
  }

  return socket;
};

const getSocket = () => {
  if (socket?.connected) {
    return socket;
  }
  return initSocket();
};

const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      setError('No token available');
      return;
    }

    const handleConnect = () => {
      console.log('Socket connected');
      setIsConnected(true);
      setError(null);
    };

    const handleConnectSuccess = () => {
      setIsConnected(true);
      setError(null);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleError = (err) => {
      console.log('Socket error:', err);
      setError(err.message);
      setIsConnected(false);
    };
    socket.on('connect', handleConnect);
    socket.on('connect_success', handleConnectSuccess);
    socket.on('disconnect', handleDisconnect);
    socket.on('error', handleError);
    socket.on('connect_error', handleError);
    console.log('Socket initialized:', isConnected); 


    return () => {
      socket.off('connect', handleConnect);
      socket.off('connect_success', handleConnectSuccess);
      socket.off('disconnect', handleDisconnect);
      socket.off('error', handleError);
    };
  }, []);

  return { isConnected, error };
};

export { getSocket, disconnectSocket };

// import io from 'socket.io-client';

// let socket = null;

// const initSocket = () => {
//   if (!socket) {
//     const token = localStorage.getItem('token');
//     if (!token) {
//       console.error('No token available for socket connection');
//       return null;
//     }

//     try {
//       socket = io('http://localhost:5000', {
//         query: { token },
//         transports: ['websocket'],
//         reconnection: true,
//         reconnectionAttempts: 5,
//         reconnectionDelay: 1000,
//         reconnectionDelayMax: 5000,
//         timeout: 20000,
//         autoConnect: true
//       });

//       socket.on('connect', () => {
//         console.log('Socket connected');
//       });

//       socket.on('disconnect', (reason) => {
//         console.log('Socket disconnected:', reason);
//         if (reason === 'io server disconnect') {
//           // The server explicitly disconnected, need to manually reconnect
//           socket.connect();
//         }
//       });

//       socket.on('connect_error', (error) => {
//         console.error('Socket connection error:', error);
//         if (error.message === 'Invalid token') {
//           localStorage.removeItem('token');
//           localStorage.removeItem('user');
//           socket.disconnect();
//           socket = null;
//         }
//       });

//       socket.on('error', (error) => {
//         console.error('Socket error:', error);
//       });

//       return socket;
//     } catch (err) {
//       console.error('Socket initialization error:', err);
//       return null;
//     }
//   }
//   return socket;
// };

// const getSocket = () => {
//   if (socket?.connected) {
//     return socket;
//   }
//   return initSocket();
// };

// const disconnectSocket = () => {
//   if (socket) {
//     socket.disconnect();
//     socket = null;
//   }
// };

// export const useSocket = () => {
//   const [isConnected, setIsConnected] = useState(false);
//   const [error, setError] = useState(null);

//   useEffect(() => {
//     const socket = getSocket();
//     if (!socket) {
//       setError('No token available');
//       return;
//     }

//     const handleConnect = () => {
//       setIsConnected(true);
//       setError(null);
//     };

//     const handleDisconnect = () => {
//       setIsConnected(false);
//     };

//     const handleError = (err) => {
//       setError(err.message);
//       setIsConnected(false);
//     };

//     socket.on('connect', handleConnect);
//     socket.on('disconnect', handleDisconnect);
//     socket.on('error', handleError);

//     // Set initial state
//     setIsConnected(socket.connected);
//     if (!socket.connected) {
//       setError('Not connected');
//     }

//     return () => {
//       socket.off('connect', handleConnect);
//       socket.off('disconnect', handleDisconnect);
//       socket.off('error', handleError);
//     };
//   }, []);

//   return { isConnected, error, socket: getSocket() };
// };

// export { getSocket, disconnectSocket };