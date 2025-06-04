import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Container, Typography, Table, TableBody, TableContainer, TableHead, TableRow, TableCell,
  TablePagination, TableSortLabel, Paper, TextField, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, FormControl, InputLabel, Select, MenuItem, CircularProgress, Alert, InputAdornment,
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import useStore from '../store/useStore';
import useTickets from './useTickets';
import Navbar from './Navbar';
import NotificationDrawer from './NotificationDrawer';
import ErrorBoundary from './ErrorBoundary';
import { getSocket, disconnectSocket } from './socket';

const theme = createTheme({
  typography: {
    fontFamily: '"Open Sans", sans-serif',
    h5: {
      fontSize: '26px',
      fontWeight: 'bold',
    },
    body1: {
      fontSize: '16px',
    },
  },
  components: {
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontSize: '16px',
          padding: '12px 16px',
        },
        head: {
          backgroundColor: '#128C7E',
          color: 'white',
          fontWeight: 'bold',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'capitalize',
          fontSize: '14px',
          padding: '6px 16px',
          minWidth: '100px',
        },
      },
    },
    MuiTableSortLabel: {
      styleOverrides: {
        root: {
          color: 'white !important',
          '&:hover': {
            color: 'white !important',
          },
          '&.Mui-active': {
            color: 'white !important',
          },
        },
        icon: {
          color: 'white !important',
        },
      },
    },
  },
});

const headers = [
  { label: 'Ticket ID', id: 'id' },
  { label: 'Created By', id: 'userName' },
  { label: 'Category', id: 'category' },
  { label: 'Priority', id: 'priority' },
  { label: 'Status', id: 'status' },
  { label: 'Created At', id: 'createdAt' },
  { label: 'Last Response Date', id: 'lastMessageAt' },
  { label: 'Last Response Time', id: 'lastResponseTime' },
  { label: 'Actions', id: 'actions' },
];

