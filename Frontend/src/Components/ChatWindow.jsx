// import React, { useState, useEffect, useRef, useReducer, useCallback, useMemo } from 'react';
// import {
//   Box, TextField, IconButton, Paper, Typography, Avatar,
//   CircularProgress, Alert, IconButton as MuiIconButton
// } from '@mui/material';
// import SendIcon from '@mui/icons-material/Send';
// import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
// import useStore from '../store/useStore';
// import { getSocket } from './socket';
// import { useNavigate } from 'react-router-dom';
// import { debounce } from 'lodash';

// const API_URL = (() => {
//   try {
//     if (typeof process !== 'undefined' && process.env) {
//       return process.env.REACT_APP_API_URL || 'http://localhost:5000';
//     }
//     if (typeof import.meta !== 'undefined' && import.meta.env) {
//       return import.meta.env.VITE_API_URL || 'http://localhost:5000';
//     }
//     return 'http://localhost:5000';
//   } catch (e) {
//     console.warn('Error accessing environment variables:', e);
//     return 'http://localhost:5000';
//   }
// })();

// // Reducer for messages and ticketStatus
// const chatReducer = (state, action) => {
//   console.log('Reducer action:', action.type, action.payload);
//   switch (action.type) {
//     case 'ADD_MESSAGE':
//       // If message with same id exists, ignore
//       if (state.messages.some((msg) => msg.id === action.payload.id)) {
//         console.warn('Duplicate message ignored:', action.payload.id);
//         return state; // Prevent duplicates
//       }
//       // If incoming message is from server (not optimistic), remove matching optimistic message
//       if (!action.payload.isOptimistic) {
//         const filteredMessages = state.messages.filter(msg => {
//           if (!msg.isOptimistic) return true;
//           // Remove optimistic message if same sender, message content, and timestamp close enough (within 5 seconds)
//           const sameSender = msg.sender_id === action.payload.sender_id;
//           const sameMessage = msg.message === action.payload.message;
//           const timeDiff = Math.abs(new Date(msg.timestamp) - new Date(action.payload.timestamp));
//           return !(sameSender && sameMessage && timeDiff < 5000);
//         });
//         const newState = { ...state, messages: [...filteredMessages, action.payload] };
//         console.log('New state after reconciling optimistic message:', newState);
//         return newState;
//       }
//       // For optimistic messages, just add
//       const newState = { ...state, messages: [...state.messages, action.payload] };
//       console.log('New state:', newState);
//       return newState;
//     case 'SET_MESSAGES':
//       const newMessages = action.payload.filter(
//         (msg) => !state.messages.some((existing) => existing.id === msg.id)
//       );
//       return { ...state, messages: [...state.messages, ...newMessages] };
//     case 'SET_TICKET_STATUS':
//       return { ...state, ticketStatus: action.payload };
//     default:
//       return state;
//   }
// };

// function ChatWindow({ ticketId, readOnly = false, initialMessages = [], inactivityTimeout = 120000 }) {
//   const [message, setMessage] = useState('');
//   const [chatState, dispatch] = useReducer(chatReducer, {
//     messages: initialMessages,
//     ticketStatus: null
//   });
//   // const [loading, setLoading] = useState(Boolean(ticketId && !initialMessages.length));
//   const [loading, setLoading] = useState();
//   const [error, setError] = useState('');
//   const [showScrollButton, setShowScrollButton] = useState(false);
//   const messagesEndRef = useRef(null);
//   const scrollContainerRef = useRef(null);
//   const socketRef = useRef(null);
//   const user = useStore((state) => state.user);
//   const inactivityTimerRef = useRef(null);
//   const lastSentMessageRef = useRef(null);
//   const reconnectAttemptsRef = useRef(0);
//   const navigate = useNavigate();

//  const renderCount = useRef(0);
//   useEffect(() => {
//     renderCount.current += 1;
//     console.log(`Render #${renderCount.current} for ChatWindow, ticketId: ${ticketId}`);
//   },[]);

//   // Clear error after 5 seconds
//   useEffect(() => {
//     if (error) {
//       const timer = setTimeout(() => setError(''), 5000);
//       return () => clearTimeout(timer);
//     }
//   }, [error]);

//   // Fetch messages
//   const fetchMessages = useCallback(async () => {
//     if (!ticketId || loading) return;
//     const token = localStorage.getItem('token');
//     if (!token) {
//       setError('Please log in to view messages.');
//       navigate('/');
//       return;
//     }
//     try {
//       setLoading(true);
//       const response = await fetch(`${API_URL}/api/chats/${ticketId}`, {
//         headers: { Authorization: `Bearer ${token}` }
//       });
//       if (!response.ok) {
//         throw new Error('Failed to fetch messages');
//       }
//       const data = await response.json();
//       dispatch({ type: 'SET_MESSAGES', payload: data });
//     } catch (error) {
//       console.error('Fetch Messages Error:', error);
//       setError('Unable to load messages.');
//       if (error.message.includes('token') || error.message.includes('Unauthorized')) {
//         localStorage.removeItem('token');
//         localStorage.removeItem('user');
//         navigate('/');
//       }
//     } finally {
//       setLoading(false);
//     }
//   }, [ticketId, navigate]);

