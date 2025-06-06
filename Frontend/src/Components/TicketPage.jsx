import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Grid, Divider, Button, Alert, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Avatar, List, ListItem, ListItemAvatar, ListItemText,
  Badge, Chip, IconButton, InputAdornment, Tabs, Tab, useMediaQuery, useTheme, Skeleton,
  Select, MenuItem, FormControl, InputLabel
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import useStore from '../store/useStore';
import ChatWindow from './ChatWindow';
import { getSocket } from './socket';
import { debounce } from 'lodash';
import Navbar from '../Components/Navbar';

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

function TicketPage() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [switchingTicket, setSwitchingTicket] = useState(false);
  const [error, setError] = useState(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [reassignTo, setReassignTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [unreadCounts, setUnreadCounts] = useState({});
  const [activeSection, setActiveSection] = useState(isMobile && ticketId ? 'chat' : 'tickets');
  const [members, setMembers] = useState([]);
  const user = useStore((state) => state.user);
  const socketRef = useRef(null);
  const currentTicketIdRef = useRef(null);
  const isFetchingRef = useRef(false);
  const userCache = useRef(new Map());

  useEffect(() => {
    const initializeSocket = async () => {
      const token = localStorage.getItem('token');
      if (!token || !user) {
        navigate('/auth');
        return;
      }

      const socket = await getSocket();
      if (!socket) {
        setError('Failed to initialize real-time connection');
        return;
      }

      socketRef.current = socket;

      const handleConnect = () => {
        console.log('Socket connected:', socket.id);
        if (currentTicketIdRef.current) {
          socket.emit('join', { ticket_id: currentTicketIdRef.current });
        }
      };

      const handleConnectError = (err) => {
        console.error('Socket connection error:', err);
        setError('Connection error. Retrying...');
      };

      const handleDisconnect = (reason) => {
        console.log('Socket disconnected:', reason);
      };

      const handleNewTicket = () => {
        console.log('New ticket event');
        fetchData();
      };

      const handleTicketUpdated = ({ ticket_id }) => {
        console.log('Ticket updated:', ticket_id);
        if (!ticket_id) return;
        if (selectedTicket?.id === ticket_id) {
          // Avoid calling debouncedHandleTicketSelect if already selected
          return;
        } else {
          fetch(`${API_URL}/api/tickets/${ticket_id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
            .then(res => res.ok ? res.json() : Promise.reject(new Error('Failed to fetch ticket')))
            .then(updatedTicket => {
              setTickets(prev => prev.map(t => t.id === ticket_id ? { ...t, ...updatedTicket } : t));
            })
            .catch(err => console.error('Error updating ticket:', err));
        }
      };

      const handleTicketReassigned = ({ ticket_id, reassigned_to }) => {
        console.log('Ticket reassigned:', ticket_id);
        if (!ticket_id || reassigned_to === undefined) return;
        setTickets(prev => prev.map(t =>
          t.id === ticket_id ? { ...t, status: 'assigned', assigned_to: reassigned_to, reassigned_to } : t
        ));
        if (selectedTicket?.id === ticket_id) {
          setSelectedTicket(prev => ({ ...prev, status: 'assigned', assigned_to: reassigned_to, reassigned_to }));
        }
      };

      const handleMessage = (data) => {
        console.log('New message:', data);
        if (!data?.ticket_id || !data?.message) return;
        setTickets(prev => {
          const updated = prev.map(t => {
            if (t.id === data.ticket_id) {
              return {
                ...t,
                lastMessage: data.message,
                lastMessageTime: data.timestamp || new Date().toISOString()
              };
            }
            return t;
          });
          return updated.sort((a, b) =>
            new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
          );
        });

        if (selectedTicket?.id === data.ticket_id) {
          setSelectedTicket(prev => ({
            ...prev,
            chatHistory: [
              ...(prev.chatHistory || []),
              {
                id: data.id || Date.now(),
                content: data.message,
                sender_id: data.sender_id,
                timestamp: data.timestamp || new Date().toISOString(),
                sender_name: data.sender_name || 'Unknown'
              }
            ]
          }));
          setUnreadCounts(prev => ({ ...prev, [data.ticket_id]: 0 }));
        } else {
          setUnreadCounts(prev => ({
            ...prev,
            [data.ticket_id]: (prev[data.ticket_id] || 0) + 1
          }));
          console.log(`Unread messages for ticket ${data.ticket_id}: ${(unreadCounts[data.ticket_id] || 0) + 1}`);
        }
      };

      const handleTicketClosed = ({ ticket_id, reason, reassigned_to, status }) => {
        console.log('Ticket closed:', ticket_id);
        if (!ticket_id) return;
        setTickets(prev => prev.map(t =>
          t.id === ticket_id ? { ...t, status: status || 'closed', closure_reason: reason, reassigned_to } : t
        ));
        if (selectedTicket?.id === ticket_id) {
          setSelectedTicket(prev => ({ ...prev, status: status || 'closed', closure_reason: reason, reassigned_to }));
        }
      };

      const handleTicketReopened = ({ ticket_id }) => {
        console.log('Ticket reopened:', ticket_id);
        if (!ticket_id) return;
        setTickets(prev => prev.map(t =>
          t.id === ticket_id ? { ...t, status: 'assigned', closure_reason: null, reassigned_to: null } : t
        ));
        if (selectedTicket?.id === ticket_id) {
          setSelectedTicket(prev => ({ ...prev, status: 'assigned', closure_reason: null, reassigned_to: null }));
        }
      };

      const handleTicketInactive = ({ ticket_id, status, reason }) => {
        console.log('Ticket marked inactive:', ticket_id);
        if (!ticket_id) return;
        setTickets(prev => prev.map(t =>
          t.id === ticket_id ? { ...t, status, closure_reason: reason } : t
        ));
        if (selectedTicket?.id === ticket_id) {
          setSelectedTicket(prev => ({ ...prev, status, closure_reason: reason }));
        }
      };

      socket.on('connect', handleConnect);
      socket.on('connect_error', handleConnectError);
      socket.on('disconnect', handleDisconnect);
      socket.on('new_ticket', handleNewTicket);
      socket.on('ticket_updated', handleTicketUpdated);
      socket.on('ticket_reassigned', handleTicketReassigned);
      socket.on('message', handleMessage);
      socket.on('ticket_closed', handleTicketClosed);
      socket.on('ticket_reopened', handleTicketReopened);
      socket.on('ticket_inactive', handleTicketInactive);

      return () => {
        socket.off('connect', handleConnect);
        socket.off('connect_error', handleConnectError);
        socket.off('disconnect', handleDisconnect);
        socket.off('new_ticket', handleNewTicket);
        socket.off('ticket_updated', handleTicketUpdated);
        socket.off('ticket_reassigned', handleTicketReassigned);
        socket.off('message', handleMessage);
        socket.off('ticket_closed', handleTicketClosed);
        socket.off('ticket_reopened', handleTicketReopened);
        socket.off('ticket_inactive', handleTicketInactive);
        if (currentTicketIdRef.current) {
          socket.emit('leave', { ticket_id: currentTicketIdRef.current });
        }
      };
    };

    initializeSocket();
  }, [user, navigate]);

  const markTicketAsRead = async (ticketId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/tickets/${ticketId}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        const error = await response.text();
        if (response.status === 401) {
          navigate('/auth');
        }
        throw new Error(error);
      }
      return await response.json();
    } catch (err) {
      console.error('Error marking ticket as read:', err);
      setError('Failed to mark ticket as read');
      return null;
    }
  };

  const fetchMembers = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/users/members`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 401) navigate('/auth');
        throw new Error(await res.text());
      }
      const data = await res.json();
      setMembers(data);
    } catch (err) {
      console.error('Error fetching members:', err);
      setError('Failed to load members');
    }
  }, [navigate]);

  const fetchUser = useCallback(async (userId, token) => {
    if (userCache.current.has(userId)) {
      return userCache.current.get(userId);
    }
    try {
      const res = await fetch(`${API_URL}/api/users/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 401) navigate('/auth');
        throw new Error(await res.text());
      }
      const userData = await res.json();
      userCache.current.set(userId, userData);
      return userData;
    } catch (err) {
      console.error(`Error fetching user ${userId}:`, err);
      return { first_name: '', last_name: '', email: '' };
    }
  }, [navigate]);

  const fetchData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      const ticketsRes = await fetch(`${API_URL}/api/tickets`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });

      if (!ticketsRes.ok) {
        if (ticketsRes.status === 401) navigate('/auth');
        throw new Error(await ticketsRes.text());
      }

      const ticketsData = await ticketsRes.json();

      const ticketsWithDetails = await Promise.all(ticketsData.map(async ticket => {
        try {
          const unreadRes = fetch(`${API_URL}/api/tickets/${ticket.id}/unread`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const [unreadResponse] = await Promise.all([unreadRes]);

          const unreadCount = unreadResponse.ok ? await unreadResponse.json() : 0;
          const userData = await fetchUser(ticket.user_id, token);

          return {
            ...ticket,
            userName: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'Unknown User',
            userEmail: userData.email || '',
            lastMessage: ticket.last_message || 'No messages yet',
            lastMessageTime: ticket.last_message_time || ticket.created_at,
            unreadCount: unreadCount || 0
          };
        } catch (err) {
          console.error(`Error fetching details for ticket ${ticket.id}:`, err);
          return {
            ...ticket,
            userName: 'Unknown User',
            userEmail: '',
            lastMessage: 'No messages yet',
            lastMessageTime: ticket.created_at,
            unreadCount: 0
          };
        }
      }));

      ticketsWithDetails.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());

      setTickets(ticketsWithDetails);

      const counts = {};
      ticketsWithDetails.forEach(ticket => {
        counts[ticket.id] = ticket.unreadCount;
      });
      setUnreadCounts(counts);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load tickets');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [fetchUser, navigate]);

  const debouncedHandleTicketSelect = useCallback(
    debounce(async (newTicketId) => {
      if (selectedTicket?.id === newTicketId) return;
      try {
        setSwitchingTicket(true);
        setError(null);
        const token = localStorage.getItem('token');
        currentTicketIdRef.current = newTicketId;

        const existingTicket = tickets.find(t => t.id === newTicketId);
        if (existingTicket?.chatHistory) {
          setSelectedTicket(existingTicket);
          navigate(`/member/tickets/${newTicketId}`);
          if (socketRef.current) {
            socketRef.current.emit('join', { ticket_id: newTicketId });
          }
          await markTicketAsRead(newTicketId);
          setUnreadCounts(prev => ({ ...prev, [newTicketId]: 0 }));
          setActiveSection(isMobile ? 'chat' : 'tickets');
          return;
        }

        if (socketRef.current && selectedTicket?.id && selectedTicket.id !== newTicketId) {
          socketRef.current.emit('leave', { ticket_id: selectedTicket.id });
        }

        const [ticketRes, chatRes] = await Promise.all([
          fetch(`${API_URL}/api/tickets/${newTicketId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`${API_URL}/api/chats/${newTicketId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);

        if (!ticketRes.ok) {
          if (ticketRes.status === 401) navigate('/auth');
          throw new Error(await ticketRes.text());
        }
        const ticketData = await ticketRes.json();

        const chatData = chatRes.ok ? await chatRes.json() : [];

        const userData = await fetchUser(ticketData.user_id, token);

        if (currentTicketIdRef.current !== newTicketId) return;

        const updatedTicket = {
          ...ticketData,
          userName: `${userData.first_name} ${userData.last_name}`.trim() || 'Unknown User',
          userEmail: userData.email || '',
          chatHistory: chatData
        };

        setSelectedTicket(updatedTicket);
        setTickets(prev => prev.map(t => t.id === newTicketId ? { ...t, ...updatedTicket } : t));
        navigate(`/member/tickets/${newTicketId}`);

        if (socketRef.current) {
          socketRef.current.emit('join', { ticket_id: newTicketId });
        }

        await markTicketAsRead(newTicketId);
        setUnreadCounts(prev => ({ ...prev, [newTicketId]: 0 }));
        setActiveSection(isMobile ? 'chat' : 'tickets');
      } catch (err) {
        console.error('Error selecting ticket:', err);
        setError('Failed to load ticket details');
      } finally {
        setSwitchingTicket(false);
      }
    }, 300),
    [isMobile, fetchUser, navigate]
  );

  useEffect(() => {
    fetchData();
    fetchMembers();
    if (ticketId && !isNaN(parseInt(ticketId))) {
      debouncedHandleTicketSelect(parseInt(ticketId));
    }
  }, [fetchData, fetchMembers, ticketId, debouncedHandleTicketSelect]);

  const handleCloseTicket = async () => {
    if (!closeReason.trim()) {
      setError('Closure reason is required');
      return;
    }

    try {
      setError(null);
      const token = localStorage.getItem('token');
      const payload = { reason: closeReason };
      if (reassignTo) {
        payload.reassign_to = parseInt(reassignTo);
      }

      const res = await fetch(`${API_URL}/api/tickets/${selectedTicket.id}/close`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        if (res.status === 401) navigate('/dashboard');
        throw new Error(errorData.error || 'Failed to close ticket');
      }

      setCloseDialogOpen(false);
      setCloseReason('');
      setReassignTo('');
      setSelectedTicket(null);
      setActiveSection('tickets');
      navigate('/dashboard');
    } catch (err) {
      console.error('Error closing ticket:', err);
      setError('Failed to close ticket');
    }
  };

  const filteredTickets = useMemo(() => {
    const searchLower = searchTerm?.toLowerCase() || '';
    return tickets.filter(ticket =>
      (ticket.userName?.toLowerCase() || '').includes(searchLower) ||
      (ticket.description?.toLowerCase() || '').includes(searchLower) ||
      (ticket.lastMessage?.toLowerCase() || '').includes(searchLower)
    );
  }, [tickets, searchTerm]);

  const formatTime = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else if (diffDays < 7) {
        return date.toLocaleDateString('en-IN', { weekday: 'short' });
      } else {
        return date.toLocaleDateString('en-IN', { month: 'short', day: '2-digit' });
      }
    } catch (e) {
      console.error('Error formatting time:', e);
      return '';
    }
  };

  const renderStatusBadge = (status) => {
    const colorMap = {
      open: 'warning',
      assigned: 'info',
      inactive: 'default',
      closed: 'success',
      rejected: 'error'
    };
    return (
      <Chip
        label={status?.charAt(0)?.toUpperCase() + status?.slice(1) || 'Unknown'}
        color={colorMap[status] || 'default'}
        size="small"
        sx={{ ml: 1 }}
      />
    );
  };

  if (loading && !selectedTicket) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: theme.palette.grey[100] }}>
        <Navbar />
        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 8 }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: theme.palette.grey[100] }}>
        <Navbar />
        <Box sx={{ p: 2, mt: 8 }}>
          <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: theme.palette.grey[100] }}>
      <Navbar />
      {isMobile && (
        <Tabs
          value={activeSection}
          onChange={(e, value) => setActiveSection(value)}
          centered
          sx={{
            bgcolor: 'white',
            boxShadow: theme.shadows[1],
            borderBottom: `1px solid ${theme.palette.divider}`,
            mt:8
          }}
        >
          <Tab label="Tickets" value="tickets" />
          <Tab label="Details" value="details" disabled={!selectedTicket} />
          <Tab label="Chat" value="chat" disabled={!selectedTicket} />
        </Tabs>
      )}
      <Grid container sx={{ flex: 1, mt: isMobile ? 0 : 8, minHeight: 'calc(100vh - 64px - 16px)' }}>
        {/* Ticket List */}
        <Grid
          item
          xs={12}
          md={2}
          sx={{
            display: isMobile && activeSection !== 'tickets' ? 'none' : 'flex',
            flexDirection: 'column',
            bgcolor: 'white',
            boxShadow: theme.shadows[2],

            height: '100%',
            overflow: 'hidden',
            minWidth: 300,
            maxWidth: 350,

            height: 'calc(100vh - 49px - 18px)',
            overflow: 'auto',
   
            width: isMobile ? '100%' : '300px',
            minWidth: isMobile ? '100%' : '300px',
            maxWidth: isMobile ? '100%' : '300px',

          }}
        >
          <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="h6" fontWeight="bold" color="text.primary">
              Support Tickets
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="Search tickets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
                sx: {
                  borderRadius: 2,
                  bgcolor: theme.palette.grey[100],
                  mt: 1,
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: theme.palette.grey[300] },
                    '&:hover fieldset': { borderColor: theme.palette.grey[400] },
                    '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
                  }
                }
              }}
            />
          </Box>
          <List sx={{ flex: 1, overflowY: 'auto', p: 0 }}>
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <ListItem key={index} sx={{ p: 2, borderBottom: `1px solid ${theme.palette.grey[200]}` }}>
                  <ListItemAvatar>
                    <Skeleton variant="circular" width={40} height={40} />
                  </ListItemAvatar>
                  <ListItemText
                    primary={<Skeleton width="60%" />}
                    secondary={<Skeleton width="80%" />}
                  />
                </ListItem>
              ))
            ) : filteredTickets.length > 0 ? (
              filteredTickets.map((ticket) => (
                <ListItem
                  key={ticket.id}
                  button
                  selected={selectedTicket?.id === ticket.id}
                  onClick={() => {
                    if (selectedTicket?.id !== ticket.id) {
                      debouncedHandleTicketSelect(ticket.id);
                      if (isMobile) setActiveSection('chat');
                    }
                  }}
                  sx={{
                    p: 2,
                    borderBottom: `1px solid ${theme.palette.grey[200]}`,
                    '&:hover': { bgcolor: theme.palette.grey[50] },
                    '&.Mui-selected': { bgcolor: theme.palette.primary.light, color: 'white' },
                    '&.Mui-selected:hover': { bgcolor: theme.palette.primary.main }
                  }}
                >
                  <ListItemAvatar>
                    <Badge
                      overlap="circular"
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                      badgeContent={unreadCounts[ticket.id] || 0}
                      color="primary"
                    >
                      <Avatar sx={{ bgcolor: stringToColor(ticket.userName), width: 36, height: 36 }}>
                        {ticket.userName?.charAt(0)}
                      </Avatar>
                    </Badge>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body1" fontWeight="medium" noWrap>
                          {ticket.userName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatTime(ticket.lastMessageTime)}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography noWrap variant="body2" color="text.secondary">
                          {ticket.description}
                        </Typography>
                        <Typography noWrap variant="caption" color="text.secondary">
                          {ticket.lastMessage}
                        </Typography>
                      </>
                    }
                  />
                  {renderStatusBadge(ticket.status)}
                </ListItem>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                No tickets found
              </Typography>
            )}
          </List>
        </Grid>

        {/* Ticket Details */}
        <Grid
          item
          xs={12}
          md={2}
          sx={{
            display: isMobile && activeSection !== 'details' ? 'none' : 'flex',
            flexDirection: 'column',
            bgcolor: 'white',
            boxShadow: theme.shadows[2],
           
            width: isMobile ? '100' : '400px',
            minWidth: isMobile ? '100%' : '400px',
            maxWidth: isMobile ? '100%' : '400px',
          }}
        >
          {selectedTicket ? (
            switchingTicket ? (
              <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <CircularProgress />
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Box
                  sx={{
                    p: 2,
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {isMobile && (
                    <IconButton sx={{ mr: 1 }} onClick={() => setActiveSection('tickets')}>
                      <ArrowBackIcon />
                    </IconButton>
                  )}
                  <Avatar
                    sx={{
                      mr: 2,
                      bgcolor: stringToColor(selectedTicket.userName),
                      width: 40,
                      height: 40
                    }}
                  >
                    {selectedTicket?.userName?.charAt(0)}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" fontWeight="bold">
                      {selectedTicket.userName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedTicket.userEmail}
                    </Typography>
                  </Box>
                  {(selectedTicket.status === 'assigned' || selectedTicket.status === 'inactive') && (
                    <IconButton
                      color="error"
                      onClick={() => setCloseDialogOpen(true)}
                      title="Close Ticket"
                    >
                      <CloseIcon />
                    </IconButton>
                  )}
                </Box>
                <Box sx={{ p: 3, flex: 1, overflowY: 'auto' }}>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    {selectedTicket.description}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                    <Chip
                      label={`Category: ${selectedTicket.category || 'N/A'}`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                    <Chip
                      label={`Priority: ${selectedTicket.priority || 'N/A'}`}
                      size="small"
                      color="secondary"
                      variant="outlined"
                    />
                    {renderStatusBadge(selectedTicket.status)}
                  </Box>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="body2" gutterBottom>
                    <strong>Ticket ID:</strong> #{selectedTicket.auto_generated_key}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Created:</strong>{' '}
                    {new Date(selectedTicket.created_at).toLocaleString('en-IN')}
                  </Typography>
                </Box>
              </Box>
            )
          ) : (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="h6" color="text.secondary">
                Select a ticket to view details
              </Typography>
            </Box>
          )}
        </Grid>

        {/* Chat Window */}
        <Grid
          item
          xs={12}
          md={8}
          sx={{
            display: isMobile && activeSection !== 'chat' ? 'none' : 'flex',
            flexDirection: 'column',
            bgcolor: 'white',
            boxShadow: theme.shadows[2],
            height: 'calc(100vh - 50px - 16px)',
            flexGrow: 1,

            minWidth: 0,

             minWidth: isMobile ? '100%' : '500px',
            maxWidth: isMobile ? '100%' : '580px',

          }}
        >
          {selectedTicket ? (
            switchingTicket ? (
              <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <CircularProgress />
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Box
                  sx={{
                    p: 2,
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {isMobile && (
                    <IconButton sx={{ mr: 1 }} onClick={() => setActiveSection('details')}>
                      <ArrowBackIcon />
                    </IconButton>
                  )}
                  <Typography variant="h6" fontWeight="bold">
                    Chat - Ticket #{selectedTicket.auto_generated_key}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    flex: 1,
                    overflowY: 'auto',
                    maxHeight: 'calc(100vh - 64px - 16px - 64px)', // Adjust for Navbar, Tabs, and header
                  }}
                >
                  <ChatWindow
                    key={selectedTicket.id}
                    ticketId={selectedTicket.id}
                    initialMessages={selectedTicket.chatHistory || []}
                    readOnly={selectedTicket.status === 'closed'}
                    sx={{ height: '100%' }}
                  />
                </Box>
              </Box>
            )
          ) : (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="h6" color="text.secondary">
                Select a ticket to view chat
              </Typography>
            </Box>
          )}
        </Grid>
      </Grid>

      <Dialog open={closeDialogOpen} onClose={() => setCloseDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Close or Reassign Ticket</DialogTitle>
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
              variant="outlined"
            />
            <FormControl fullWidth>
              <InputLabel>Reassign To (Optional)</InputLabel>
              <Select
                value={reassignTo}
                label="Reassign To (Optional)"
                onChange={(e) => setReassignTo(e.target.value)}
              >
                <MenuItem value="">None</MenuItem>
                {members.map((member) => (
                  <MenuItem key={member.id} value={member.id}>
                    {member.first_name} {member.last_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setCloseDialogOpen(false);
              setCloseReason('');
              setReassignTo('');
            }}
            color="inherit"
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCloseTicket}
            disabled={!closeReason.trim()}
            color="error"
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function stringToColor(string) {
  if (!string) return '#000000';
  let hash = 0;
  for (let i = 0; i < string.length; i++) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff;
    color += `00${value.toString(16)}`.slice(-2);
  }
  return color;
}

export default TicketPage;