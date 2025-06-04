// import React, { useState, useEffect } from 'react';
// import {
//   Drawer,
//   Box,
//   Typography,
//   List,
//   ListItem,
//   ListItemText,
//   IconButton,
//   Divider,
//   Button,
//   CircularProgress,
//   Alert,
// } from '@mui/material';
// import CloseIcon from '@mui/icons-material/Close';
// import ThumbUpIcon from '@mui/icons-material/ThumbUp';
// import ThumbDownIcon from '@mui/icons-material/ThumbDown';
// import { useNavigate } from 'react-router-dom';
// import { getSocket, addSocketListener } from './socket';

// function NotificationDrawer({ open, onClose, notifications }) {
//   const navigate = useNavigate();
//   const [tickets, setTickets] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState(null);

//   const fetchOpenTickets = async () => {
//     setLoading(true);
//     try {
//       const token = localStorage.getItem('token');
//       if (!token) throw new Error('No token');

//       const res = await fetch('http://localhost:5000/api/tickets', {
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       });

//       if (!res.ok) throw new Error('Failed to fetch tickets');

//       const data = await res.json();
//       const openTickets = data.filter((ticket) => ticket.status === 'open');
//       setTickets(openTickets);
//       setError(null);
//     } catch (err) {
//       setError(err.message);
//       if (err.message.includes('No token') || err.message.includes('Unauthorized')) {
//         localStorage.removeItem('token');
//         localStorage.removeItem('user');
//         navigate('/auth');
//       }
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     if (open) {
//       fetchOpenTickets();
//     }
//     const socket = getSocket();
//     if (!socket) return;

//     addSocketListener('new_ticket', () => {
//       console.log('New ticket received in NotificationDrawer');
//       fetchOpenTickets();
//     });

//     addSocketListener('ticket_accepted', () => {
//       console.log('Ticket accepted in NotificationDrawer');
//       fetchOpenTickets();
//     });

//     addSocketListener('ticket_rejected', () => {
//       console.log('Ticket rejected in NotificationDrawer');
//       fetchOpenTickets();
//     });

//     return () => {
//       console.log('Cleaning up socket listeners in NotificationDrawer');
//       // Listeners are managed by addSocketListener
//     };
//   }, [open]);

//   const handleAcceptTicket = async (ticketId) => {
//     try {
//       const token = localStorage.getItem('token');
//       const res = await fetch(`http://localhost:5000/api/tickets/${ticketId}/accept`, {
//         method: 'POST',
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       });

//       if (!res.ok) throw new Error('Failed to accept ticket');

//       await fetchOpenTickets();
//       onClose();
//     } catch (err) {
//       setError(err.message);
//       if (err.message.includes('Unauthorized')) {
//         localStorage.removeItem('token');
//         localStorage.removeItem('user');
//         navigate('/auth');
//       }
//     }
//   };

//   const handleRejectTicket = async (ticketId) => {
//     try {
//       const token = localStorage.getItem('token');
//       const res = await fetch(`http://localhost:5000/api/tickets/${ticketId}/reject`, {
//         method: 'POST',
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       });

//       if (!res.ok) throw new Error('Failed to reject ticket');

//       await fetchOpenTickets();
//     } catch (err) {
//       setError(err.message);
//       if (err.message.includes('Unauthorized')) {
//         localStorage.removeItem('token');
//         localStorage.removeItem('user');
//         navigate('/auth');
//       }
//     }
//   };

//   return (
//     <Drawer
//       anchor="right"
//       open={open}
//       onClose={onClose}
//       PaperProps={{
//         sx: { width: 350 },
//       }}
//     >
//       <Box sx={{ p: 2 }}>
//         <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
//           <Typography variant="h6">Notifications</Typography>
//           <IconButton onClick={onClose}>
//             <CloseIcon />
//           </IconButton>
//         </Box>

//         {notifications?.length > 0 && (
//           <Box sx={{ mb: 2 }}>
//             {notifications.map((notification, index) => (
//               <Alert key={index} severity={notification.type} sx={{ mb: 1 }}>
//                 {notification.message}
//               </Alert>
//             ))}
//           </Box>
//         )}

//         <Typography variant="subtitle1" sx={{ mb: 1 }}>New Tickets</Typography>
//         {loading ? (
//           <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
//             <CircularProgress />
//           </Box>
//         ) : error ? (
//           <Alert severity="error" sx={{ m: 2 }}>
//             {error}
//           </Alert>
//         ) : tickets.length === 0 ? (
//           <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 3 }}>
//             No new tickets available
//           </Typography>
//         ) : (
//           <List>
//             {tickets.map((ticket) => (
//               <React.Fragment key={ticket.id}>
//                 <ListItem
//                   sx={{
//                     display: 'flex',
//                     flexDirection: 'column',
//                     alignItems: 'stretch',
//                     gap: 1,
//                   }}
//                 >
//                   <ListItemText
//                     primary={`Ticket #${ticket.id}`}
//                     secondary={
//                       <>
//                         <Typography variant="body2" component="span" display="block">
//                           Category: {ticket.category}
//                         </Typography>
//                         <Typography variant="body2" component="span" display="block">
//                           Priority: {ticket.priority}
//                         </Typography>
//                         <Typography variant="body2" component="span" display="block">
//                           Description: {ticket.description}
//                         </Typography>
//                       </>
//                     }
//                   />
//                   <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', width: '100%' }}>
//                     <Button
//                       startIcon={<ThumbUpIcon />}
//                       onClick={() => handleAcceptTicket(ticket.id)}
//                       color="success"
//                       variant="outlined"
//                       size="small"
//                     >
//                       Accept
//                     </Button>
//                     <Button
//                       startIcon={<ThumbDownIcon />}
//                       onClick={() => handleRejectTicket(ticket.id)}
//                       color="error"
//                       variant="outlined"
//                       size="small"
//                     >
//                       Reject
//                     </Button>
//                   </Box>
//                 </ListItem>
//                 <Divider />
//               </React.Fragment>
//             ))}
//           </List>
//         )}
//       </Box>
//     </Drawer>
//   );
// }