//   // Initialize socket with reconnection logic
//   const initializeSocket = useCallback(async () => {
//     setLoading(true);
//     try {
//       const socketInstance = await getSocket();
//       if (!socketInstance) {
//         throw new Error('Socket initialization failed.');
//       }

//       socketRef.current = socketInstance;
//       console.log('Emitting join for ticket:', ticketId);
//       socketInstance.emit('join', { ticket_id: ticketId });

//       socketInstance.on('connect', () => {
//         console.log('WebSocket connected for ticket:', ticketId);
//         setError('');
//         reconnectAttemptsRef.current = 0;
//       });

//       socketInstance.on('disconnect', (reason) => {
//         console.log('WebSocket disconnected for ticket:', ticketId, 'Reason:', reason);
//       });

//       socketInstance.on('message', (newMessage) => {
//         console.log('Socket message event received full:', newMessage);
//         // Relax ticket_id check: accept message if ticket_id matches or is missing but sender_id matches current user or message has no ticket_id
//         const messageTicketId = newMessage.ticket_id || newMessage.ticketId || null;
//         if (messageTicketId === String(ticketId) || !messageTicketId) {
//           console.log('Dispatching ADD_MESSAGE for message:', newMessage);
//           dispatch({
//             type: 'ADD_MESSAGE',
//             payload: {
//               id: newMessage.id || crypto.randomUUID(),
//               message: newMessage.message,
//               sender_id: newMessage.sender_id,
//               sender_name: newMessage.sender_name || (newMessage.sender_id === user.id ? `${user.firstName} ${user.lastName}` : 'Unknown'),
//               timestamp: newMessage.timestamp || new Date().toISOString(),
//               is_system: false
//             }
//           });
//         } else {
//           console.warn('Message ignored, ticket_id mismatch:', newMessage.ticket_id, ticketId);
//         }
//       });

//       socketInstance.on('ticket_closed', ({ ticket_id, reason, reassigned_to, status }) => {
//         if (ticket_id !== String(ticketId)) return;
//         dispatch({ type: 'SET_TICKET_STATUS', payload: status || 'closed' });
//         dispatch({
//           type: 'ADD_MESSAGE',
//           payload: {
//             id: crypto.randomUUID(),
//             message: `Ticket ${status === 'assigned' ? 'reassigned' : 'closed'}. Reason: ${reason}${reassigned_to ? `. Reassigned to member ID ${reassigned_to}` : ''}`,
//             timestamp: new Date().toISOString(),
//             is_system: true
//           }
//         });
//       });

//       socketInstance.on('ticket_reopened', ({ ticket_id }) => {
//         if (ticket_id !== String(ticketId)) return;
//         dispatch({ type: 'SET_TICKET_STATUS', payload: 'assigned' });
//         dispatch({
//           type: 'ADD_MESSAGE',
//           payload: {
//             id: crypto.randomUUID(),
//             message: 'Ticket has been reopened',
//             timestamp: new Date().toISOString(),
//             is_system: true
//           }
//         });
//       });

//       socketInstance.on('ticket_inactive', ({ ticket_id, status, reason }) => {
//         if (ticket_id !== String(ticketId)) return;
//         dispatch({ type: 'SET_TICKET_STATUS', payload: status || 'inactive' });
//         dispatch({
//           type: 'ADD_MESSAGE',
//           payload: {
//             id: crypto.randomUUID(),
//             message: reason || 'Ticket marked as inactive due to 2-minute inactivity',
//             timestamp: new Date().toISOString(),
//             is_system: true
//           }
//         });
//       });

//       socketInstance.on('connect_error', (err) => {
//         console.error('Socket connection error:', err.message);
//         setError('Failed to connect to chat. Retrying...');
//         reconnectAttemptsRef.current += 1;
//         const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 30000);
//         setTimeout(initializeSocket, delay);
//       });

//       if (!chatState.messages.length) {
//         await fetchMessages();
//       }
//     } catch (err) {
//       console.error('Socket initialization error:', err);
//       setError('Unable to connect. Please try again.');
//       navigate('/');
//     } finally {
//       setLoading(false);
//     }
//   }, [ticketId, navigate, fetchMessages]);

//   useEffect(() => {
//     if (readOnly || !ticketId || ticketId === 'null') {
//       setLoading(false);
//       return;
//     }

//     initializeSocket();

//     return () => {
//       if (socketRef.current) {
//         socketRef.current.emit('leave', { ticket_id: ticketId });
//         socketRef.current.off('message');
//         socketRef.current.off('ticket_closed');
//         socketRef.current.off('ticket_reopened');
//         socketRef.current.off('ticket_inactive');
//         socketRef.current.off('connect_error');
//         socketRef.current.off('connect');
//       }
//       if (inactivityTimerRef.current) {
//         clearTimeout(inactivityTimerRef.current);
//       }
//     };
//   }, [initializeSocket, ticketId, readOnly]);

