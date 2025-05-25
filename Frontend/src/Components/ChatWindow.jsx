import React, { useState, useEffect, useRef } from 'react';
import {
  Box, TextField, IconButton, Paper, Typography, CircularProgress, Alert, LinearProgress, Avatar,
  Divider, Button, Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import useStore from '../store/useStore';
import { getSocket } from './socket';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';

function ChatWindow({ ticketId, readOnly = false, initialMessages = [], inactivityTimeout = 120000 }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState(initialMessages);
  const [loading, setLoading] = useState(Boolean(ticketId && !initialMessages.length));
  const [error, setError] = useState(null);
  const [ticketStatus, setTicketStatus] = useState(null);
  const [lastMessageAt, setLastMessageAt] = useState(null);
  const [members, setMembers] = useState([]);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [reassignTo, setReassignTo] = useState('');
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const user = useStore((state) => state.user);
  const inactivityTimerRef = useRef(null);
  const navigate = useNavigate();

  // Derive sender name
  const getSenderName = () => {
    if (!user) return 'User';
    return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'User';
  };

  // Fetch ticket status, messages, and members
  useEffect(() => {
    if (!ticketId || ticketId === 'null') {
      setError('Invalid ticket ID');
      setLoading(false);
      return;
    }

    const fetchTicketData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('No authentication token found');
          navigate('/auth');
          return;
        }

        // Fetch ticket status
        const ticketRes = await fetch(`http://localhost:5000/api/tickets/${ticketId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!ticketRes.ok) {
          const errorData = await ticketRes.json();
          throw new Error(`Failed to fetch ticket: ${errorData.message || ticketRes.statusText}`);
        }
        const ticketData = await ticketRes.json();
        setTicketStatus(ticketData.status);
        setLastMessageAt(ticketData.last_message_at);

        // Fetch messages
        const chatRes = await fetch(`http://localhost:5000/api/chats/${ticketId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!chatRes.ok) {
          const errorData = await chatRes.json();
          throw new Error(`Failed to fetch messages: ${errorData.message || chatRes.statusText}`);
        }
        const chatData = await chatRes.json();
        setMessages(chatData);

        // Fetch members for reassignment (members only)
        if (user?.role === 'member') {
          const membersRes = await fetch('http://localhost:5000/api/users/members', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!membersRes.ok) throw new Error('Failed to fetch members');
          const membersData = await membersRes.json();
          setMembers(membersData);
        }
      } catch (error) {
        console.error('Error fetching ticket data:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    if (!readOnly) {
      fetchTicketData();
    } else {
      setLoading(false);
    }
  }, [ticketId, readOnly, user, navigate]);

  // Handle inactivity timeout
  useEffect(() => {
    if (inactivityTimeout && !readOnly && ticketId && ticketStatus !== 'closed' && socketRef.current?.connected) {
      const resetTimer = () => {
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current);
        }
        inactivityTimerRef.current = setTimeout(() => {
          if (socketRef.current?.connected) {
            socketRef.current.emit('inactivity_timeout', { ticket_id: ticketId });
          }
        }, inactivityTimeout);
      };

      resetTimer();
      const handleActivity = () => resetTimer();
      window.addEventListener('keydown', handleActivity);
      window.addEventListener('mousemove', handleActivity);

      return () => {
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current);
        }
        window.removeEventListener('keydown', handleActivity);
        window.removeEventListener('mousemove', handleActivity);
      };
    }
  }, [inactivityTimeout, ticketId, readOnly, ticketStatus]);

  // Initialize socket
  useEffect(() => {
    if (!readOnly && ticketId && ticketId !== 'null') {
      socketRef.current = getSocket();
      if (!socketRef.current) {
        setError('Failed to initialize chat connection');
        setLoading(false);
        return;
      }

      socketRef.current.on('connect', () => {
        socketRef.current.emit('join', { ticket_id: ticketId });
      });

      socketRef.current.on('message', (newMessage) => {
        setMessages(prev => [...prev, newMessage]);
        setLastMessageAt(newMessage.timestamp);
      });

      socketRef.current.on('ticket_closed', ({ reason, reassigned_to }) => {
        setTicketStatus('closed');
        setMessages(prev => [
          ...prev,
          {
            ticket_id: ticketId,
            sender_id: null,
            message: `Ticket closed. Reason: ${reason}${reassigned_to ? `. Reassigned to member ID ${reassigned_to}` : ''}`,
            timestamp: new Date().toISOString(),
            is_system: true,
          },
        ]);
      });

      socketRef.current.on('ticket_reopened', () => {
        setTicketStatus('assigned');
        setMessages(prev => [
          ...prev,
          {
            ticket_id: ticketId,
            sender_id: null,
            message: 'Ticket has been reopened',
            timestamp: new Date().toISOString(),
            is_system: true,
          },
        ]);
      });

      socketRef.current.on('chat_inactive', ({ ticket_id, reason }) => {
        if (ticket_id === ticketId) {
          setTicketStatus('closed');
          setMessages(prev => [
            ...prev,
            {
              ticket_id: ticketId,
              sender_id: null,
              message: `Ticket closed due to inactivity. Reason: ${reason}`,
              timestamp: new Date().toISOString(),
              is_system: true,
            },
          ]);
        }
      });

      socketRef.current.on('connect_error', (err) => {
        setError(`Socket connection failed: ${err.message}`);
      });

      return () => {
        if (socketRef.current) {
          socketRef.current.emit('leave', { ticket_id: ticketId });
          socketRef.current.off('connect');
          socketRef.current.off('message');
          socketRef.current.off('ticket_closed');
          socketRef.current.off('ticket_reopened');
          socketRef.current.off('chat_inactive');
          socketRef.current.off('connect_error');
        }
      };
    }
  }, [ticketId, readOnly]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle sending messages
  const handleSend = async () => {
    if (!message.trim() || !socketRef.current?.connected || ticketStatus === 'closed') return;
    try {
      socketRef.current.emit('message', {
        ticket_id: ticketId,
        sender_id: user.id,
        sender_name: getSenderName(),
        message: message.trim(),
      });
      setMessage('');
    } catch (err) {
      setError('Failed to send message');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle ticket reassignment
  const handleReassignTicket = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/tickets/${ticketId}/reassign`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reassign_to: reassignTo }),
      });
      if (!res.ok) throw new Error('Failed to reassign ticket');
      setReassignDialogOpen(false);
      setReassignTo('');
      setMessages(prev => [
        ...prev,
        {
          ticket_id: ticketId,
          sender_id: null,
          message: `Ticket reassigned to member ID ${reassignTo}`,
          timestamp: new Date().toISOString(),
          is_system: true,
        },
      ]);
      const socket = getSocket();
      socket.emit('ticket_reassigned', { ticket_id: ticketId, assigned_to: reassignTo });
    } catch (err) {
      setError(err.message);
    }
  };

  const isMessageInputDisabled = readOnly || ticketStatus === 'closed' || !socketRef.current?.connected;
  const isActive = ticketStatus === 'assigned' && lastMessageAt
    ? new Date(lastMessageAt) > new Date(Date.now() - 2 * 60 * 1000)
    : false;

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

  // Group messages by date
  const groupedMessages = messages.reduce((acc, message) => {
    const date = moment(message.timestamp).format('MMMM D, YYYY');
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(message);
    return acc;
  }, {});

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      bgcolor: '#efeae2',
      borderRadius: 2,
      overflow: 'hidden',
    }}>
      <Box sx={{ p: 2, bgcolor: '#128C7E', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ fontFamily: '"Times New Roman", serif' }}>
          Status:{' '}
          <Box component="span" sx={{
            color: isActive ? '#4caf50' : '#ff9800',
            fontWeight: 'bold',
          }}>
            {isActive ? 'Active' : 'Inactive'}
          </Box>
        </Typography>
        {!readOnly && user?.role === 'member' && ticketStatus !== 'closed' && (
          <Button
            variant="outlined"
            size="small"
            sx={{ color: 'white', borderColor: 'white', '&:hover': { borderColor: '#e0e0e0', bgcolor: '#075E54' } }}
            onClick={() => setReassignDialogOpen(true)}
          >
            Reassign
          </Button>
        )}
      </Box>
      {!socketRef.current?.connected && (
        <Box sx={{ width: '100%' }}>
          <LinearProgress color="primary" />
          <Typography
            variant="caption"
            sx={{
              textAlign: 'center',
              display: 'block',
              py: 0.5,
              bgcolor: '#ff9800',
              color: 'white',
            }}
          >
            Connecting to chat...
          </Typography>
        </Box>
      )}
      <Box sx={{
        flex: 1,
        p: 2,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}>
        {Object.entries(groupedMessages).map(([date, dateMessages]) => (
          <React.Fragment key={date}>
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 1 }}>
              <Paper sx={{
                px: 2,
                py: 0.5,
                borderRadius: 10,
                bgcolor: '#d1e7dd',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              }}>
                <Typography variant="caption" sx={{ fontFamily: '"Times New Roman", serif' }}>
                  {date}
                </Typography>
              </Paper>
            </Box>
            {dateMessages.map((msg, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.sender_id === user?.id ? 'flex-end' : 'flex-start',
                  mb: 2,
                }}
              >
                {msg.is_system ? (
                  <Typography
                    variant="caption"
                    sx={{
                      textAlign: 'center',
                      color: '#374151',
                      my: 1,
                      bgcolor: '#d1e7dd',
                      px: 2,
                      py: 1,
                      borderRadius: 10,
                      fontFamily: '"Times New Roman", serif',
                    }}
                  >
                    {msg.message}
                  </Typography>
                ) : (
                  <Box sx={{
                    display: 'flex',
                    flexDirection: msg.sender_id === user?.id ? 'row-reverse' : 'row',
                    alignItems: 'flex-start',
                    gap: 1,
                    maxWidth: '70%',
                  }}>
                    <Avatar sx={{
                      width: 36,
                      height: 36,
                      bgcolor: msg.sender_id === null ? '#6b7280' : '#128C7E',
                      fontSize: '1rem',
                      fontFamily: '"Times New Roman", serif',
                    }}>
                      {msg.sender_name?.charAt(0).toUpperCase() || 'U'}
                    </Avatar>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          color: '#374151',
                          fontWeight: 'medium',
                          ml: msg.sender_id === user?.id ? 0 : 1,
                          mr: msg.sender_id === user?.id ? 1 : 0,
                          fontFamily: '"Times New Roman", serif',
                        }}
                      >
                        {msg.sender_name || (msg.sender_id === user?.id ? getSenderName() : 'Support')}
                      </Typography>
                      <Paper
                        elevation={1}
                        sx={{
                          p: 1.5,
                          borderRadius: msg.sender_id === user?.id ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          bgcolor: msg.sender_id === user?.id ? '#d1fae5' : 'white',
                          maxWidth: '100%',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                          '&:hover': { boxShadow: '0 3px 6px rgba(0,0,0,0.1)' },
                        }}
                      >
                        <Typography variant="body2" sx={{ fontFamily: '"Times New Roman", serif' }}>
                          {msg.message}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            textAlign: 'right',
                            mt: 0.5,
                            color: '#6b7280',
                            fontSize: '0.65rem',
                            fontFamily: '"Times New Roman", serif',
                          }}
                        >
                          {moment(msg.timestamp).format('h:mm A')}
                        </Typography>
                      </Paper>
                    </Box>
                  </Box>
                )}
              </Box>
            ))}
            <div ref={messagesEndRef} />
          </React.Fragment>
        ))}
      </Box>
      {!readOnly && (
        <Box sx={{
          p: 2,
          bgcolor: '#f9fafb',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}>
          {ticketStatus === 'closed' && (
            <Alert
              severity="info"
              sx={{
                mb: 1,
                borderRadius: 2,
                bgcolor: '#e0f2fe',
                '& .MuiAlert-icon': { color: '#0284c7' },
                fontFamily: '"Times New Roman", serif',
              }}
            >
              This ticket has been closed. No new messages can be sent.
            </Alert>
          )}
          <Box sx={{
            display: 'flex',
            gap: 1,
            alignItems: 'center',
            bgcolor: 'white',
            p: 1,
            borderRadius: 20,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <TextField
              fullWidth
              size="small"
              placeholder={
                ticketStatus === 'closed' ? 'Ticket is closed' :
                socketRef.current?.connected ? 'Type a message...' : 'Connecting...'
              }
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isMessageInputDisabled}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 20,
                  bgcolor: 'white',
                  '& fieldset': { border: 'none' },
                  fontFamily: '"Times New Roman", serif',
                },
              }}
            />
            <IconButton
              onClick={handleSend}
              disabled={!message.trim() || isMessageInputDisabled}
              sx={{
                bgcolor: '#128C7E',
                color: 'white',
                '&:hover': { bgcolor: '#075E54' },
                '&.Mui-disabled': { bgcolor: '#e5e7eb', color: '#9ca3af' },
                borderRadius: '50%',
                p: 1.2,
              }}
            >
              <SendIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      )}
      <Dialog open={reassignDialogOpen} onClose={() => setReassignDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontFamily: '"Times New Roman", serif' }}>Reassign Ticket</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel sx={{ fontFamily: '"Times New Roman", serif' }}>Reassign To</InputLabel>
              <Select
                value={reassignTo}
                label="Reassign To"
                onChange={(e) => setReassignTo(e.target.value)}
                sx={{ fontFamily: '"Times New Roman", serif' }}
              >
                <MenuItem value="" sx={{ fontFamily: '"Times New Roman", serif' }}>Select Member</MenuItem>
                {members.map(member => (
                  <MenuItem key={member.id} value={member.id} sx={{ fontFamily: '"Times New Roman", serif' }}>
                    {member.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setReassignDialogOpen(false)}
            sx={{ fontFamily: '"Times New Roman", serif' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleReassignTicket}
            disabled={!reassignTo}
            sx={{ bgcolor: '#128C7E', '&:hover': { bgcolor: '#075E54' }, fontFamily: '"Times New Roman", serif' }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ChatWindow;