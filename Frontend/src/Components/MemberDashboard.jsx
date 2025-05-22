// import React, { useState, useEffect, useMemo, useRef } from 'react';
// import {
//   Box, Typography, CircularProgress, Alert, Button, Container, Paper, Modal, Grid, Divider,
//   Dialog, DialogTitle, DialogContent, DialogActions, TextField, Select, MenuItem, FormControl, InputLabel
// } from '@mui/material';
// import { getSocket } from './socket';
// import { useNavigate } from 'react-router-dom';
// import useStore from '../store/useStore';
// import Navbar from './Navbar';
// import { AgGridReact } from 'ag-grid-react';
// import 'ag-grid-community/styles/ag-grid.css';
// import 'ag-grid-community/styles/ag-theme-alpine.css';
// import ChatWindow from './ChatWindow';

// function MemberDashboard() {
//   const [loading, setLoading] = useState(true);
//   const [errors, setErrors] = useState([]);
//   const [tickets, setTickets] = useState([]);
//   const [notifications, setNotifications] = useState([]);
//   const [selectedTicket, setSelectedTicket] = useState(null);
//   const [closeDialogOpen, setCloseDialogOpen] = useState(false);
//   const [closeReason, setCloseReason] = useState('');
//   const [reassignTo, setReassignTo] = useState('');
//   const [members, setMembers] = useState([]);
//   const user = useStore((state) => state.user);
//   const navigate = useNavigate();
//   const socketRef = useRef();
//   const gridRef = useRef();

//   useEffect(() => {
//     console.log('useEffect running, user:', user, 'token:', localStorage.getItem('token') ? 'Found' : 'Missing');
//     const token = localStorage.getItem('token');
//     if (!token || !user) {
//       console.log('No token or user, redirecting to /auth');
//       navigate('/auth');
//       return;
//     }

//     socketRef.current = getSocket();
//     console.log('Socket instance:', socketRef.current);
//     if (socketRef.current) {
//       socketRef.current.on('connect_error', (err) => {
//         console.error('Socket connect error:', err.message);
//         setErrors(prev => [...prev, `Socket connection failed: ${err.message}`]);
//       });
//       socketRef.current.on('new_ticket', (ticket) => {
//         console.log('New ticket received:', ticket);
//         setNotifications(prev => [...prev, {
//           id: ticket.ticket_id,
//           type: 'new',
//           message: `New ticket #${ticket.ticket_id} created`,
//           ticket
//         }]);
//         fetchTickets();
//       });
//       socketRef.current.on('ticket_reassigned', (ticket) => {
//         console.log('Ticket reassigned:', ticket);
//         if (ticket.assigned_to === user.id) {
//           setNotifications(prev => [...prev, {
//             id: ticket.ticket_id,
//             type: 'reassigned',
//             message: `Ticket #${ticket.ticket_id} reassigned to you`,
//             ticket
//           }]);
//           fetchTickets();
//         }
//       });
//       socketRef.current.on('chat_inactive', ({ ticket_id, reason, reassigned_to }) => {
//         console.log('Chat inactive for ticket:', ticket_id, 'Reason:', reason);
//         setTickets(prev => prev.map(t => 
//           t.id === ticket_id ? { ...t, status: 'closed', closure_reason: reason, reassigned_to } : t
//         ));
//         if (selectedTicket?.id === ticket_id) {
//           setSelectedTicket(prev => ({ ...prev, status: 'closed', closure_reason: reason, reassigned_to }));
//         }
//       });
//       socketRef.current.on('ticket_reopened', ({ ticket_id }) => {
//         console.log('Ticket reopened:', ticket_id);
//         fetchTickets();
//       });
//     }

//     fetchTickets();
//     fetchMembers();

//     return () => {
//       if (socketRef.current) {
//         socketRef.current.off('connect_error');
//         socketRef.current.off('new_ticket');
//         socketRef.current.off('ticket_reassigned');
//         socketRef.current.off('chat_inactive');
//         socketRef.current.off('ticket_reopened');
//       }
//     };
//   }, [user, navigate]);