// export default NotificationDrawer;
import React, { useState, useEffect, useCallback,useRef } from 'react';
import {
  Drawer,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Divider,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import { useNavigate } from 'react-router-dom';
import { getSocket, disconnectSocket } from './socket';
import { debounce } from 'lodash';

function NotificationDrawer({ open, onClose, notifications }) {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const socketInitialized = useRef(false); // Track if socket was successfully initialized

  const fetchOpenTickets = useCallback(async () => {
    console.log('Fetching open tickets at:', new Date().toISOString());
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token');

      const res = await fetch('http://localhost:5000/api/tickets', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to fetch tickets');

      const data = await res.json();
      const openTickets = data.filter((ticket) => ticket.status === 'open');
      setTickets(openTickets);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Fetch open tickets error:', err.message);
      if (err.message.includes('No token') || err.message.includes('Unauthorized')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/auth');
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const debouncedFetchOpenTickets = useCallback(debounce(fetchOpenTickets, 500), [fetchOpenTickets]);

  useEffect(() => {
    if (!open) return;

    debouncedFetchOpenTickets();

    const initializeSocket = async () => {
      try {
        const socket = await getSocket();
        if (!socket) return;

        socketInitialized.current = true; // Mark socket as initialized

        const handleNewTicket = () => {
          console.log('New ticket received in NotificationDrawer');
          debouncedFetchOpenTickets();
        };
        const handleTicketAccepted = () => {
          console.log('Ticket accepted in NotificationDrawer');
          debouncedFetchOpenTickets();
        };
        const handleTicketRejected = () => {
          console.log('Ticket rejected in NotificationDrawer');
          debouncedFetchOpenTickets();
        };

        socket.on('new_ticket', handleNewTicket);
        socket.on('ticket_accepted', handleTicketAccepted);
        socket.on('ticket_rejected', handleTicketRejected);

        return () => {
          socket.off('new_ticket', handleNewTicket);
          socket.off('ticket_accepted', handleTicketAccepted);
          socket.off('ticket_rejected', handleTicketRejected);
          console.log('Cleaned up socket listeners in NotificationDrawer');
        };
      } catch (err) {
        console.error('NotificationDrawer socket initialization error:', err.message);
      }
    };

    initializeSocket();

    return () => {
      if (socketInitialized.current) {
        disconnectSocket();
        socketInitialized.current = false;
      }
    };
  }, [open, debouncedFetchOpenTickets]);

  const handleAcceptTicket = async (ticketId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/tickets/${ticketId}/accept`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to accept ticket');

      await debouncedFetchOpenTickets();
      onClose();
    } catch (err) {
      setError(err.message);
      if (err.message.includes('Unauthorized')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/auth');
      }
    }
  };

  const handleRejectTicket = async (ticketId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/tickets/${ticketId}/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to reject ticket');

      await debouncedFetchOpenTickets();
    } catch (err) {
      setError(err.message);
      if (err.message.includes('Unauthorized')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/auth');
      }
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: 350 },
      }}
    >
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Notifications</Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>

        {notifications?.length > 0 && (
          <Box sx={{ mb: 2 }}>
            {notifications.map((notification, index) => (
              <Alert key={index} severity={notification.type} sx={{ mb: 1 }}>
                {notification.message}
              </Alert>
            ))}
          </Box>
        )}

        <Typography variant="subtitle1" sx={{ mb: 1 }}>New Tickets</Typography>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        ) : tickets.length === 0 ? (
          <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 3 }}>
            No new tickets available
          </Typography>
        ) : (
          <List>
            {tickets.map((ticket) => (
              <React.Fragment key={ticket.id}>
                <ListItem
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    gap: 1,
                  }}
                >
                  <ListItemText
                    primary={`Ticket #${ticket.id}`}
                    secondary={
                      <>
                        <Typography variant="body2" component="span" display="block">
                          Category: {ticket.category}
                        </Typography>
                        <Typography variant="body2" component="span" display="block">
                          Priority: {ticket.priority}
                        </Typography>
                        <Typography variant="body2" component="span" display="block">
                          Description: {ticket.description}
                        </Typography>
                      </>
                    }
                  />
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', width: '100%' }}>
                    <Button
                      startIcon={<ThumbUpIcon />}
                      onClick={() => handleAcceptTicket(ticket.id)}
                      color="success"
                      variant="outlined"
                      size="small"
                    >
                      Accept
                    </Button>
                    <Button
                      startIcon={<ThumbDownIcon />}
                      onClick={() => handleRejectTicket(ticket.id)}
                      color="error"
                      variant="outlined"
                      size="small"
                    >
                      Reject
                    </Button>
                  </Box>
                </ListItem>
                <Divider />
              </React.Fragment>
            ))}
          </List>
        )}
      </Box>
    </Drawer>
  );
}

export default NotificationDrawer;