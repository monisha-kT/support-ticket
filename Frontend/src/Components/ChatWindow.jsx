import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, TextField, IconButton, Paper, Typography, CircularProgress, Alert, LinearProgress
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import useStore from '../store/useStore';
import { getSocket, useSocket } from './socket';
import { useNavigate } from 'react-router-dom';

function ChatWindow({ ticketId, readOnly = false, initialMessages = [], inactivityTimeout = 0 }) {
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

  useEffect(() => {
    if (!readOnly && ticketId && ticketId !== 'null') {
      socketRef.current = getSocket();
      if (!socketRef.current) {
        setError('Failed to initialize chat connection');
        setLoading(false);
        return;
      }
      socketRef.current.on('message', (newMessage) => {
        setMessages(prev => [...prev, newMessage]);
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
            is_system: true
          }
        ]);
      });
      socketRef.current.on('ticket_reopened', () => {
        setTicketStatus('assigned');
      });
      socketRef.current.emit('join', { ticket_id: ticketId });
      socketRef.current.on('message_sent', (data) => {
        if (data.success) {
          setMessages(prev => [...prev, {
            ticket_id: ticketId,
            sender_id: user.id,
            message: data.message,
            timestamp: data.timestamp
          }]);
        }
      });
      if (!initialMessages.length) {
        fetchMessages();
      }
      setLoading(false);
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.off('message');
        socketRef.current.off('joined');
        socketRef.current.off('message_sent');
        socketRef.current.off('ticket_closed');
        socketRef.current.off('ticket_reopened');
      }
    };
  }, [ticketId, readOnly, user.id, initialMessages]);

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
        throw new Error('Failed to fetch messages');
      }
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || !socketRef.current || !isConnected || ticketStatus === 'closed') return;
    try {
      socketRef.current.emit('message', {
        ticket_id: ticketId,
        sender_id: user.id,
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
  console.log(isConnected, 'Socket connected');
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {!isConnected && (
        console.log('Socket  connected') ||
        <Box sx={{ width: '100%' }}>
          <LinearProgress />
          <Typography 
            variant="caption" 
            sx={{ 
              textAlign: 'center', 
              display: 'block',
              py: 0.5,
              bgcolor: 'warning.light'
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
        bgcolor: '#f5f5f5',
        display: 'flex',
        flexDirection: 'column',
        gap: 1
      }}>
        {messages.map((msg, index) => (
          <Paper
            key={index}
            elevation={1}
            sx={{
              p: 1.5,
              maxWidth: '70%',
              alignSelf: msg.is_system ? 'center' : msg.sender_id === user.id ? 'flex-end' : 'flex-start',
              bgcolor: msg.is_system ? '#fff3e0' : msg.sender_id === user.id ? '#e3f2fd' : 'white',
              borderRadius: 2,
              position: 'relative'
            }}
          >
            <Typography>{msg.message}</Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                display: 'block', 
                textAlign: 'right', 
                mt: 0.5,
                opacity: 0.7
              }}
            >
              {new Date(msg.timestamp).toLocaleTimeString()}
            </Typography>
          </Paper>
        ))}
        <div ref={messagesEndRef} />
      </Box>
      {!readOnly && (
        <Box sx={{ 
          p: 2, 
          bgcolor: 'white', 
          borderTop: '1px solid #e0e0e0',
          display: 'flex',
          flexDirection: 'column',
          gap: 1
        }}>
          {ticketStatus === 'closed' && (
            <Alert severity="info" sx={{ mb: 1 }}>
              This ticket has been closed. No new messages can be sent.
            </Alert>
          )}
          <Box sx={{ display: 'flex', gap: 1 }}>
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
                  borderRadius: 2
                }
              }}
            />
            <IconButton 
              onClick={handleSend}
              disabled={!message.trim() || isMessageInputDisabled}
              sx={{ 
                bgcolor: 'primary.main',
                color: 'white',
                '&:hover': { bgcolor: 'primary.dark' },
                '&.Mui-disabled': { bgcolor: 'grey.300' }
              }}
            >
              <SendIcon />
            </IconButton>
          </Box>
        </Box>
      )}
    </Box>
  );
}

export default ChatWindow;