//   const fetchTickets = async () => {
//     console.log('fetchTickets called');
//     try {
//       const token = localStorage.getItem('token');
//       console.log('Token for fetchTickets:', token ? 'Found' : 'Missing', 'Token value:', token);
//       if (!token) {
//         console.log('No token, redirecting to /auth');
//         navigate('/auth');
//         return;
//       }
//       const res = await fetch('http://localhost:5000/api/tickets', {
//         headers: {
//           'Authorization': `Bearer ${token}`,
//         },
//       });
//       console.log('Tickets API response status:', res.status);
//       if (res.status === 401) {
//         console.log('Received 401, clearing token and redirecting to /auth');
//         localStorage.removeItem('token');
//         localStorage.removeItem('user');
//         navigate('/auth');
//         return;
//       }
//       if (res.status === 403) {
//         console.log('Received 403, redirecting to /auth');
//         localStorage.removeItem('token');
//         localStorage.removeItem('user');
//         navigate('/auth');
//         return;
//       }
//       if (!res.ok) {
//         console.error('Tickets API failed with status:', res.status);
//         throw new Error('Failed to fetch tickets');
//       }
//       const data = await res.json();
//       console.log('Tickets API response data:', data);
//       if (!data.length) {
//         console.warn('No tickets returned from API');
//         setTickets([]);
//         return;
//       }
//       const userIds = [...new Set(data.map(ticket => ticket.user_id))];
//       console.log('User IDs:', userIds);
//       const usersRes = await fetch('http://localhost:5000/api/users/bulk', {
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({ user_ids: userIds }),
//       });
//       console.log('Users API response status:', usersRes.status);
//       if (!usersRes.ok) {
//         console.error('Users API failed with status:', usersRes.status);
//         throw new Error('Failed to fetch user details');
//       }
//       const usersData = await usersRes.json();
//       console.log('Users API response data:', usersData);
//       const ticketsWithUserDetails = data.map(ticket => ({
//         ...ticket,
//         userName: usersData[ticket.user_id]
//           ? `${usersData[ticket.user_id].first_name} ${usersData[ticket.user_id].last_name}`
//           : 'Unknown',
//         userEmail: usersData[ticket.user_id]?.email || 'N/A',
//       }));
//       console.log('Tickets with user details:', ticketsWithUserDetails);
//       setTickets(ticketsWithUserDetails);
//       if (selectedTicket) {
//         const updatedSelectedTicket = ticketsWithUserDetails.find(t => t.id === selectedTicket.id);
//         setSelectedTicket(updatedSelectedTicket || null);
//       }
//     } catch (err) {
//       console.error('Error in fetchTickets:', err);
//       setErrors(prev => [...prev, err.message]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const fetchMembers = async () => {
//     console.log('fetchMembers called');
//     try {
//       const token = localStorage.getItem('token');
//       console.log('Token for fetchMembers:', token ? 'Found' : 'Missing', 'Token value:', token);
//       if (!token) {
//         console.log('No token, redirecting to /auth');
//         navigate('/auth');
//         return;
//       }
//       const res = await fetch('http://localhost:5000/api/users/members', {
//         headers: {
//           'Authorization': `Bearer ${token}`,
//         },
//       });
//       console.log('Members API response status:', res.status);
//       if (res.status === 401) {
//         console.log('Received 401, clearing token and redirecting to /auth');
//         localStorage.removeItem('token');
//         localStorage.removeItem('user');
//         navigate('/auth');
//         return;
//       }
//       if (res.status === 403) {
//         console.log('Received 403, redirecting to /auth');
//         localStorage.removeItem('token');
//         localStorage.removeItem('user');
//         navigate('/auth');
//         return;
//       }
//       if (!res.ok) {
//         console.error('Members API failed with status:', res.status);
//         throw new Error('Failed to fetch members');
//       }
//       const data = await res.json();
//       console.log('Members API response data:', data);
//       setMembers(data);
//     } catch (err) {
//       console.error('Error in fetchMembers:', err);
//       setErrors(prev => [...prev, err.message]);
//     }
//   };

//   const handleAcceptTicket = async (ticketId) => {
//     console.log('handleAcceptTicket called for ticketId:', ticketId);
//     try {
//       const token = localStorage.getItem('token');
//       const res = await fetch(`http://localhost:5000/api/tickets/accept/${ticketId}`, {
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//       });
//       console.log('Accept ticket response status:', res.status);
//       if (!res.ok) throw new Error('Failed to accept ticket');
//       setNotifications(prev => prev.filter(n => n.id !== ticketId));
//       fetchTickets();
//     } catch (err) {
//       console.error('Error in handleAcceptTicket:', err);
//       setErrors(prev => [...prev, err.message]);
//     }
//   };

//   const handleRejectTicket = async (ticketId) => {
//     console.log('handleRejectTicket called for ticketId:', ticketId);
//     try {
//       const token = localStorage.getItem('token');
//       const res = await fetch(`http://localhost:5000/api/tickets/reject/${ticketId}`, {
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//       });
//       console.log('Reject ticket response status:', res.status);
//       if (!res.ok) throw new Error('Failed to reject ticket');
//       setNotifications(prev => prev.filter(n => n.id !== ticketId));
//       fetchTickets();
//     } catch (err) {
//       console.error('Error in handleRejectTicket:', err);
//       setErrors(prev => [...prev, err.message]);
//     }
//   };

//   const handleTicketSelect = async (ticketId) => {
//     console.log('handleTicketSelect called with ticketId:', ticketId);
//     try {
//       const token = localStorage.getItem('token');
//       console.log('Token:', token ? 'Found' : 'Missing', 'Token value:', token);
//       if (!token) {
//         throw new Error('No authentication token found');
//       }
//       console.log('Tickets state:', tickets);
//       const ticket = tickets.find(t => t.id === ticketId);
//       console.log('Ticket found:', ticket);
//       if (!ticket) {
//         throw new Error('Could not find ticket details');
//       }
//       console.log('Ticket status:', ticket.status);
//       if (ticket.status !== 'assigned') {
//         throw new Error('Can only chat with assigned tickets');
//       }
//       socketRef.current = getSocket();
//       console.log('Socket instance:', socketRef.current);
//       socketRef.current.emit('join', { ticket_id: ticketId });
//       socketRef.current.on('joined', (data) => {
//         console.log('Joined chat room:', data.room);
//       });
//       console.log('Fetching user and chat for ticket:', ticketId);
//       const [userRes, chatRes] = await Promise.all([
//         fetch(`http://localhost:5000/api/users/${ticket.user_id}`, {
//           headers: {
//             'Authorization': `Bearer ${token}`,
//           },
//         }),
//         fetch(`http://localhost:5000/api/chats/${ticketId}`, {
//           headers: {
//             'Authorization': `Bearer ${token}`,
//           },
//         }),
//       ]);
//       console.log('Fetch responses:', userRes.status, chatRes.status);
//       if (!userRes.ok) throw new Error('Failed to fetch user details');
//       if (!chatRes.ok) {
//         const errorData = await chatRes.json();
//         throw new Error(`Failed to load chat history: ${errorData.message || chatRes.statusText}`);
//       }
//       const userData = await userRes.json();
//       const chatHistory = await chatRes.json();
//       setSelectedTicket({
//         ...ticket,
//         userName: `${userData.first_name} ${userData.last_name}`,
//         userEmail: userData.email,
//         chatHistory,
//       });
//     } catch (err) {
//       console.error('Error in handleTicketSelect:', err);
//       setErrors(prev => [...prev, err.message]);
//     }
//   };

