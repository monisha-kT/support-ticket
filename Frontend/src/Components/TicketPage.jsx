import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Divider, Button,
  Alert, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField,
  Avatar, List, ListItem, ListItemAvatar, ListItemText,
  Badge, Chip, IconButton, InputAdornment
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import useStore from '../store/useStore';
import ChatWindow from './ChatWindow';
import { getSocket } from './socket';

function TicketPage() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [unreadCounts, setUnreadCounts] = useState({});
  const user = useStore((state) => state.user);
  const socketRef = useRef(null);

  const markTicketAsRead = async (ticketId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/tickets/${ticketId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return await response.json();
    } catch (err) {
      console.error('Error marking ticket as read:', err);
      return null;
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !user) {
      navigate('/auth');
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const ticketsRes = await fetch('http://localhost:5000/api/tickets', {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });

        if (!ticketsRes.ok) {
          throw new Error(await ticketsRes.text());
        }

        const ticketsData = await ticketsRes.json();

        const ticketsWithDetails = await Promise.all(ticketsData.map(async ticket => {
          try {
            const [lastMsgRes, unreadRes] = await Promise.all([
              fetch(`http://localhost:5000/api/chats/${ticket.id}/last`, {
                headers: { 'Authorization': `Bearer ${token}` },
              }),
              fetch(`http://localhost:5000/api/tickets/${ticket.id}/unread`, {
                headers: { 'Authorization': `Bearer ${token}` },
              })
            ]);

            const lastMessage = lastMsgRes.ok ? await lastMsgRes.json() : null;
            const unreadCount = unreadRes.ok ? await unreadRes.json() : 0;

            const userRes = await fetch(`http://localhost:5000/api/users/${ticket.user_id}`, {
              headers: { 'Authorization': `Bearer ${token}` },
            });
            const userData = userRes.ok ? await userRes.json() : {};

            return {
              ...ticket,
              userName: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'Unknown User',
              userEmail: userData.email || '',
              lastMessage: lastMessage?.content || 'No messages yet',
              lastMessageTime: lastMessage?.created_at || ticket.created_at,
              unreadCount: unreadCount || 0
            };
          } catch (err) {
            console.error(`Error fetching details for ticket ${ticket.id}:`, err);
            return {
              ...ticket,
              userName: 'Unknown User',
              userEmail: '',
              lastMessage: 'Error loading messages',
              lastMessageTime: ticket.created_at,
              unreadCount: 0
            };
          }
        }));

        ticketsWithDetails.sort((a, b) =>
          new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
        );

        setTickets(ticketsWithDetails);

        const counts = {};
        ticketsWithDetails.forEach(ticket => {
          counts[ticket.id] = ticket.unreadCount;
        });
        setUnreadCounts(counts);

        if (ticketId) {
          const ticket = ticketsWithDetails.find(t => t.id === parseInt(ticketId));
          if (ticket) {
            await handleTicketSelect(ticket.id);
            await markTicketAsRead(ticket.id);
            setUnreadCounts(prev => ({ ...prev, [ticket.id]: 0 }));
          }
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.message || 'Failed to load tickets');
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    const setupSocket = () => {
      try {
        socketRef.current = getSocket();

        if (!socketRef.current) {
          throw new Error('Socket connection failed');
        }

        const socket = socketRef.current;

        socket.on('connect_error', (err) => {
          console.error('Socket connection error:', err);
          setError('Connection error. Please refresh the page.');
        });

        socket.on('new_ticket', () => {
          fetchData();
        });

        socket.on('ticket_updated', () => {
          fetchData();
        });

        socket.on('ticket_reassigned', ({ ticket_id, reassigned_to }) => {
          setTickets(prev => prev.map(t =>
            t.id === ticket_id ? { ...t, status: 'assigned', assigned_to: reassigned_to } : t
          ));
          if (selectedTicket?.id === ticket_id) {
            setSelectedTicket(prev => ({ ...prev, status: 'assigned', assigned_to: reassigned_to }));
          }
        });

        socket.on('new_message', (data) => {
          if (data.ticket_id) {
            if (!selectedTicket || parseInt(ticketId) !== data.ticket_id) {
              setTickets(prev => {
                const updated = [...prev];
                const index = updated.findIndex(t => t.id === data.ticket_id);
                if (index >= 0) {
                  updated[index] = {
                    ...updated[index],
                    lastMessage: data.message,
                    lastMessageTime: new Date().toISOString()
                  };
                  updated.unshift(updated.splice(index, 1)[0]);
                }
                return updated;
              });

              setUnreadCounts(prev => ({
                ...prev,
                [data.ticket_id]: (prev[data.ticket_id] || 0) + 1
              }));
            }
          }
        });

        socket.on('ticket_closed', (data) => {
          setTickets(prev => prev.map(t =>
            t.id === data.ticket_id ? { ...t, status: 'closed' } : t
          ));
          if (selectedTicket?.id === data.ticket_id) {
            setSelectedTicket(prev => ({ ...prev, status: 'closed' }));
          }
        });

        socket.on('ticket_reopened', (data) => {
          setTickets(prev => prev.map(t =>
            t.id === data.ticket_id ? { ...t, status: 'assigned' } : t
          ));
          if (selectedTicket?.id === data.ticket_id) {
            setSelectedTicket(prev => ({ ...prev, status: 'assigned' }));
          }
        });

        return () => {
          if (socket) {
            socket.off('new_ticket');
            socket.off('ticket_updated');
            socket.off('ticket_reassigned');
            socket.off('new_message');
            socket.off('ticket_closed');
            socket.off('ticket_reopened');
          }
        };
      } catch (err) {
        console.error('Socket setup error:', err);
        setError('Real-time updates unavailable. Please refresh periodically.');
      }
    };

    const cleanup = setupSocket();

    return () => {
      if (cleanup) cleanup();
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user, navigate, ticketId]);

  const handleTicketSelect = async (ticketId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const [ticketRes, chatRes] = await Promise.all([
        fetch(`http://localhost:5000/api/tickets/${ticketId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`http://localhost:5000/api/chats/${ticketId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        })
      ]);

      if (!ticketRes.ok || !chatRes.ok) {
        throw new Error(ticketRes.ok ? await chatRes.text() : await ticketRes.text());
      }

      const ticketData = await ticketRes.json();
      const chatData = await chatRes.json();

      const userRes = await fetch(`http://localhost:5000/api/users/${ticketData.user_id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!userRes.ok) throw new Error(await userRes.text());
      const userData = await userRes.json();

      setSelectedTicket({
        ...ticketData,
        userName: `${userData.first_name} ${userData.last_name}`,
        userEmail: userData.email,
        chatHistory: chatData
      });

      navigate(`/member/tickets/${ticketId}`);

      if (socketRef.current) {
        socketRef.current.emit('join', { ticket_id: ticketId });
      }

      await markTicketAsRead(ticketId);
      setUnreadCounts(prev => ({ ...prev, [ticketId]: 0 }));
    } catch (err) {
      console.error('Error selecting ticket:', err);
      setError(err.message || 'Failed to load ticket details');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!closeReason.trim()) {
      setError('Closure reason is required');
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
          reason: closeReason
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      setCloseDialogOpen(false);
      setCloseReason('');
      setSelectedTicket(null);
      navigate('/member/tickets');
    } catch (err) {
      console.error('Error closing ticket:', err);
      setError(err.message || 'Failed to close ticket');
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const searchLower = searchTerm.toLowerCase();
    return (
      ticket.userName?.toLowerCase().includes(searchLower) ||
      ticket.description?.toLowerCase().includes(searchLower) ||
      ticket.lastMessage?.toLowerCase().includes(searchLower)
    );
  });

  const formatTime = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else if (diffDays < 7) {
        return date.toLocaleDateString([], { weekday: 'short' });
      } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
    } catch (e) {
      return '';
    }
  };

  const renderStatusBadge = (status) => {
    const colorMap = {
      open: 'warning',
      assigned: 'info',
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
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', bgcolor: '#f5f5f5' }}>
      {/* First Section - Ticket List */}
      <Box sx={{
        width: { xs: '100%', md: '350px' },
        borderRight: { md: '1px solid #e0e0e0' },
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'white',
        position: { xs: selectedTicket ? 'absolute' : 'relative', md: 'relative' },
        zIndex: { xs: selectedTicket ? 0 : 1, md: 1 },
        left: { xs: selectedTicket ? '-100%' : 0, md: 0 },
        transition: 'left 0.3s ease',
        height: '100%'
      }}>
        <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
          <Typography variant="h6" fontWeight="bold">Support Tickets</Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="Search tickets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              sx: {
                borderRadius: 20,
                bgcolor: '#f5f5f5',
                mt: 1
              }
            }}
          />
        </Box>
        <List sx={{ flex: 1, overflow: 'auto' }}>
          {filteredTickets.length > 0 ? (
            filteredTickets.map((ticket) => (
              <ListItem
                key={ticket.id}
                button
                selected={selectedTicket?.id === ticket.id}
                onClick={() => handleTicketSelect(ticket.id)}
                sx={{
                  borderBottom: '1px solid #f5f5f5',
                  '&:hover': { backgroundColor: '#f9f9f9' },
                  '&.Mui-selected': { backgroundColor: '#e3f2fd' },
                  '&.Mui-selected:hover': { backgroundColor: '#d9ebfc' }
                }}
              >
                <ListItemAvatar>
                  <Badge
                    overlap="circular"
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    badgeContent={unreadCounts[ticket.id] > 0 ? unreadCounts[ticket.id] : null}
                    color="primary"
                  >
                    <Avatar sx={{ bgcolor: stringToColor(ticket.userName) }}>
                      {ticket.userName?.charAt(0)}
                    </Avatar>
                  </Badge>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography fontWeight="bold" noWrap>
                        {ticket.userName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatTime(ticket.lastMessageTime)}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <>
                      <Typography noWrap fontWeight="medium">
                        {ticket.description}
                      </Typography>
                      <Typography noWrap variant="body2" color="text.secondary">
                        {ticket.lastMessage}
                      </Typography>
                    </>
                  }
                  sx={{ overflow: 'hidden' }}
                />
                {renderStatusBadge(ticket.status)}
              </ListItem>
            ))
          ) : (
            <Typography variant="body2" sx={{ p: 2, textAlign: 'center' }}>
              No tickets found
            </Typography>
          )}
        </List>
      </Box>

      {/* Right Panel - Ticket Details and Chat */}
      <Box sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        position: { xs: 'absolute', md: 'relative' },
        width: { xs: '100%', md: 'auto' },
        left: { xs: 0, md: 'auto' }
      }}>
        {selectedTicket ? (
          <>
            {/* Second Section - Ticket Details */}
            <Box sx={{
              p: 2,
              borderBottom: '1px solid #e0e0e0',
              bgcolor: 'white',
              display: 'flex',
              alignItems: 'center'
            }}>
              <IconButton
                sx={{ display: { md: 'none' }, mr: 1 }}
                onClick={() => {
                  setSelectedTicket(null);
                  navigate('/member/tickets');
                }}
              >
                <ArrowBackIcon />
              </IconButton>
              <Avatar sx={{ mr: 2 }}>{selectedTicket.userName?.charAt(0)}</Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography fontWeight="bold">{selectedTicket.userName}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedTicket.userEmail}
                </Typography>
              </Box>
              {selectedTicket.status === 'assigned' && (
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={() => setCloseDialogOpen(true)}
                >
                  Close Ticket
                </Button>
              )}
            </Box>
            <Box sx={{
              p: 2,
              borderBottom: '1px solid #e0e0e0',
              bgcolor: 'white',
              overflow: 'auto',
              maxHeight: '200px'
            }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                {selectedTicket.description}
              </Typography>
              <Typography variant="body2" paragraph>
                {selectedTicket.description}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  label={`Category: ${selectedTicket.category}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
                <Chip
                  label={`Urgency: ${selectedTicket.urgency}`}
                  size="small"
                  color="secondary"
                  variant="outlined"
                />
                {renderStatusBadge(selectedTicket.status)}
              </Box>
            </Box>

            {/* Third Section - Chat Window */}
            <Box sx={{ flex: 1, overflow: 'hidden' }}>
              <ChatWindow
                ticketId={selectedTicket.id}
                initialMessages={selectedTicket.chatHistory || []}
                inactivityTimeout={120000}
                readOnly={selectedTicket.status === 'closed'}
                onNewMessage={(message) => {
                  setTickets(prev => {
                    const updated = [...prev];
                    const index = updated.findIndex(t => t.id === selectedTicket.id);
                    if (index >= 0) {
                      updated[index] = {
                        ...updated[index],
                        lastMessage: message,
                        lastMessageTime: new Date().toISOString()
                      };
                      updated.unshift(updated.splice(index, 1)[0]);
                    }
                    return updated;
                  });
                }}
              />
            </Box>
          </>
        ) : (
          <Box sx={{
            flex: 1,
            display: { xs: 'none', md: 'flex' },
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'white'
          }}>
            <Typography variant="h6" color="text.secondary">
              Select a ticket to view details
            </Typography>
          </Box>
        )}
      </Box>

      {/* Close Ticket Dialog */}
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