//   // Fetch ticket status
//   const fetchTicketStatus = useCallback(async () => {
//     try {
//       const token = localStorage.getItem('token');
//       if (!token) {
//         throw new Error('No authentication token found');
//       }
//       const response = await fetch(`${API_URL}/api/tickets/${ticketId}`, {
//         headers: { Authorization: `Bearer ${token}` }
//       });
//       if (!response.ok) {
//         throw new Error('Failed to fetch ticket status');
//       }
//       const data = await response.json();
//       dispatch({ type: 'SET_TICKET_STATUS', payload: data.status });
//     } catch (error) {
//       console.error('Error fetching ticket status:', error);
//       setError('Unable to load ticket status.');
//       if (error.message.includes('token') || error.message.includes('Unauthorized')) {
//         localStorage.removeItem('token');
//         localStorage.removeItem('user');
//         navigate('/');
//       }
//     }
//   }, [ticketId, navigate]);

//   useEffect(() => {
//     if (!readOnly && ticketId && ticketId !== 'null') {
//       fetchTicketStatus();
//       const pollingInterval = setInterval(() => {
//         if (chatState.ticketStatus !== 'closed' && !socketRef.current?.connected) {
//           fetchTicketStatus();
//         }
//       }, 30000);
//       return () => clearInterval(pollingInterval);
//     }
//   }, [fetchTicketStatus, ticketId, readOnly, chatState.ticketStatus]);


  
//   // Fallback polling when socket is disconnected
//   useEffect(() => {
//     if (!readOnly && ticketId && ticketId !== 'null' && !socketRef.current?.connected) {
//       console.log('Starting polling for ticket:', ticketId);
//       const pollingInterval = setInterval(fetchMessages, 100000); // Poll every 10 seconds
//       return () => clearInterval(pollingInterval);
//     }
//   }, [ticketId, readOnly, fetchMessages]);

//   // Handle inactivity timeout
//   useEffect(() => {
//     if (inactivityTimeout && !readOnly && ticketId && chatState.ticketStatus !== 'closed') {
//       const resetTimer = () => {
//         if (inactivityTimerRef.current) {
//           clearTimeout(inactivityTimerRef.current);
//         }
//         inactivityTimerRef.current = setTimeout(() => {
//           console.log('Inactivity timeout triggered for ticket:', ticketId);
//           if (socketRef.current) {
//             socketRef.current.emit('inactivity_timeout', { ticket_id: ticketId });
//             dispatch({ type: 'SET_TICKET_STATUS', payload: 'pending_inactive' });
//           }
//         }, inactivityTimeout);
//       };

//       resetTimer();

//       const debouncedActivity = debounce(resetTimer, 500);
//       window.addEventListener('keydown', debouncedActivity);
//       window.addEventListener('mousemove', debouncedActivity);

//       return () => {
//         if (inactivityTimerRef.current) {
//           clearTimeout(inactivityTimerRef.current);
//         }
//         window.removeEventListener('keydown', debouncedActivity);
//         window.removeEventListener('mousemove', debouncedActivity);
//         debouncedActivity.cancel();
//       };
//     }
//   }, [inactivityTimeout, ticketId, readOnly, chatState.ticketStatus]);

//   // Force scroll to bottom on initial load or new messages
//   useEffect(() => {
//     if (chatState.messages.length && scrollContainerRef.current && !loading) {
//       console.log('Scrolling to bottom, messages:', chatState.messages.length);
//       messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
//     }
//   }, [loading, chatState.messages]);

//   // Handle scrolling and auto-scroll logic
//   useEffect(() => {
//     if (!scrollContainerRef.current) return;

//     const scrollContainer = scrollContainerRef.current;
//     const isNearBottom = () => {
//       const threshold = 100;
//       return scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < threshold;
//     };

//     const handleScroll = debounce(() => {
//       setShowScrollButton(!isNearBottom());
//     }, 50);

//     if (isNearBottom() || lastSentMessageRef.current) {
//       messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//       lastSentMessageRef.current = null;
//     }

//     setShowScrollButton(!isNearBottom());
//     scrollContainer.addEventListener('scroll', handleScroll);
//     return () => {
//       scrollContainer.removeEventListener('scroll', handleScroll);
//       handleScroll.cancel();
//     };
//   }, [chatState.messages]);

//   const handleSend = async () => {
//     if (!message.trim() || !socketRef.current || chatState.ticketStatus === 'closed') return;
//     try {
//       // Optimistically add the message to chat state for instant UI update
//       const tempId = crypto.randomUUID();
//       const newMessage = {
//         id: tempId,
//         message: message.trim(),
//         sender_id: user.id,
//         sender_name: `${user.firstName} ${user.lastName}`,
//         timestamp: new Date().toISOString(),
//         is_system: false,
//         isOptimistic: true
//       };
//       dispatch({ type: 'ADD_MESSAGE', payload: newMessage });