//   const handleCloseTicket = async () => {
//     console.log('handleCloseTicket called for ticket:', selectedTicket?.id);
//     if (!closeReason.trim()) {
//       console.log('Closure reason missing');
//       setErrors(prev => [...prev, 'Closure reason is required']);
//       return;
//     }
//     try {
//       const token = localStorage.getItem('token');
//       const res = await fetch(`http://localhost:5000/api/tickets/${selectedTicket.id}/close`, {
//         method: 'PUT',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//           reason: closeReason,
//           reassign_to: reassignTo || null,
//         }),
//       });
//       console.log('Close ticket response status:', res.status);
//       if (!res.ok) throw new Error('Failed to close ticket');
//       setCloseDialogOpen(false);
//       setCloseReason('');
//       setReassignTo('');
//       fetchTickets();
//       setSelectedTicket(null);
//       if (socketRef.current) {
//         socketRef.current.emit('ticket_closed', {
//           ticket_id: selectedTicket.id,
//           reason: closeReason,
//           reassigned_to: reassignTo || null,
//         });
//       }
//     } catch (err) {
//       console.error('Error in handleCloseTicket:', err);
//       setErrors(prev => [...prev, err.message]);
//     }
//   };

//   const handleReopenTicket = async (ticketId) => {
//     console.log('handleReopenTicket called for ticketId:', ticketId);
//     try {
//       const token = localStorage.getItem('token');
//       const res = await fetch(`http://localhost:5000/api/tickets/${ticketId}/reopen`, {
//         method: 'PUT',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//       });
//       console.log('Reopen ticket response status:', res.status);
//       if (!res.ok) throw new Error('Failed to reopen ticket');
//       fetchTickets();
//       if (socketRef.current) {
//         socketRef.current.emit('ticket_reopened', { ticket_id: ticketId });
//       }
//     } catch (err) {
//       console.error('Error in handleReopenTicket:', err);
//       setErrors(prev => [...prev, err.message]);
//     }
//   };

//   const columnDefs = useMemo(() => [
//     { field: 'id', headerName: 'Ticket ID', sort: 'desc', width: 100 },
//     { field: 'userName', headerName: 'Created By', width: 150 },
//     { field: 'category', headerName: 'Category', width: 120 },
//     { field: 'urgency', headerName: 'Urgency', width: 100 },
//     { field: 'description', headerName: 'Description', flex: 1, width: 150 },
//     { field: 'status', headerName: 'Status', width: 120 },
//     { 
//       field: 'created_at', 
//       headerName: 'Created', 
//       width: 200,
//       valueFormatter: params => new Date(params.value).toLocaleString(),
//     },
//     { 
//       headerName: 'Actions',
//       width: 300,
//       cellRenderer: params => (
//         <Box sx={{ display: 'flex', gap: 1 }}>
//           {params.data.status === 'open' && (
//             <>
//               <Button
//                 variant="contained"
//                 size="small"
//                 color="success"
//                 onClick={() => handleAcceptTicket(params.data.id)}
//               >
//                 Accept
//               </Button>
//               <Button
//                 variant="contained"
//                 size="small"
//                 color="error"
//                 onClick={() => handleRejectTicket(params.data.id)}
//               >
//                 Reject
//               </Button>
//             </>
//           )}
//           {params.data.status === 'assigned' && (
//             <>
//               <Button
//                 variant="contained"
//                 size="small"
//                 onClick={() => {
//                   console.log('Chat button clicked for ticket:', params.data.id);
//                   handleTicketSelect(params.data.id);
//                 }}
//               >
//                 Chat
//               </Button>
//               <Button
//                 variant="outlined"
//                 size="small"
//                 color="error"
//                 onClick={() => {
//                   setSelectedTicket(params.data);
//                   setCloseDialogOpen(true);
//                 }}
//               >
//                 Close
//               </Button>
//             </>
//           )}
//           {params.data.status === 'closed' && (
//             <Button
//               variant="contained"
//               size="small"
//               color="primary"
//               onClick={() => handleReopenTicket(params.data.id)}
//             >
//               Reopen
//             </Button>
//           )}
//         </Box>
//       ),
//     },
//   ], []);

//   const defaultColDef = useMemo(() => ({
//     sortable: true,
//     filter: true,
//     resizable: true,
//     floatingFilter: true,
//   }), []);

//   if (loading) {
//     return (
//       <>
//         <Navbar />
//         <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#f0f2f5' }}>
//           <CircularProgress />
//         </Box>
//       </>
//     );
//   }

