import React, { useState, useEffect, useRef } from 'react';
import {
  Box, TextField, IconButton, Paper, Typography,
  CircularProgress, Alert, LinearProgress, Avatar,
  Divider
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import useStore from '../store/useStore';
import { getSocket, useSocket } from './socket';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';

function ChatWindow({ ticketId, readOnly = false, initialMessages = [], inactivityTimeout = 120000 }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState(initialMessages);
  const [loading, setLoading] = useState(Boolean(ticketId && !initialMessages.length));
  const [error, setError] = useState(null);
  const [ticketStatus, setTicketStatus] = useState(null);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const user = useStore((state) => state.user);
  const { isConnected, error: socketError } = useSocket();
  const inactivityTimerRef = useRef(null);
  const navigate = useNavigate();

  // Fetch ticket status
  useEffect(() => {
    const fetchTicketStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('No authentication token found');
          navigate('/auth');
          return;
        }
        const response = await fetch(`http://localhost:5000/api/tickets/${ticketId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Failed to fetch ticket status: ${errorData.message || response.statusText}`);
        }
        const data = await response.json();
        setTicketStatus(data.status);
      } catch (error) {
        console.error('Error fetching ticket status:', error);
        setError(error.message);
      }
    };

    if (!readOnly && ticketId && ticketId !== 'null') {
      fetchTicketStatus();
    }
  }, [ticketId, readOnly, navigate]);

  // Handle inactivity timeout
  useEffect(() => {
    if (inactivityTimeout && !readOnly && ticketId && ticketStatus !== 'closed') {
      const resetTimer = () => {
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current);
        }
        inactivityTimerRef.current = setTimeout(() => {
          if (socketRef.current) {
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

  // Initialize socket and fetch messages
  useEffect(() => {
    const initializeSocket = async () => {
      if (readOnly || !ticketId || ticketId === 'null') {
        setLoading(false);
        return;
      }

      setLoading(true);
      const socket = await getSocket();
      if (!socket) {
        setError('Failed to initialize chat connection');
        setLoading(false);
        return;
      }

      socketRef.current = socket;

      socket.on('message', (newMessage) => {
        if (newMessage.ticket_id === ticketId) {
          setMessages((prev) => [...prev, newMessage]);
        }
      });

      socket.on('ticket_closed', ({ reason, reassigned_to }) => {
        setTicketStatus('closed');
        setMessages((prev) => [
          ...prev,
          {
            ticket_id: ticketId,
            sender_id: null,
            message: `Ticket closed. Reason: ${reason}${reassigned_to ? `. Reassigned to member ID ${reassigned_to}` : ''}`,
            timestamp: new Date().toISOString(),
            is_system: true
          }
        ]);
      });

      socket.on('ticket_reopened', () => {
        setTicketStatus('assigned');
        setMessages((prev) => [
          ...prev,
          {
            ticket_id: ticketId,
            sender_id: null,
            message: 'Ticket has been reopened',
            timestamp: new Date().toISOString(),
            is_system: true
          }
        ]);
      });

      socket.emit('join', { ticket_id: ticketId });

      if (!initialMessages.length) {
        await fetchMessages();
      }

      setLoading(false);
    };

    initializeSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave', { ticket_id: ticketId });
        socketRef.current.off('message');
        socketRef.current.off('ticket_closed');
        socketRef.current.off('ticket_reopened');
      }
    };
  }, [ticketId, readOnly, initialMessages]);

  const fetchMessages = async () => {
    if (!ticketId) return;
    const token = localStorage.getItem('token');
    if (!token) {
      setError('No authentication token found');
      navigate('/auth');
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/chats/${ticketId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to fetch messages: ${errorData.message || response.statusText}`);
      }
      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error('Fetch Messages Error:', error);
      setError('Error loading messages: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || !socketRef.current || !isConnected || ticketStatus === 'closed') return;
    try {
      socketRef.current.emit('message', {
        ticket_id: ticketId,
        sender_id: user.id,
        sender_name: `${user.firstName} ${user.lastName}`,
        message: message.trim()
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

  const isMessageInputDisabled = readOnly || ticketStatus === 'closed' || !isConnected;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || socketError) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">
          {error || socketError || 'Failed to connect to chat'}
        </Alert>
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
      height: '74vh',
      bgcolor: '#f5f6f5',
      borderRadius: 2,
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      overflow: 'hidden'
    }}>
      {!isConnected && (
        <Box sx={{ width: '100%' }}>
          <LinearProgress color="primary" />
          <Typography
            variant="caption"
            sx={{
              textAlign: 'center',
              display: 'block',
              py: 0.5,
              bgcolor: 'warning.light',
              color: 'warning.contrastText'
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
        gap: 2
      }}>
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
                bgcolor: '#e0f2fe',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}>
                <Typography variant="caption" fontWeight="medium">{date}</Typography>
              </Paper>
            </Box>
            {dateMessages.map((msg, index) => (
              <Box
                key={index}
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
                      bgcolor: msg.sender_id === user.id ? '#10b981' : '#6b7280',
                      fontSize: '1rem'
                    }}>
                      {msg.sender_name?.charAt(0).toUpperCase() || 'U'}
                    </Avatar>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          fontWeight: 'medium',
                          ml: msg.sender_id === user.id ? 0 : 1,
                          mr: msg.sender_id === user.id ? 1 : 0
                        }}
                      >
                        {msg.sender_name || 'Support'}
                      </Typography>
                      <Paper
                        elevation={1}
                        sx={{
                          p: 1.5,
                          borderRadius: msg.sender_id === user.id ?
                            '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          bgcolor: msg.sender_id === user.id ? '#d1fae5' : 'white',
                          maxWidth: '100%',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
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
                          {moment(msg.timestamp).format('h:mm A')}
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
      {!readOnly && (
        <Box sx={{
          p: 2,
          bgcolor: '#f9fafb',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          flexDirection: 'column',
          gap: 1
        }}>
          {ticketStatus === 'closed' && (
            <Alert
              severity="info"
              sx={{
                mb: 1,
                borderRadius: 2,
                bgcolor: '#e0f2fe'
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
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <TextField
              fullWidth
              size="small"
              placeholder={
                ticketStatus === 'closed' ? "Ticket is closed" :
                isConnected ? "Type a message..." : "Connecting..."
              }
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isMessageInputDisabled}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 20,
                  bgcolor: 'white',
                  '& fieldset': { border: 'none' }
                }
              }}
            />
            <IconButton
              onClick={handleSend}
              disabled={!message.trim() || isMessageInputDisabled}
              sx={{
                bgcolor: '#10b981',
                color: 'white',
                '&:hover': { bgcolor: '#059669' },
                '&.Mui-disabled': {
                  bgcolor: '#e5e7eb',
                  color: '#9ca3af'
                },
                borderRadius: '50%',
                p: 1.2
              }}
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