//       socketRef.current.emit('message', {
//         ticket_id: ticketId,
//         sender_id: user.id,
//         sender_name: `${user.firstName} ${user.lastName}`,
//         message: message.trim(),
//         timestamp: new Date().toISOString()
//       });
//       setMessage('');
//       lastSentMessageRef.current = true;
//       if (inactivityTimerRef.current) {
//         clearTimeout(inactivityTimerRef.current);
//         inactivityTimerRef.current = setTimeout(() => {
//           console.log('Inactivity timeout triggered for ticket:', ticketId);
//           socketRef.current?.emit('inactivity_timeout', { ticket_id: ticketId });
//           dispatch({ type: 'SET_TICKET_STATUS', payload: 'pending_inactive' });
//         }, inactivityTimeout);
//       }
//     } catch (err) {
//       setError('Failed to send message.');
//     }
//   };

//   const handleKeyPress = (e) => {
//     if (e.key === 'Enter' && !e.shiftKey) {
//       e.preventDefault();
//       handleSend();
//     }
//   };

//   const scrollToBottom = () => {
//     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//     setShowScrollButton(false);
//   };

//   const isMessageInputDisabled = readOnly || chatState.ticketStatus === 'closed';

//   const groupedMessages = useMemo(() => {
//     console.log('Computing groupedMessages:', chatState.messages);
//     return chatState.messages.reduce((acc, message) => {
//       const date = new Intl.DateTimeFormat('en-US', {
//         month: 'long',
//         day: 'numeric',
//         year: 'numeric'
//       }).format(new Date(message.timestamp));
//       if (!acc[date]) {
//         acc[date] = [];
//       }
//       acc[date].push(message);
//       return acc;
//     }, {});
//   }, [chatState.messages]);

//   if (loading) {
//     return (
//       <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
//         <CircularProgress />
//       </Box>
//     );
//   }

//   if (error) {
//     return (
//       <Box sx={{ p: 2 }}>
//         <Alert severity="error">{error}</Alert>
//       </Box>
//     );
//   }

//   console.log('Rendering ChatWindow with messages:', chatState.messages);