//   if (errors.length) {
//     console.log('Errors displayed in UI:', errors);
//     return (
//       <>
//         <Navbar />
//         <Box sx={{ p: 2, mt: 8 }}>
//           {errors.map((error, index) => (
//             <Alert key={index} severity="error">{error}</Alert>
//           ))}
//         </Box>
//       </>
//     );
//   }

//   if (!tickets.length) {
//     console.log('No tickets available, rendering empty state');
//     return (
//       <>
//         <Navbar />
//         <Container sx={{ mt: 8 }}>
//           <Typography variant="h6">No tickets available</Typography>
//         </Container>
//       </>
//     );
//   }

//   return (
//     <>
//       <Navbar />
//       <Container maxWidth="xl" sx={{ mt: 8, mb: 4 }}>
//         <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
//           <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold', fontFamily: 'times new roman', color: 'black', mt: 1 }}>
//             Member Support Dashboard
//           </Typography>
//         </Box>
//         <Box sx={{ flex: 1, p: 2, position: 'relative' }}>
//           <Box
//             className="ag-theme-alpine"
//             sx={{
//               height: '370px',
//               width: '100%',
//               '& .ag-header-cell': { backgroundColor: '#f5f5f5', fontWeight: 'bold' },
//               '& .ag-cell': { display: 'flex', alignItems: 'center' },
//             }}
//           >
//             <AgGridReact
//               ref={gridRef}
//               rowData={tickets}
//               columnDefs={columnDefs}
//               defaultColDef={defaultColDef}
//               pagination={true}
//               paginationPageSize={10}
//               animateRows={true}
//             />
//           </Box>
//         </Box>
//         <Modal
//           open={Boolean(selectedTicket)}
//           onClose={() => {
//             if (socketRef.current) {
//               socketRef.current.off('joined');
//               socketRef.current.emit('leave', { ticket_id: selectedTicket?.id });
//             }
//             setSelectedTicket(null);
//             setErrors(prev => prev.filter(e => e !== 'Could not find ticket details'));
//           }}
//           aria-labelledby="chat-modal"
//           sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
//         >
//           <Paper sx={{ width: '90%', height: '90vh', maxWidth: 1200, p: 3, position: 'relative', overflow: 'hidden' }}>
//             {selectedTicket && (
//               <Grid container spacing={2} sx={{ height: '100%' }}>
//                 <Grid item xs={4}>
//                   <Paper elevation={2} sx={{ p: 2, height: '100%', overflow: 'auto' }}>
//                     <Typography variant="h6" gutterBottom>Ticket Details</Typography>
//                     <Divider sx={{ my: 2 }} />
//                     <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
//                       <Typography><strong>Ticket ID:</strong> #{selectedTicket.id}</Typography>
//                       <Typography><strong>Created By:</strong> {selectedTicket.userName}</Typography>
//                       <Typography><strong>User Email:</strong> {selectedTicket.userEmail}</Typography>
//                       <Typography><strong>Category:</strong> {selectedTicket.category}</Typography>
//                       <Typography><strong>Urgency:</strong> {selectedTicket.urgency}</Typography>
//                       <Typography><strong>Status:</strong> {selectedTicket.status}</Typography>
//                       <Typography><strong>Created:</strong> {new Date(selectedTicket.created_at).toLocaleString()}</Typography>
//                       <Typography><strong>Description:</strong></Typography>
//                       <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f5f5f5' }}>
//                         {selectedTicket.description}
//                       </Paper>
//                       {selectedTicket.status === 'closed' && selectedTicket.closure_reason && (
//                         <>
//                           <Typography><strong>Closure Reason:</strong></Typography>
//                           <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f5f5f5' }}>
//                             {selectedTicket.closure_reason}
//                           </Paper>
//                           {selectedTicket.reassigned_to && (
//                             <Typography><strong>Reassigned To:</strong> {members.find(m => m.id === selectedTicket.reassigned_to)?.name || 'Unknown'}</Typography>
//                           )}
//                         </>
//                       )}
//                     </Box>
//                   </Paper>
//                 </Grid>
//                 <Grid item xs={8}>
//                   <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
//                     <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
//                       <Typography variant="h6">Chat Window</Typography>
//                       <Button
//                         variant="outlined"
//                         onClick={() => {
//                           if (socketRef.current) {
//                             socketRef.current.off('joined');
//                             socketRef.current.emit('leave', { ticket_id: selectedTicket.id });
//                           }
//                           setSelectedTicket(null);
//                         }}
//                       >
//                         Close Chat
//                       </Button>
//                     </Box>
//                     <Box sx={{ flexGrow: 1 }}>
//                       <ChatWindow
//                         ticketId={selectedTicket.id}
//                         initialMessages={selectedTicket.chatHistory || []}
//                         inactivityTimeout={120000}
//                         onSendMessage={(message) => {
//                           if (selectedTicket.status === 'closed') {
//                             setErrors(prev => [...prev, 'Cannot send messages to a closed ticket']);
//                             return;
//                           }
//                           socketRef.current.emit('message', {
//                             ticket_id: selectedTicket.id,
//                             sender_id: user.id,
//                             message,
//                           });
//                         }}
//                       />
//                     </Box>
//                   </Box>
//                 </Grid>
//               </Grid>
//             )}
//           </Paper>
//         </Modal>
//         <Dialog open={closeDialogOpen} onClose={() => setCloseDialogOpen(false)} maxWidth="sm" fullWidth>
//           <DialogTitle>Close Ticket</DialogTitle>
//           <DialogContent>
//             <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
//               <TextField
//                 fullWidth
//                 multiline
//                 rows={4}
//                 label="Reason for Closing"
//                 value={closeReason}
//                 onChange={(e) => setCloseReason(e.target.value)}
//                 required
//               />
//               <FormControl fullWidth>
//                 <InputLabel>Reassign To (Optional)</InputLabel>
//                 <Select
//                   value={reassignTo}
//                   label="Reassign To (Optional)"
//                   onChange={(e) => setReassignTo(e.target.value)}
//                 >
//                   <MenuItem value="">None</MenuItem>
//                   {members.map(member => (
//                     <MenuItem key={member.id} value={member.id}>
//                       {member.name}
//                     </MenuItem>
//                   ))}
//                 </Select>
//               </FormControl>
//             </Box>
//           </DialogContent>
//           <DialogActions>
//             <Button onClick={() => setCloseDialogOpen(false)}>Cancel</Button>
//             <Button
//               variant="contained"
//               onClick={handleCloseTicket}
//               disabled={!closeReason.trim()}
//             >
//               Confirm
//             </Button>
//           </DialogActions>
//         </Dialog>
//         <Box sx={{ position: 'fixed', top: 80, right: 20, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 1 }}>
//           {notifications.map((notification) => (
//             <Alert
//               key={notification.id}
//               severity="info"
//               action={
//                 notification.type === 'new' || notification.type === 'reassigned' ? (
//                   <Box sx={{ display: 'flex', gap: 1 }}>
//                     <Button size="small" onClick={() => handleAcceptTicket(notification.id)}>
//                       Accept
//                     </Button>
//                     <Button size="small" onClick={() => handleRejectTicket(notification.id)}>
//                       Reject
//                     </Button>
//                   </Box>
//                 ) : null
//               }
//             >
//               {notification.message}
//             </Alert>
//           ))}
//         </Box>
//       </Container>
//     </>
//   );
// }