function MemberDashboard() {
  const navigate = useNavigate();
  const { ticketId } = useParams();
  const user = useStore((state) => state.user);
  
  // Move useTickets hook to the top level
  const { 
    tickets = [], 
    filteredTickets = [], 
    loading, 
    error, 
    searchFilters, 
    handleSearchChange, 
    fetchTickets 
  } = useTickets('member');

  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [reassignTo, setReassignTo] = useState('');
  const [members, setMembers] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [order, setOrder] = useState('desc');
  const [orderBy, setOrderBy] = useState('createdAt');
  const [notifications, setNotifications] = useState([]);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const socketRef = useRef(null);
  const socketInitialized = useRef(false);

  const fetchMembers = useCallback(async () => {
    console.log('Fetching members at:', new Date().toISOString());
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/auth');
        return;
      }
      const response = await fetch('http://localhost:5000/api/users/members', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch members');
      }
      const data = await response.json();
      setMembers(data);
    } catch (err) {
      console.error('Error fetching members:', err);
      setNotifications(prev => [...prev, { type: 'error', message: err.message }]);
    }
  }, [navigate]);

  const handleAcceptTicket = useCallback(async (ticketId) => {
    setIsProcessing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/tickets/${ticketId}/accept`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to accept ticket');
      await fetchTickets();
      setNotifications(prev => [...prev, { type: 'success', message: `Ticket #${ticketId} accepted.` }]);
    } catch (err) {
      console.error('Error accepting ticket:', err);
      setNotifications(prev => [...prev, { type: 'error', message: err.message }]);
    } finally {
      setIsProcessing(false);
    }
  }, [fetchTickets]);

  const handleRejectTicket = useCallback(async (ticketId) => {
    setIsProcessing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/tickets/${ticketId}/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to reject ticket');
      await fetchTickets();
      setNotifications(prev => [...prev, { type: 'info', message: `Ticket #${ticketId} rejected.` }]);
    } catch (err) {
      console.error('Error rejecting ticket:', err);
      setNotifications(prev => [...prev, { type: 'error', message: err.message }]);
    } finally {
      setIsProcessing(false);
    }
  }, [fetchTickets]);

  const handleCloseTicket = useCallback(async () => {
    if (!closeReason.trim()) {
      setNotifications(prev => [...prev, { type: 'error', message: 'Closure reason is required' }]);
      return;
    }

    setIsProcessing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/tickets/${selectedTicketId}/close`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: closeReason,
          reassign_to: reassignTo ? parseInt(reassignTo) : null,
        }),
      });
      if (!response.ok) throw new Error('Failed to close ticket');
      
      await fetchTickets();
      setCloseDialogOpen(false);
      setCloseReason('');
      setReassignTo('');
      setSelectedTicketId(null);
      setNotifications(prev => [...prev, { type: 'success', message: `Ticket #${selectedTicketId} closed.` }]);
      
      if (socketRef.current) {
        socketRef.current.emit('ticket_closed', {
          ticket_id: selectedTicketId,
          reason: closeReason,
          reassigned_to: reassignTo ? parseInt(reassignTo) : null,
        });
      }
    } catch (err) {
      console.error('Error closing ticket:', err);
      setNotifications(prev => [...prev, { type: 'error', message: err.message }]);
    } finally {
      setIsProcessing(false);
    }
  }, [closeReason, selectedTicketId, reassignTo, fetchTickets]);

  const handleReopenTicket = useCallback(async (ticketId) => {
    setIsProcessing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/tickets/${ticketId}/reopen`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Reopening ticket from UI' }),
      });
      if (!response.ok) throw new Error('Failed to reopen ticket');
      await fetchTickets();
      setNotifications(prev => [...prev, { type: 'info', message: `Ticket #${ticketId} reopened.` }]);
    } catch (err) {
      console.error('Error reopening ticket:', err);
      setNotifications(prev => [...prev, { type: 'error', message: err.message }]);
    } finally {
      setIsProcessing(false);
    }
  }, [fetchTickets]);

  const formatDate = useCallback((date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleString('en-US', { month: 'short' });
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  }, []);

  const formatTime = useCallback((date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    });
  }, []);

  const renderStatusBadge = useCallback((status) => (
    <Box
      sx={{
        color: 'white',
        bgcolor:
          status === 'open' ? '#ff9800' :
          status === 'assigned' ? '#4caf50' :
          status === 'inactive' ? '#9e9e9e' :
          status === 'reassigned' ? '#f44336' :
          status === 'closed' ? '#2196f3' :
          status === 'rejected' ? '#f44336' : 'inherit',
        width: 120,
        height: 32,
        lineHeight: '32px',
        textAlign: 'center',
        borderRadius: 1,
        display: 'inline-block',
        fontFamily: '"Open Sans", sans-serif',
        fontSize: '16px',
        textTransform: 'capitalize',
      }}
    >
      {status}
    </Box>
  ), []);

  const renderActionButtons = useCallback((ticket) => (
    <Box sx={{ display: 'flex', gap: 1 }}>
      {ticket.status === 'open' && (
        <>
          <Button
            variant="contained"
            size="small"
            color="success"
            onClick={() => handleAcceptTicket(ticket.id)}
            disabled={isProcessing}
          >
            Accept
          </Button>
          <Button
            variant="contained"
            size="small"
            color="error"
            onClick={() => handleRejectTicket(ticket.id)}
            disabled={isProcessing}
          >
            Reject
          </Button>
        </>
      )}
      {(ticket.status === 'assigned' || ticket.status === 'reassigned') && (
        <>
          <Button
            variant="contained"
            size="small"
            onClick={() => navigate(`/member/tickets/${ticket.id}`)}
            disabled={isProcessing}
          >
            View
          </Button>
          <Button
            variant="outlined"
            color="error"
            size="small"
            onClick={() => {
              setSelectedTicketId(ticket.id);
              setCloseDialogOpen(true);
            }}
            disabled={isProcessing}
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
          disabled={isProcessing}
        >
          Reopen
        </Button>
      )}
    </Box>
  ), [handleAcceptTicket, handleRejectTicket, handleReopenTicket, isProcessing, navigate]);

  const handleRequestSort = useCallback((property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  }, [order, orderBy]);

  const handleChangePage = useCallback((_, newPage) => {
    setPage(newPage);
  }, []);

  const handleChangeRowsPerPage = useCallback((event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  const stableSort = useCallback((array, comparator) => {
    const stabilizedThis = array.map((el, index) => [el, index]);
    stabilizedThis.sort((a, b) => {
      const order = comparator(a[0], b[0]);
      if (order !== 0) return order;
      return a[1] - b[1];
    });
    return stabilizedThis.map((el) => el[0]);
  }, []);

  const getComparator = useCallback((order, orderBy) => {
    return order === 'desc'
      ? (a, b) => descendingComparator(a, b, orderBy)
      : (a, b) => -descendingComparator(a, b, orderBy);
  }, []);

  const descendingComparator = useCallback((a, b, orderBy) => {
    if (orderBy === 'createdAt' || orderBy === 'lastMessageAt') {
      const aValue = a[orderBy] || new Date(0);
      const bValue = b[orderBy] || new Date(0);
      return bValue - aValue;
    }
    if (b[orderBy] < a[orderBy]) return -1;
    if (b[orderBy] > a[orderBy]) return 1;
    return 0;
  }, []);

  const sortedTickets = useMemo(() => {
    return stableSort(filteredTickets, getComparator(order, orderBy));
  }, [filteredTickets, stableSort, getComparator, order, orderBy]);

  const visibleTickets = useMemo(() => {
    return sortedTickets.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [sortedTickets, page, rowsPerPage]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !user || user.role !== 'member') {
      navigate('/auth');
      return;
    }

    fetchMembers();
  }, [user, navigate, fetchMembers]);

  useEffect(() => {
    const initializeSocket = async () => {
      try {
        const socket = await getSocket();
        if (!socket) {
          setNotifications(prev => [...prev, { type: 'error', message: 'Failed to initialize real-time connection' }]);
          return;
        }

        socketRef.current = socket;
        socketInitialized.current = true;

        const handleNewTicket = (newTicket) => {
          setNotifications(prev => [
            ...prev,
            { type: 'info', message: `New ticket #${newTicket.id} created.` },
          ]);
          fetchTickets();
        };

        const handleTicketReassigned = ({ ticket_id, assigned_to, status }) => {
          const member = members.find((m) => m.id === assigned_to);
          setNotifications(prev => [
            ...prev,
            { type: 'info', message: `Ticket #${ticket_id} has been reassigned to ${member ? `${member.first_name} ${member.last_name}` : 'another member'}.` },
          ]);
          fetchTickets();
        };

        const handleTicketReopened = () => fetchTickets();
        const handleTicketClosed = () => fetchTickets();
        const handleChatInactive = ({ ticket_id }) => {
          if (selectedTicketId === ticket_id) {
            setSelectedTicketId(null);
            navigate('/member/tickets');
          }
          fetchTickets();
        };

        const handleTicketAccepted = ({ ticket_id }) => {
          setNotifications(prev => [
            ...prev,
            { type: 'success', message: `Ticket #${ticket_id} has been accepted.` },
          ]);
          fetchTickets();
        };

        const handleTicketRejected = ({ ticket_id }) => {
          setNotifications(prev => [
            ...prev,
            { type: 'info', message: `Ticket #${ticket_id} has been rejected.` },
          ]);
          fetchTickets();
        };

        socket.on('new_ticket', handleNewTicket);
        socket.on('ticket_reassigned', handleTicketReassigned);
        socket.on('ticket_reopened', handleTicketReopened);
        socket.on('ticket_closed', handleTicketClosed);
        socket.on('chat_inactive', handleChatInactive);
        socket.on('ticket_accepted', handleTicketAccepted);
        socket.on('ticket_rejected', handleTicketRejected);

        return () => {
          socket.off('new_ticket', handleNewTicket);
          socket.off('ticket_reassigned', handleTicketReassigned);
          socket.off('ticket_reopened', handleTicketReopened);
          socket.off('ticket_closed', handleTicketClosed);
          socket.off('chat_inactive', handleChatInactive);
          socket.off('ticket_accepted', handleTicketAccepted);
          socket.off('ticket_rejected', handleTicketRejected);
        };
      } catch (err) {
        console.error('Socket initialization error:', err);
        setNotifications(prev => [...prev, { type: 'error', message: 'Failed to initialize socket connection' }]);
      }
    };

    initializeSocket();

    return () => {
      if (socketRef.current && socketInitialized.current) {
        disconnectSocket();
        socketRef.current = null;
        socketInitialized.current = false;
      }
    };
  }, [navigate, fetchTickets, members, selectedTicketId]);

  useEffect(() => {
    if (ticketId && tickets.length > 0) {
      const ticket = tickets.find((t) => t.id === parseInt(ticketId));
      if (ticket) setSelectedTicketId(ticket.id);
    }
  }, [ticketId, tickets]);

  if (loading) {
    return (
      <ThemeProvider theme={theme}>
        <ErrorBoundary>
          <Navbar />
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <CircularProgress />
          </Box>
        </ErrorBoundary>
      </ThemeProvider>
    );
  }

  if (error) {
    return (
      <ThemeProvider theme={theme}>
        <ErrorBoundary>
          <Navbar />
          <Box sx={{ p: 2, mt: 8 }}>
            <Alert severity="error">{error}</Alert>
          </Box>
        </ErrorBoundary>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <ErrorBoundary>
        <Navbar />
        <Container maxWidth="xl" sx={{ mt: 10, mb: 5 }}>
          <Typography variant="h5" component="h1" gutterBottom>
            Member Support Dashboard
          </Typography>
          <Paper sx={{ width: '100%', overflow: 'hidden', mb: 2, mt: 3 }}>
            <TableContainer sx={{ maxHeight: 'calc(100vh - 220px)' }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    {headers.map((header) => (
                      <TableCell
                        key={header.id}
                        sx={{
                          whiteSpace: 'nowrap',
                          backgroundColor: '#00796b',
                          color: 'white',
                          position: 'sticky',
                          top: 0,
                          zIndex: 2,
                        }}
                      >
                        {header.id !== 'actions' ? (
                          <TableSortLabel
                            active={orderBy === header.id}
                            direction={orderBy === header.id ? order : 'asc'}
                            onClick={() => handleRequestSort(header.id)}
                          >
                            {header.label}
                          </TableSortLabel>
                        ) : (
                          header.label
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    {headers.map((header) => (
                      <TableCell
                        key={`${header.id}-filter`}
                        sx={{
                          backgroundColor: 'white',
                          color: 'black',
                          whiteSpace: 'nowrap',
                          position: 'sticky',
                          top: 56,
                          zIndex: 2,
                        }}
                      >
                        {header.id !== 'actions' && (
                          <TextField
                            size="small"
                            variant="outlined"
                            value={searchFilters[header.id] || ''}
                            onChange={(e) => handleSearchChange(header.id, e.target.value)}
                            placeholder={`Filter ${header.label}`}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <SearchIcon fontSize="small" sx={{ color: 'black' }} />
                                </InputAdornment>
                              ),
                              sx: {
                                color: 'black',
                                '&::placeholder': {
                                  color: 'black !important',
                                },
                              },
                            }}
                            sx={{
                              mt: 1,
                              width: '100%',
                              '& .MuiOutlinedInput-root': {
                                '& fieldset': {
                                  borderColor: 'rgba(0,0,0,0.2)',
                                },
                                '&:hover fieldset': {
                                  borderColor: 'rgba(0,0,0,0.5)',
                                },
                              },
                            }}
                          />
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleTickets.map((ticket) => (
                    <TableRow hover key={ticket.id}>
                     <TableCell>{ticket.auto_generated_key || ticket.id || 'N/A'}</TableCell>
                      <TableCell>{ticket.userName}</TableCell>
                      <TableCell>{ticket.category}</TableCell>
                      <TableCell>{ticket.priority}</TableCell>
                      <TableCell>{renderStatusBadge(ticket.status)}</TableCell>
                      <TableCell>{formatDate(ticket.createdAt)}</TableCell>
                      <TableCell>{formatDate(ticket.lastMessageAt)}</TableCell>
                      <TableCell>{formatTime(ticket.lastMessageAt)}</TableCell>
                      <TableCell>{renderActionButtons(ticket)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={filteredTickets.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </Paper>

          <Dialog open={closeDialogOpen} onClose={() => setCloseDialogOpen(false)}>
            <DialogTitle>Close Ticket</DialogTitle>
            <DialogContent>
              <Box sx={{ mt: 2 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Reason for closing"
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  sx={{ mb: 2 }}
                />
                <FormControl fullWidth>
                  <InputLabel>Reassign to (optional)</InputLabel>
                  <Select
                    value={reassignTo}
                    label="Reassign to (optional)"
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
              <Button onClick={() => setCloseDialogOpen(false)}>Cancel</Button>
              <Button
                variant="contained"
                onClick={handleCloseTicket}
                disabled={!closeReason.trim() || isProcessing}
              >
                {isProcessing ? <CircularProgress size={24} /> : 'Confirm'}
              </Button>
            </DialogActions>
          </Dialog>

          <NotificationDrawer
            open={notificationDrawerOpen}
            onClose={() => setNotificationDrawerOpen(false)}
            notifications={notifications}
          />
        </Container>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default React.memo(MemberDashboard);