//   return (
//     <Box sx={{
//       display: 'flex',
//       flexDirection: 'column',
//       width: '100%',
//       height: '100%',
//       bgcolor: '#f5f6f5',
//       borderRadius: 2,
//       overflowX: 'auto',
//     }}>
//       <Box
//         ref={scrollContainerRef}
//         sx={{
//           flex: 1,
//           p: 2,
//           overflow: 'auto',
//           display: 'flex',
//           flexDirection: 'column',
//           gap: 2,
//           minHeight: '200px',
//           '&::-webkit-scrollbar': {
//             width: '10px'
//           },
//           '&::-webkit-scrollbar-track': {
//             bgcolor: '#e5e7eb'
//           },
//           '&::-webkit-scrollbar-thumb': {
//             bgcolor: '#6b7280',
//             borderRadius: '5px',
//             '&:hover': { bgcolor: '#4b5563' }
//           },
//           scrollbarWidth: 'thin',
//           scrollbarColor: '#6b7280 #e5e7eb'
//         }}
//       >
//         {Object.entries(groupedMessages).map(([date, dateMessages]) => (
//           <React.Fragment key={date}>
//             <Box sx={{
//               display: 'flex',
//               justifyContent: 'center',
//               my: 1
//             }}>
//               <Paper sx={{
//                 px: 2,
//                 py: 0.5,
//                 borderRadius: 10,
//                 bgcolor: '#e0f2fe'
//               }}>
//                 <Typography variant="caption" fontWeight="medium">{date}</Typography>
//               </Paper>
//             </Box>
//             {dateMessages.map((msg, index) => (
//               <Box
//                 key={msg.id || index}
//                 sx={{
//                   display: 'flex',
//                   flexDirection: 'column',
//                   alignItems: msg.sender_id === user.id ? 'flex-end' : 'flex-start',
//                   mb: 2
//                 }}
//               >
//                 {msg.is_system ? (
//                   <Typography variant="caption" sx={{
//                     textAlign: 'center',
//                     color: 'text.secondary',
//                     my: 1,
//                     bgcolor: '#f0f0f0',
//                     px: 2,
//                     py: 1,
//                     borderRadius: 10
//                   }}>
//                     {msg.message}
//                   </Typography>
//                 ) : (
//                   <Box sx={{
//                     display: 'flex',
//                     flexDirection: msg.sender_id === user.id ? 'row-reverse' : 'row',
//                     alignItems: 'flex-start',
//                     gap: 1,
//                     maxWidth: '70%'
//                   }}>
//                     <Avatar sx={{
//                       width: 36,
//                       height: 36,
//                       bgcolor: msg.sender_id === user.id ? '#10b981' : '#6b7280'
//                     }}>
//                       {msg.sender_name?.charAt(0).toUpperCase() || 'U'}
//                     </Avatar>
//                     <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
//                       <Typography
//                         variant="caption"
//                         sx={{
//                           color: 'text.secondary',
//                           fontWeight: 'medium',
//                           ml: msg.sender_id === user.id ? 0 : 1,
//                           mr: msg.sender_id === user.id ? 1 : 0
//                         }}
//                       >
//                         {msg.sender_name}
//                       </Typography>
//                       <Paper
//                         sx={{
//                           p: 1.5,
//                           borderRadius: msg.sender_id === user.id ?
//                             '16px 16px 4px 16px' : '16px 16px 16px 4px',
//                           bgcolor: msg.sender_id === user.id ? '#d1fae5' : 'white'
//                         }}
//                       >
//                         <Typography variant="body2">{msg.message}</Typography>
//                         <Typography
//                           variant="caption"
//                           sx={{
//                             display: 'block',
//                             textAlign: 'right',
//                             mt: 0.5,
//                             color: 'text.secondary',
//                             fontSize: '0.65rem'
//                           }}
//                         >
//                           {new Intl.DateTimeFormat('en-US', {
//                             hour: 'numeric',
//                             minute: '2-digit',
//                             hour12: true
//                           }).format(new Date(msg.timestamp))}
//                         </Typography>
//                       </Paper>
//                     </Box>
//                   </Box>
//                 )}
//               </Box>
//             ))}
//           </React.Fragment>
//         ))}
//         <div ref={messagesEndRef} />
//       </Box>
//       {showScrollButton && (
//         <MuiIconButton
//           onClick={scrollToBottom}
//           sx={{
//             position: 'absolute',
//             bottom: readOnly ? 16 : 80,
//             right: 16,
//             bgcolor: '#10b981',
//             color: 'white',
//             '&:hover': { bgcolor: '#059669' },
//             boxShadow: 2
//           }}
//           aria-label="Scroll to bottom"
//         >
//           <ArrowDownwardIcon />
//         </MuiIconButton>
//       )}
//       {!readOnly && (
//         <Box sx={{
//           p: 2,
//           bgcolor: '#f9fafb',
//           borderTop: '1px solid #e5e7eb'
//         }}>
//           {chatState.ticketStatus === 'closed' && (
//             <Alert severity="info" sx={{ mb: 1, borderRadius: 2 }}>
//               This ticket is closed. No new messages can be sent.
//             </Alert>
//           )}
//           <Box sx={{
//             display: 'flex',
//             gap: 1,
//             alignItems: 'center',
//             bgcolor: 'white',
//             p: 1,
//             borderRadius: 2
//           }}>
//             <TextField
//               fullWidth
//               size="small"
//               placeholder={chatState.ticketStatus === 'closed' ? "Ticket is closed" : "Type a message..."}
//               value={message}
//               onChange={(e) => setMessage(e.target.value)}
//               onKeyPress={handleKeyPress}
//               disabled={isMessageInputDisabled}
//               sx={{
//                 '& .MuiOutlinedInput-root': {
//                   borderRadius: 2,
//                   '& fieldset': { border: 'none' }
//                 }
//               }}
//               aria-label="Type a message"
//             />
//             <IconButton
//               onClick={handleSend}
//               disabled={isMessageInputDisabled || !message.trim()}
//               sx={{
//                 bgcolor: isMessageInputDisabled ? '#e5e7eb' : '#10b981',
//                 color: isMessageInputDisabled ? '#9ca3af' : 'white',
//                 '&:hover': { bgcolor: isMessageInputDisabled ? '#e5e7eb' : '#059669' },
//                 borderRadius: 1
//               }}
//               aria-label="Send message"
//             >
//               <SendIcon fontSize="small" />
//             </IconButton>
//           </Box>
//         </Box>
//       )}
//     </Box>
//   );
// }

// export default ChatWindow;


import React, { useState, useEffect, useRef, useReducer, useCallback, useMemo } from 'react';
import {
  Box, TextField, IconButton, Paper, Typography, Avatar,
  CircularProgress, Alert, IconButton as MuiIconButton
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import useStore from '../store/useStore';
import { getSocket } from './socket';
import { useNavigate } from 'react-router-dom';
import { debounce } from 'lodash';

const API_URL = (() => {
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env.REACT_APP_API_URL || 'http://localhost:5000';
    }
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env.VITE_API_URL || 'http://localhost:5000';
    }
    return 'http://localhost:5000';
  } catch (e) {
    console.warn('Error accessing environment variables:', e);
    return 'http://localhost:5000';
  }
})();

const chatReducer = (state, action) => {
  console.log('Reducer action:', action.type, action.payload);
  switch (action.type) {
    case 'ADD_MESSAGE':
      if (state.messages.some((msg) => msg.id === action.payload.id)) {
        console.warn('Duplicate message ignored:', action.payload.id);
        return state;
      }
      if (!action.payload.isOptimistic) {
        const filteredMessages = state.messages.filter(msg => {
          if (!msg.isOptimistic) return true;
          const sameSender = msg.sender_id === action.payload.sender_id;
          const sameMessage = msg.message === action.payload.message;
          const timeDiff = Math.abs(new Date(msg.timestamp) - new Date(action.payload.timestamp));
          return !(sameSender && sameMessage && timeDiff < 5000);
        });
        return { ...state, messages: [...filteredMessages, action.payload] };
      }
      return { ...state, messages: [...state.messages, action.payload] };
    case 'SET_MESSAGES':
      const newMessages = action.payload.filter(
        (msg) => !state.messages.some((existing) => existing.id === msg.id)
      );
      return { ...state, messages: [...state.messages, ...newMessages] };
    case 'SET_TICKET_STATUS':
      return { ...state, ticketStatus: action.payload };
    default:
      return state;
  }
};