// export default MemberDashboard;



import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, CircularProgress, Alert, Button, Container, Paper, Modal, Grid, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Select, MenuItem, FormControl, InputLabel,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel
} from '@mui/material';
import { getSocket } from './socket';
import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import Navbar from './Navbar';
import ChatWindow from './ChatWindow';

function MemberDashboard() {
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [reassignTo, setReassignTo] = useState('');
  const [members, setMembers] = useState([]);
  const [order, setOrder] = useState('desc');
  const [orderBy, setOrderBy] = useState('created_at');
  const user = useStore((state) => state.user);
  const navigate = useNavigate();
  const socketRef = useRef();

  useEffect(() => {
    console.log('useEffect running, user:', user, 'token:', localStorage.getItem('token') ? 'Found' : 'Missing');
    const token = localStorage.getItem('token');
    if (!token || !user) {
      console.log('No token or user, redirecting to /auth');
      navigate('/auth');
      return;
    }

    socketRef.current = getSocket();
    console.log('Socket instance:', socketRef.current);
    if (socketRef.current) {
      socketRef.current.on('connect_error', (err) => {
        console.error('Socket connect error:', err.message);
        setErrors(prev => [...prev, `Socket connection failed: ${err.message}`]);
      });
      socketRef.current.on('new_ticket', (ticket) => {
        console.log('New ticket received:', ticket);
        setNotifications(prev => [...prev, {
          id: ticket.ticket_id,
          type: 'new',
          message: `New ticket #${ticket.ticket_id} created`,
          ticket
        }]);
        fetchTickets();
      });
      socketRef.current.on('ticket_reassigned', (ticket) => {
        console.log('Ticket reassigned:', ticket);
        if (ticket.assigned_to === user.id) {
          setNotifications(prev => [...prev, {
            id: ticket.ticket_id,
            type: 'reassigned',
            message: `Ticket #${ticket.ticket_id} reassigned to you`,
            ticket
          }]);
          fetchTickets();
        }
      });
      socketRef.current.on('chat_inactive', ({ ticket_id, reason, reassigned_to }) => {
        console.log('Chat inactive for ticket:', ticket_id, 'Reason:', reason);
        setTickets(prev => prev.map(t => 
          t.id === ticket_id ? { ...t, status: 'closed', closure_reason: reason, reassigned_to } : t
        ));
        if (selectedTicket?.id === ticket_id) {
          setSelectedTicket(prev => ({ ...prev, status: 'closed', closure_reason: reason, reassigned_to }));
        }
      });
      socketRef.current.on('ticket_reopened', ({ ticket_id }) => {
        console.log('Ticket reopened:', ticket_id);
        fetchTickets();
      });
    }

    fetchTickets();
    fetchMembers();

    return () => {
      if (socketRef.current) {
        socketRef.current.off('connect_error');
        socketRef.current.off('new_ticket');
        socketRef.current.off('ticket_reassigned');
        socketRef.current.off('chat_inactive');
        socketRef.current.off('ticket_reopened');
      }
    };
  }, [user, navigate]);

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const sortedTickets = () => {
    return [...tickets].sort((a, b) => {
      if (a[orderBy] < b[orderBy]) {
        return order === 'asc' ? -1 : 1;
      }
      if (a[orderBy] > b[orderBy]) {
        return order === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  const fetchTickets = async () => {
    console.log('fetchTickets called');
    try {
      const token = localStorage.getItem('token');
      console.log('Token for fetchTickets:', token ? 'Found' : 'Missing', 'Token value:', token);
      if (!token) {
        console.log('No token, redirecting to /auth');
        navigate('/auth');
        return;
      }
      const res = await fetch('http://localhost:5000/api/tickets', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      console.log('Tickets API response status:', res.status);
      if (res.status === 401) {
        console.log('Received 401, clearing token and redirecting to /auth');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/auth');
        return;
      }
      if (res.status === 403) {
        console.log('Received 403, redirecting to /auth');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/auth');
        return;
      }
      if (!res.ok) {
        console.error('Tickets API failed with status:', res.status);
        throw new Error('Failed to fetch tickets');
      }
      const data = await res.json();
      console.log('Tickets API response data:', data);
      if (!data.length) {
        console.warn('No tickets returned from API');
        setTickets([]);
        return;
      }
      const userIds = [...new Set(data.map(ticket => ticket.user_id))];
      console.log('User IDs:', userIds);
      const usersRes = await fetch('http://localhost:5000/api/users/bulk', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_ids: userIds }),
      });
      console.log('Users API response status:', usersRes.status);
      if (!usersRes.ok) {
        console.error('Users API failed with status:', usersRes.status);
        throw new Error('Failed to fetch user details');
      }
      const usersData = await usersRes.json();
      console.log('Users API response data:', usersData);
      const ticketsWithUserDetails = data.map(ticket => ({
        ...ticket,
        userName: usersData[ticket.user_id]
          ? `${usersData[ticket.user_id].first_name} ${usersData[ticket.user_id].last_name}`
          : 'Unknown',
        userEmail: usersData[ticket.user_id]?.email || 'N/A',
      }));
      console.log('Tickets with user details:', ticketsWithUserDetails);
      setTickets(ticketsWithUserDetails);
      if (selectedTicket) {
        const updatedSelectedTicket = ticketsWithUserDetails.find(t => t.id === selectedTicket.id);
        setSelectedTicket(updatedSelectedTicket || null);
      }
    } catch (err) {
      console.error('Error in fetchTickets:', err);
      setErrors(prev => [...prev, err.message]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    console.log('fetchMembers called');
    try {
      const token = localStorage.getItem('token');
      console.log('Token for fetchMembers:', token ? 'Found' : 'Missing', 'Token value:', token);
      if (!token) {
        console.log('No token, redirecting to /auth');
        navigate('/auth');
        return;
      }
      const res = await fetch('http://localhost:5000/api/users/members', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      console.log('Members API response status:', res.status);
      if (res.status === 401) {
        console.log('Received 401, clearing token and redirecting to /auth');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/auth');
        return;
      }
      if (res.status === 403) {
        console.log('Received 403, redirecting to /auth');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/auth');
        return;
      }
      if (!res.ok) {
        console.error('Members API failed with status:', res.status);
        throw new Error('Failed to fetch members');
      }
      const data = await res.json();
      console.log('Members API response data:', data);
      setMembers(data);
    } catch (err) {
      console.error('Error in fetchMembers:', err);
      setErrors(prev => [...prev, err.message]);
    }
  };

  const handleAcceptTicket = async (ticketId) => {
    console.log('handleAcceptTicket called for ticketId:', ticketId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/tickets/accept/${ticketId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      console.log('Accept ticket response status:', res.status);
      if (!res.ok) throw new Error('Failed to accept ticket');
      setNotifications(prev => prev.filter(n => n.id !== ticketId));
      fetchTickets();
    } catch (err) {
      console.error('Error in handleAcceptTicket:', err);
      setErrors(prev => [...prev, err.message]);
    }
  };

  const handleRejectTicket = async (ticketId) => {
    console.log('handleRejectTicket called for ticketId:', ticketId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/tickets/reject/${ticketId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      console.log('Reject ticket response status:', res.status);
      if (!res.ok) throw new Error('Failed to reject ticket');
      setNotifications(prev => prev.filter(n => n.id !== ticketId));
      fetchTickets();
    } catch (err) {
      console.error('Error in handleRejectTicket:', err);
      setErrors(prev => [...prev, err.message]);
    }
  };

  const handleTicketSelect = async (ticketId) => {
    console.log('handleTicketSelect called with ticketId:', ticketId);
    try {
      const token = localStorage.getItem('token');
      console.log('Token:', token ? 'Found' : 'Missing', 'Token value:', token);
      if (!token) {
        throw new Error('No authentication token found');
      }
      console.log('Tickets state:', tickets);
      const ticket = tickets.find(t => t.id === ticketId);
      console.log('Ticket found:', ticket);
      if (!ticket) {
        throw new Error('Could not find ticket details');
      }
      console.log('Ticket status:', ticket.status);
      if (ticket.status !== 'assigned') {
        throw new Error('Can only chat with assigned tickets');
      }
      socketRef.current = getSocket();
      console.log('Socket instance:', socketRef.current);
      socketRef.current.emit('join', { ticket_id: ticketId });
      socketRef.current.on('joined', (data) => {
        console.log('Joined chat room:', data.room);
      });
      console.log('Fetching user and chat for ticket:', ticketId);
      const [userRes, chatRes] = await Promise.all([
        fetch(`http://localhost:5000/api/users/${ticket.user_id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }),
        fetch(`http://localhost:5000/api/chats/${ticketId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }),
      ]);
      console.log('Fetch responses:', userRes.status, chatRes.status);
      if (!userRes.ok) throw new Error('Failed to fetch user details');
      if (!chatRes.ok) {
        const errorData = await chatRes.json();
        throw new Error(`Failed to load chat history: ${errorData.message || chatRes.statusText}`);
      }
      const userData = await userRes.json();
      const chatHistory = await chatRes.json();
      setSelectedTicket({
        ...ticket,
        userName: `${userData.first_name} ${userData.last_name}`,
        userEmail: userData.email,
        chatHistory,
      });
    } catch (err) {
      console.error('Error in handleTicketSelect:', err);
      setErrors(prev => [...prev, err.message]);
    }
  };

  const handleCloseTicket = async () => {
    console.log('handleCloseTicket called for ticket:', selectedTicket?.id);
    if (!closeReason.trim()) {
      console.log('Closure reason missing');
      setErrors(prev => [...prev, 'Closure reason is required']);
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/tickets/${selectedTicket.id}/close`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: closeReason,
          reassign_to: reassignTo || null,
        }),
      });
      console.log('Close ticket response status:', res.status);
      if (!res.ok) throw new Error('Failed to close ticket');
      setCloseDialogOpen(false);
      setCloseReason('');
      setReassignTo('');
      fetchTickets();
      setSelectedTicket(null);
      if (socketRef.current) {
        socketRef.current.emit('ticket_closed', {
          ticket_id: selectedTicket.id,
          reason: closeReason,
          reassigned_to: reassignTo || null,
        });
      }
    } catch (err) {
      console.error('Error in handleCloseTicket:', err);
      setErrors(prev => [...prev, err.message]);
    }
  };

  const handleReopenTicket = async (ticketId) => {
    console.log('handleReopenTicket called for ticketId:', ticketId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/tickets/${ticketId}/reopen`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      console.log('Reopen ticket response status:', res.status);
      if (!res.ok) throw new Error('Failed to reopen ticket');
      fetchTickets();
      if (socketRef.current) {
        socketRef.current.emit('ticket_reopened', { ticket_id: ticketId });
      }
    } catch (err) {
      console.error('Error in handleReopenTicket:', err);
      setErrors(prev => [...prev, err.message]);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#f0f2f5' }}>
          <CircularProgress />
        </Box>
      </>
    );
  }

  if (errors.length) {
    console.log('Errors displayed in UI:', errors);
    return (
      <>
        <Navbar />
        <Box sx={{ p: 2, mt: 8 }}>
          {errors.map((error, index) => (
            <Alert key={index} severity="error">{error}</Alert>
          ))}
        </Box>
      </>
    );
  }

  if (!tickets.length) {
    console.log('No tickets available, rendering empty state');
    return (
      <>
        <Navbar />
        <Container sx={{ mt: 8 }}>
          <Typography variant="h6">No tickets available</Typography>
        </Container>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <Container maxWidth="xl" sx={{ mt: 8, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold', fontFamily: 'times new roman', color: 'black', mt: 1 }}>
            Member Support Dashboard
          </Typography>
        </Box>
        <Box sx={{ flex: 1, p: 2, position: 'relative',fontFamily: 'times new roman' }}>
          <TableContainer component={Paper} sx={{ maxHeight: '370px',fontFamily: 'times new roman' }}>
            <Table stickyHeader aria-label="tickets table">
              <TableHead>
                <TableRow>
                  <TableCell>
                    <TableSortLabel
                      active={orderBy === 'id'}
                      direction={orderBy === 'id' ? order : 'asc'}
                      onClick={() => handleRequestSort('id')}
                    >
                      Ticket ID
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={orderBy === 'userName'}
                      direction={orderBy === 'userName' ? order : 'asc'}
                      onClick={() => handleRequestSort('userName')}
                    >
                      Created By
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={orderBy === 'category'}
                      direction={orderBy === 'category' ? order : 'asc'}
                      onClick={() => handleRequestSort('category')}
                    >
                      Category
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={orderBy === 'urgency'}
                      direction={orderBy === 'urgency' ? order : 'asc'}
                      onClick={() => handleRequestSort('urgency')}
                    >
                      Urgency
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={orderBy === 'status'}
                      direction={orderBy === 'status' ? order : 'asc'}
                      onClick={() => handleRequestSort('status')}
                    >
                      Status
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={orderBy === 'created_at'}
                      direction={orderBy === 'created_at' ? order : 'asc'}
                      onClick={() => handleRequestSort('created_at')}
                    >
                      Created
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedTickets().map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell>#{ticket.id}</TableCell>
                    <TableCell>{ticket.userName}</TableCell>
                    <TableCell>{ticket.category}</TableCell>
                    <TableCell>{ticket.urgency}</TableCell>
                    <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ticket.description}
                    </TableCell>
                    <TableCell>{ticket.status}</TableCell>
                    <TableCell>{new Date(ticket.created_at).toLocaleString()}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {ticket.status === 'open' && (
                          <>
                            <Button
                              variant="contained"
                              size="small"
                              color="success"
                              onClick={() => handleAcceptTicket(ticket.id)}
                            >
                              Accept
                            </Button>
                            <Button
                              variant="contained"
                              size="small"
                              color="error"
                              onClick={() => handleRejectTicket(ticket.id)}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {ticket.status === 'assigned' && (
                          <>
                            <Button
                              variant="contained"
                              size="small"
                              onClick={() => handleTicketSelect(ticket.id)}
                            >
                              Chat
                            </Button>
                            <Button
                              variant="outlined"
                              size="small"
                              color="error"
                              onClick={() => {
                                setSelectedTicket(ticket);
                                setCloseDialogOpen(true);
                              }}
                            >
                              Close
                            </Button>
                          </>
                        )}
                        {ticket.status === 'closed' && (
                          <Button
                            variant="contained"
                            size="small"
                            color="primary"
                            onClick={() => handleReopenTicket(ticket.id)}
                          >
                            Reopen
                          </Button>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
        <Modal
          open={Boolean(selectedTicket)}
          onClose={() => {
            if (socketRef.current) {
              socketRef.current.off('joined');
              socketRef.current.emit('leave', { ticket_id: selectedTicket?.id });
            }
            setSelectedTicket(null);
            setErrors(prev => prev.filter(e => e !== 'Could not find ticket details'));
          }}
          aria-labelledby="chat-modal"
          sx={{ display: 'flex',
             alignItems: 'center', 
             justifyContent: 'center',
            overflow: 'auto',
             p: { xs: 6, md: 3 },
           }}
        >
          <Paper sx={{ p:2, 
          height: '80%',
          overflowX:'auto',
          width: { xs: '90%', sm: '90%', md: '80%' } ,
          height: { xs: '90vh', sm: '90vh' }}}>
            {selectedTicket && (
              <Grid container spacing={2} sx={{ height: '80%' }}>
                <Grid item xs={4}>
                  <Paper elevation={2} sx={{ml:3, p: 2, overflowX: 'auto' ,width: 400, height: 500 }}>
                    <Typography variant="h6" gutterBottom>Ticket Details</Typography>
                    <Divider sx={{ my: 2 }} />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Typography><strong>Ticket ID:</strong> #{selectedTicket.id}</Typography>
                      <Typography><strong>Created By:</strong> {selectedTicket.userName}</Typography>
                      <Typography><strong>User Email:</strong> {selectedTicket.userEmail}</Typography>
                      <Typography><strong>Category:</strong> {selectedTicket.category}</Typography>
                      <Typography><strong>Urgency:</strong> {selectedTicket.urgency}</Typography>
                      <Typography><strong>Status:</strong> {selectedTicket.status}</Typography>
                      <Typography><strong>Created:</strong> {new Date(selectedTicket.created_at).toLocaleString()}</Typography>
                      <Typography><strong>Description:</strong></Typography>
                      <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                        {selectedTicket.description}
                      </Paper>
                      {selectedTicket.status === 'closed' && selectedTicket.closure_reason && (
                        <>
                          <Typography><strong>Closure Reason:</strong></Typography>
                          <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f5f5f5', }}>
                            {selectedTicket.closure_reason}
                          </Paper>
                          {selectedTicket.reassigned_to && (
                            <Typography><strong>Reassigned To:</strong> {members.find(m => m.id === selectedTicket.reassigned_to)?.name || 'Unknown'}</Typography>
                          )}
                        </>
                      )}
                    </Box>
                  </Paper>
                </Grid>
                <Grid item xs={8}>
                  <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' ,ml:3,width:450}}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6">Chat Window</Typography>
                      <Button
                        variant="outlined"
                        onClick={() => {
                          if (socketRef.current) {
                            socketRef.current.off('joined');
                            socketRef.current.emit('leave', { ticket_id: selectedTicket.id });
                          }
                          setSelectedTicket(null);
                        }}
                      >
                        Close Chat
                      </Button>
                    </Box>
                    <Box sx={{ flexGrow: 1}}>
                      <ChatWindow
                        ticketId={selectedTicket.id}
                        initialMessages={selectedTicket.chatHistory || []}
                        inactivityTimeout={120000}
                        onSendMessage={(message) => {
                          if (selectedTicket.status === 'closed') {
                            setErrors(prev => [...prev, 'Cannot send messages to a closed ticket']);
                            return;
                          }
                          socketRef.current.emit('message', {
                            ticket_id: selectedTicket.id,
                            sender_id: user.id,
                            message,
                          });
                        }}
                      />
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            )}
          </Paper>
        </Modal>
        <Dialog open={closeDialogOpen} onClose={() => setCloseDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Close Ticket</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Reason for Closing"
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                required
              />
              <FormControl fullWidth>
                <InputLabel>Reassign To (Optional)</InputLabel>
                <Select
                  value={reassignTo}
                  label="Reassign To (Optional)"
                  onChange={(e) => setReassignTo(e.target.value)}
                >
                  <MenuItem value="">None</MenuItem>
                  {members.map(member => (
                    <MenuItem key={member.id} value={member.id}>
                      {member.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCloseDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleCloseTicket}
              disabled={!closeReason.trim()}
            >
              Confirm
            </Button>
          </DialogActions>
        </Dialog>
        <Box sx={{ position: 'fixed', top: 80, right: 20, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {notifications.map((notification) => (
            <Alert
              key={notification.id}
              severity="info"
              action={
                notification.type === 'new' || notification.type === 'reassigned' ? (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button size="small" onClick={() => handleAcceptTicket(notification.id)}>
                      Accept
                    </Button>
                    <Button size="small" onClick={() => handleRejectTicket(notification.id)}>
                      Reject
                    </Button>
                  </Box>
                ) : null
              }
            >
              {notification.message}
            </Alert>
          ))}
        </Box>
      </Container>
    </>
  );
}

export default MemberDashboard;