function ChatWindow({ ticketId, readOnly = false, initialMessages = [], inactivityTimeout = 120000 }) {
  const [message, setMessage] = useState('');
  const [chatState, dispatch] = useReducer(chatReducer, {
    messages: initialMessages,
    ticketStatus: null
  });
  const [loading, setLoading] = useState(Boolean(ticketId && !initialMessages.length));
  const [error, setError] = useState('');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const socketRef = useRef(null);
  const user = useStore((state) => state.user);
  const inactivityTimerRef = useRef(null);
  const lastSentMessageRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const navigate = useNavigate();

  const renderCount = useRef(0);
  useEffect(() => {
    renderCount.current += 1;
    console.log(`Render #${renderCount.current} for ChatWindow, ticketId: ${ticketId}`);
  }, []);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const fetchMessages = useCallback(async () => {
    if (!ticketId || loading) return;
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Please log in to view messages.');
      navigate('/');
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/chats/${ticketId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }
      const data = await response.json();
      dispatch({ type: 'SET_MESSAGES', payload: data });
    } catch (error) {
      console.error('Fetch Messages Error:', error);
      setError('Unable to load messages.');
      if (error.message.includes('token') || error.message.includes('Unauthorized')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/');
      }
    } finally {
      setLoading(false);
    }
  }, [ticketId, navigate]);

  const initializeSocket = useCallback(async () => {
    setLoading(true);
    try {
      const socketInstance = await getSocket();
      if (!socketInstance) {
        throw new Error('Socket initialization failed.');
      }

      socketRef.current = socketInstance;
      console.log('Emitting join for ticket:', ticketId);
      socketInstance.emit('join', { ticket_id: ticketId });

      socketInstance.on('connect', () => {
        console.log('WebSocket connected for ticket:', ticketId);
        setError('');
        reconnectAttemptsRef.current = 0;
        socketInstance.emit('get_ticket_status', { ticket_id: ticketId });
      });

      socketInstance.on('disconnect', (reason) => {
        console.log('WebSocket disconnected for ticket:', ticketId, 'Reason:', reason);
      });

      socketInstance.on('message', (newMessage) => {
        console.log('Socket message event received:', newMessage);
        const messageTicketId = newMessage.ticket_id || newMessage.ticketId || null;
        if (messageTicketId === String(ticketId) || !messageTicketId) {
          dispatch({
            type: 'ADD_MESSAGE',
            payload: {
              id: newMessage.id || crypto.randomUUID(),
              message: newMessage.message,
              sender_id: newMessage.sender_id,
              sender_name: newMessage.sender_name ||'Unknown',
              receiver_id: newMessage.receiver_id || null,
              receiver_name: newMessage.receiver_name || null,
              timestamp: newMessage.timestamp || new Date().toISOString(),
              is_system: false
            }
          });
        } else {
          console.warn('Message ignored, ticket_id mismatch:', newMessage.ticket_id, ticketId);
        }
      });

      socketInstance.on('ticket_status', ({ ticket_id, status }) => {
        if (ticket_id !== String(ticketId)) return;
        dispatch({ type: 'SET_TICKET_STATUS', payload: status });
        dispatch({
          type: 'ADD_MESSAGE',
          payload: {
            id: crypto.randomUUID(),
            message: `Ticket status updated to: ${status}`,
            timestamp: new Date().toISOString(),
            is_system: true
          }
        });
      });

      socketInstance.on('ticket_closed', ({ ticket_id, reason, reassigned_to, status }) => {
        if (ticket_id !== String(ticketId)) return;
        dispatch({ type: 'SET_TICKET_STATUS', payload: status || 'closed' });
        dispatch({
          type: 'ADD_MESSAGE',
          payload: {
            id: crypto.randomUUID(),
            message: `Ticket ${status === 'assigned' ? 'reassigned' : 'closed'}. Reason: ${reason}${reassigned_to ? `. Reassigned to member ID ${reassigned_to}` : ''}`,
            timestamp: new Date().toISOString(),
            is_system: true
          }
        });
      });

      socketInstance.on('ticket_reopened', ({ ticket_id }) => {
        if (ticket_id !== String(ticketId)) return;
        dispatch({ type: 'SET_TICKET_STATUS', payload: 'assigned' });
        dispatch({
          type: 'ADD_MESSAGE',
          payload: {
            id: crypto.randomUUID(),
            message: 'Ticket has been reopened',
            timestamp: new Date().toISOString(),
            is_system: true
          }
        });
      });

      socketInstance.on('ticket_inactive', ({ ticket_id, status, reason }) => {
        if (ticket_id !== String(ticketId)) return;
        dispatch({ type: 'SET_TICKET_STATUS', payload: status || 'inactive' });
        dispatch({
          type: 'ADD_MESSAGE',
          payload: {
            id: crypto.randomUUID(),
            message: reason || 'Ticket marked as inactive due to 2-minute inactivity',
            timestamp: new Date().toISOString(),
            is_system: true
          }
        });
      });

      socketInstance.on('connect_error', (err) => {
        console.error('Socket connection error:', err.message);
        setError('Failed to connect to chat. Retrying...');
        reconnectAttemptsRef.current += 1;
        const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 30000);
        setTimeout(initializeSocket, delay);
      });

      if (!chatState.messages.length) {
        await fetchMessages();
      }
    } catch (err) {
      console.error('Socket initialization error:', err);
      setError('Unable to connect. Please try again.');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [ticketId, navigate, fetchMessages]);

  useEffect(() => {
    if (readOnly || !ticketId || ticketId === 'null') {
      setLoading(false);
      return;
    }

    initializeSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave', { ticket_id: ticketId });
        socketRef.current.off('message');
        socketRef.current.off('ticket_status');
        socketRef.current.off('ticket_closed');
        socketRef.current.off('ticket_reopened');
        socketRef.current.off('ticket_inactive');
        socketRef.current.off('connect_error');
        socketRef.current.off('connect');
      }
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [initializeSocket, ticketId, readOnly]);

  useEffect(() => {
    if (inactivityTimeout && !readOnly && ticketId && chatState.ticketStatus !== 'closed') {
      const resetTimer = () => {
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current);
        }
        inactivityTimerRef.current = setTimeout(() => {
          console.log('Inactivity timeout triggered for ticket:', ticketId);
          if (socketRef.current) {
            socketRef.current.emit('inactivity_timeout', { ticket_id: ticketId });
            dispatch({ type: 'SET_TICKET_STATUS', payload: 'pending_inactive' });
          }
        }, inactivityTimeout);
      };

      resetTimer();

      const debouncedActivity = debounce(resetTimer, 500);
      window.addEventListener('keydown', debouncedActivity);
      window.addEventListener('mousemove', debouncedActivity);

      return () => {
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current);
        }
        window.removeEventListener('keydown', debouncedActivity);
        window.removeEventListener('mousemove', debouncedActivity);
        debouncedActivity.cancel();
      };
    }
  }, [inactivityTimeout, ticketId, readOnly, chatState.ticketStatus]);

  useEffect(() => {
    if (chatState.messages.length && scrollContainerRef.current && !loading) {
      console.log('Scrolling to bottom, messages:', chatState.messages.length);
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [loading, chatState.messages]);

  useEffect(() => {
    if (!scrollContainerRef.current) return;

    const scrollContainer = scrollContainerRef.current;
    const isNearBottom = () => {
      const threshold = 100;
      return scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < threshold;
    };

    const handleScroll = debounce(() => {
      setShowScrollButton(!isNearBottom());
    }, 50);

    if (isNearBottom() || lastSentMessageRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      lastSentMessageRef.current = null;
    }

    setShowScrollButton(!isNearBottom());
    scrollContainer.addEventListener('scroll', handleScroll);
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      handleScroll.cancel();
    };
  }, [chatState.messages]);

  const handleSend = async () => {
    if (!message.trim() || !socketRef.current || chatState.ticketStatus === 'closed') return;
    try {
      const tempId = crypto.randomUUID();
      const newMessage = {
        id: tempId,
        message: message.trim(),
        sender_id: user.id,
        sender_name: `${user.firstName} ${user.lastName}`,
        receiver_id: null,
        receiver_name: null,
        timestamp: new Date().toISOString(),
        is_system: false,
        isOptimistic: true
      };
      dispatch({ type: 'ADD_MESSAGE', payload: newMessage });

      socketRef.current.emit('message', {
        ticket_id: ticketId,
        sender_id: user.id,
        sender_name: `${user.firstName} ${user.lastName}`,
        message: message.trim(),
        timestamp: new Date().toISOString()
      });
      setMessage('');
      lastSentMessageRef.current = true;
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = setTimeout(() => {
          console.log('Inactivity timeout triggered for ticket:', ticketId);
          socketRef.current?.emit('inactivity_timeout', { ticket_id: ticketId });
          dispatch({ type: 'SET_TICKET_STATUS', payload: 'pending_inactive' });
        }, inactivityTimeout);
      }
    } catch (err) {
      setError('Failed to send message.');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollButton(false);
  };

  const isMessageInputDisabled = readOnly || chatState.ticketStatus === 'closed';

  const groupedMessages = useMemo(() => {
    console.log('Computing groupedMessages:', chatState.messages);
    return chatState.messages.reduce((acc, message) => {
      const date = new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      }).format(new Date(message.timestamp));
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(message);
      return acc;
    }, {});
  }, [chatState.messages]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  console.log('Rendering ChatWindow with messages:', chatState.messages);

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      bgcolor: '#f5f6f5',
      borderRadius: 2,
      overflowX: 'auto',
    }}>
      <Box
        ref={scrollContainerRef}
        sx={{
          flex: 1,
          p: 2,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          minHeight: '200px',
          '&::-webkit-scrollbar': {
            width: '10px'
          },
          '&::-webkit-scrollbar-track': {
            bgcolor: '#e5e7eb'
          },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: '#6b7280',
            borderRadius: '5px',
            '&:hover': { bgcolor: '#4b5563' }
          },
          scrollbarWidth: 'thin',
          scrollbarColor: '#6b7280 #e5e7eb'
        }}
      >
        {Object.entries(groupedMessages).map(([date, dateMessages]) => (
          <React.Fragment key={date}>
            <Box sx={{
              display: 'flex',
              justifyContent: 'center',
              my: 1
            }}>
              <Paper sx={{
                px: 2,
                py: 0.5,
                  borderRadius: 10,
                bgcolor: '#e0f2fe'
              }}>
                <Typography variant="caption" fontWeight="medium">{date}</Typography>
              </Paper>
            </Box>
            {dateMessages.map((msg, index) => (
              <Box
                key={msg.id || index}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.sender_id === user.id ? 'flex-end' : 'flex-start',
                  mb: 2
                }}
              >
                {msg.is_system ? (
                  <Typography variant="caption" sx={{
                    textAlign: 'center',
                    color: 'text.secondary',
                    my: 1,
                    bgcolor: '#f0f0f0',
                    px: 2,
                    py: 1,
                    borderRadius: 10
                  }}>
                    {msg.message}
                  </Typography>
                ) : (
                  <Box sx={{
                    display: 'flex',
                    flexDirection: msg.sender_id === user.id ? 'row-reverse' : 'row',
                    alignItems: 'flex-start',
                    gap: 1,
                    maxWidth: '70%'
                  }}>
                    <Avatar sx={{
                      width: 36,
                      height: 36,
                      bgcolor: msg.sender_id === user.id ? '#10b981' : '#6b7280'
                    }}>
                      {msg.sender_name?.charAt(0).toUpperCase() || 'U'}
                    </Avatar>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'text.secondary',
                            fontWeight: 'medium',
                            ml: msg.sender_id === user.id ? 0 : 1,
                            mr: msg.sender_id === user.id ? 1 : 0
                          }}
                        >
                          {msg.sender_name}
                        </Typography>
                        {msg.receiver_name && (
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'text.secondary',
                              fontWeight: 'medium',
                              ml: msg.sender_id === user.id ? 0 : 1,
                              mr: msg.sender_id === user.id ? 1 : 0
                            }}
                          >
                            To: {msg.receiver_name}
                          </Typography>
                        )}
                      </Box>
                      <Paper
                        sx={{
                          p: 1.5,
                          borderRadius: msg.sender_id === user.id ?
                            '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          bgcolor: msg.sender_id === user.id ? '#d1fae5' : 'white'
                        }}
                      >
                        <Typography variant="body2">{msg.message}</Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            textAlign: 'right',
                            mt: 0.5,
                            color: 'text.secondary',
                            fontSize: '0.65rem'
                          }}
                        >
                          {new Intl.DateTimeFormat('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          }).format(new Date(msg.timestamp))}
                        </Typography>
                      </Paper>
                    </Box>
                  </Box>
                )}
              </Box>
            ))}
          </React.Fragment>
        ))}
        <div ref={messagesEndRef} />
      </Box>
      {showScrollButton && (
        <MuiIconButton
          onClick={scrollToBottom}
          sx={{
            position: 'absolute',
            bottom: readOnly ? 16 : 80,
            right: 16,
            bgcolor: '#10b981',
            color: 'white',
            '&:hover': { bgcolor: '#059669' },
            boxShadow: 2
          }}
          aria-label="Scroll to bottom"
        >
          <ArrowDownwardIcon />
        </MuiIconButton>
      )}
      {!readOnly && (
        <Box sx={{
          p: 2,
          bgcolor: '#f9fafb',
          borderTop: '1px solid #e5e7eb'
        }}>
          {chatState.ticketStatus === 'closed' && (
            <Alert severity="info" sx={{ mb: 1, borderRadius: 2 }}>
              This ticket is closed. No new messages can be sent.
            </Alert>
          )}
          <Box sx={{
            display: 'flex',
            gap: 1,
            alignItems: 'center',
            bgcolor: 'white',
            p: 1,
            borderRadius: 2
          }}>
            <TextField
              fullWidth
              size="small"
              placeholder={chatState.ticketStatus === 'closed' ? "Ticket is closed" : "Type a message..."}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isMessageInputDisabled}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  '& fieldset': { border: 'none' }
                }
              }}
              aria-label="Type a message"
            />
            <IconButton
              onClick={handleSend}
              disabled={isMessageInputDisabled || !message.trim()}
              sx={{
                bgcolor: isMessageInputDisabled ? '#e5e7eb' : '#10b981',
                color: isMessageInputDisabled ? '#9ca3af' : 'white',
                '&:hover': { bgcolor: isMessageInputDisabled ? '#e5e7eb' : '#059669' },
                borderRadius: 1
              }}
              aria-label="Send message"
            >
              <SendIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      )}
    </Box>
  );
}

export default ChatWindow;