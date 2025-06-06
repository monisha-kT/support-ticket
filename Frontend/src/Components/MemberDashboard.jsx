import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, CircularProgress, Alert, Button, Container, Paper, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem, FormControl, InputLabel,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, TableSortLabel,
  InputAdornment
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import { getSocket } from './socket';
import { useNavigate, useParams } from 'react-router-dom';
import useStore from '../store/useStore';
import Navbar from '../Components/Navbar';
import NotificationDrawer from './NotificationDrawer';
import ErrorBoundary from './ErrorBoundary';

const theme = createTheme({
  typography: {
    fontFamily: '"Open Sans", sans-serif',
    h5: {
      fontSize: '26px',
      fontWeight: 'bold'
    },
    body1: {
      fontSize: '16px'
    }
  },
  components: {
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontSize: '16px',
          padding: '12px 16px'
        },
        head: {
          backgroundColor: '#128C7E',
          color: 'white',
          fontWeight: 'bold'
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'capitalize',
          fontSize: '14px',
          padding: '6px 16px',
          minWidth: '80px'
        }
      }
    },
    MuiTableSortLabel: {
      styleOverrides: {
        root: {
          color: 'white !important',
          '&:hover': {
            color: 'white !important'
          },
          '&.Mui-active': {
            color: 'white !important'
          }
        },
        icon: {
          color: 'white !important'
        }
      }
    }
  }
});

function MemberDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [reassignTo, setReassignTo] = useState('');
  const [members, setMembers] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [order, setOrder] = useState('desc');
  const [orderBy, setOrderBy] = useState('created_at');
  const [searchValues, setSearchValues] = useState({
    id: '',
    userName: '',
    category: '',
    priority: '',
    status: '',
    createdAt: '',
    lastMessageAt: '',
    lastResponseTime: ''
  });
  const [notifications, setNotifications] = useState([]);

  const user = useStore((state) => state.user);
  const navigate = useNavigate();
 const { ticket_id } = useParams();
  const socketRef = useRef(null);

  const fetchTickets = async () => {
  try {
    setError(null);
    const token = localStorage.getItem('token');
    const res = await fetch('http://localhost:5000/api/tickets', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch tickets');

    const data = await res.json();
    const userIds = [...new Set(data.map(ticket => ticket.user_id).filter(id => id))];

    const usersRes = await fetch('http://localhost:5000/api/users/bulk', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user_ids: userIds })
    });

    if (!usersRes.ok) throw new Error('Failed to fetch user details');
    const usersData = await usersRes.json(); // Fix: Use usersRes instead of res

    const ticketsWithDetails = data.map(ticket => ({
      ...ticket,
      userName: usersData[ticket.user_id]
        ? `${usersData[ticket.user_id].first_name} ${usersData[ticket.user_id].last_name}`
        : 'Unknown',
      userEmail: usersData[ticket.user_id]?.email || 'N/A',
      created_at: ticket.created_at ? new Date(ticket.created_at) : null,
      createdAtFormatted: ticket.created_at
        ? (() => {
            const date = new Date(ticket.created_at);
            const day = String(date.getDate()).padStart(2, '0');
            const month = date.toLocaleString('en-US', { month: 'short' });
            const year = date.getFullYear();
            return `${day} ${month} ${year}`;
          })()
        : 'N/A',
      lastResponseDate: ticket.last_message_at
        ? (() => {
            const date = new Date(ticket.last_message_at);
            const day = String(date.getDate()).padStart(2, '0');
            const month = date.toLocaleString('en-US', { month: 'short' });
            const year = date.getFullYear();
            return `${day} ${month} ${year}`;
          })()
        : 'No messaging yet',
      lastResponseTime: ticket.last_message_at
        ? new Date(ticket.last_message_at).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Kolkata'
          })
        : 'No messaging yet',
      last_message_at: ticket.last_message_at ? new Date(ticket.last_message_at) : null
    }));

    setTickets(ticketsWithDetails);
    setFilteredTickets(ticketsWithDetails);
  } catch (err) {
    console.error('Fetch tickets error:', err);
    setError(err.message);
  } finally {
    setLoading(false);
  }
};

  const fetchMembers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/users/members', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch members');
      setMembers(await res.json());
    } catch (err) {
      console.error('Fetch members error:', err);
      setError(err.message);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      const token = localStorage.getItem('token');
      if (!token || !user) {
        navigate('/login');
        return;
      }

      const socket = await getSocket();
      if (!socket) {
        setError('Failed to initialize real-time connection');
        setLoading(false);
        return;
      }

      socketRef.current = socket;
      socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
        socket.emit('join', { ticket_id: 'members' });
        socket.emit('join', { ticket_id: user.id });
      });

      socket.on('new_ticket', () => {
        console.log('Received new_ticket event');
        fetchTickets();
      });

      socket.on('ticket_accepted', ({ ticket_id, member_id }) => {
        console.log('Received ticket_accepted:', { ticket_id, member_id });
        setTickets(prev =>
          prev.map(ticket =>
            ticket.id === ticket_id ? { ...ticket, status: 'assigned', assigned_to: member_id } : ticket
          )
        );
        if (selectedTicket?.id === ticket_id) {
          setSelectedTicket(prev => ({ ...prev, status: 'assigned', assigned_to: member_id }));
        }
        if (user.id === member_id.toString()) {
          setNotifications(prev => [
            ...prev,
            { type: 'info', message: `Ticket #${ticket_id} has been assigned to you.` }
          ]);
        }
        fetchTickets();
      });

      socket.on('ticket_reassigned', ({ ticket_id, assigned_to, status }) => {
        console.log('Received ticket_reassigned:', { ticket_id, assigned_to, status });
        setTickets(prev =>
          prev.map(ticket =>
            ticket.id === ticket_id ? { ...ticket, status, assigned_to } : ticket
          )
        );
        if (selectedTicket?.id === ticket_id) {
          setSelectedTicket(prev => ({ ...prev, status, assigned_to }));
        }
        if (user.id === assigned_to.toString()) {
          setNotifications(prev => [
            ...prev,
            { type: 'info', message: `Ticket #${ticket_id} has been reassigned to you.` }
          ]);
        }
        fetchTickets();
      });

      socket.on('ticket_closed', ({ ticket_id, reason, status }) => {
        console.log('Received ticket_closed:', { ticket_id, reason, status });
        setTickets(prev =>
          prev.map(ticket =>
            ticket.id === ticket_id ? { ...ticket, status, closure_reason: reason } : ticket
          )
        );
        if (selectedTicket?.id === ticket_id) {
          setSelectedTicket(null);
          navigate('/member/tickets');
        }
        fetchTickets();
      });

      socket.on('ticket_reopened', ({ ticket_id }) => {
        console.log('Received ticket_reopened:', ticket_id);
        fetchTickets();
      });

      socket.on('chat_inactive', ({ ticket_id, reason }) => {
        console.log('Received chat_inactive:', { ticket_id, reason });
        setTickets(prev =>
          prev.map(ticket =>
            ticket.id === ticket_id ? { ...ticket, status: 'closed', closure_reason: reason } : ticket
          )
        );
        if (selectedTicket?.id === ticket_id) {
          setSelectedTicket(null);
          navigate('/member/tickets');
        }
        fetchTickets();
      });

      socket.on('connect_error', (err) => {
        console.error('Socket connection error:', err.message);
        setError('Socket error: ' + err.message);
      });

      await Promise.all([fetchTickets(), fetchMembers()]);
    };

    initialize();
    const pollInterval = setInterval(fetchTickets, 30000);

    return () => {
      clearInterval(pollInterval);
      if (socketRef.current) {
        socketRef.current.emit('leave', { ticket_id: 'members' });
        socketRef.current.emit('leave', { ticket_id: user.id });
        socketRef.current.off('new_ticket');
        socketRef.current.off('ticket_accepted');
        socketRef.current.off('reassigned_to');
        socketRef.current.off('ticket_closed');
        socketRef.current.off('ticket_reopened');
        socketRef.current.off('chat_inactive');
        socketRef.current.off('connect_error');
        socketRef.current.disconnect();
      }
    };
  }, [user, navigate]);

  useEffect(() => {
    if (ticket_id && tickets.length > 0) {
      const ticket = tickets.find(t => t.id === parseInt(id));
      if (ticket) handleTicketSelect(ticket);
    }
  }, [ticket_id, tickets]);

  useEffect(() => {
    filterTickets();
  }, [tickets, searchValues]);

  const filterTickets = () => {
    let filtered = tickets.filter(ticket => {
      return Object.keys(searchValues).every(key => {
        if (!searchValues[key]) return true;
        let value;
        if (key === 'createdAt') value = ticket.createdAtFormatted;
        else if (key === 'lastMessageAt') value = ticket.lastResponseDate;
        else if (key === 'lastResponseTime') value = ticket.lastResponseTime;
        else value = ticket[key];
        return String(value || '').toLowerCase().includes(searchValues[key].toLowerCase());
      });
    });
    setFilteredTickets(filtered);
  };

  const handleTicketSelect = async (ticket) => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      const [ticketRes, chatRes] = await Promise.all([
        fetch(`http://localhost:5000/api/tickets/${ticket.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`http://localhost:5000/api/chats/${ticket.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (!ticketRes.ok || !chatRes.ok) throw new Error('Failed to fetch ticket details');

      const ticketData = await ticketRes.json();
      const chatData = await chatRes.json();

      const userRes = await fetch(`http://localhost:5000/api/users/${ticketData.user_id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!userRes.ok) throw new Error('Failed to fetch user details');
      const userData = await userRes.json();

      setSelectedTicket({
        ...ticketData,
        userName: `${userData.first_name} ${userData.last_name}`,
        userEmail: userData.email,
        chatHistory: chatData
      });

      navigate(`/member/tickets/${ticket.id}`);
    } catch (err) {
      console.error('Ticket select error:', err);
      setError(err.message);
    }
  };

  const handleCloseTicket = async () => {
      if (creating) return; 
  setCreating(true);
    if (!closeReason.trim()) {
      setError('Closure reason is required');
      return;
    }

    try {
      setError(null);
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/tickets/${selectedTicket.id}/close`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: closeReason,
          reassign_to: reassignTo ? parseInt(reassignTo) : null
        })
      });

      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || 'Failed to close/reassign ticket');

      const isReassigned = !!reassignTo;
      setNotifications(prev => [
        ...prev,
        { type: 'success', message: `Ticket #${selectedTicket.id} ${isReassigned ? `reassigned to ${members.find(m => m.id === parseInt(reassignTo))?.name}` : 'closed'}` }
      ]);

      if (socketRef.current) {
        socketRef.current.emit('ticket_closed', {
          ticket_id: selectedTicket.id,
          reason: closeReason,
          reassign_to: reassignTo ? parseInt(reassignTo) : null,
          status: isReassigned ? 'reassigned' : 'closed'
        });
      }

      setCloseDialogOpen(false);
      setCloseReason('');
      setReassignTo('');
      if (!isReassigned) {
        setSelectedTicket(null);
        navigate('/member/tickets');
      }
      fetchTickets();
    } catch (err) {
      console.error('Close ticket error:', err);
      setError(err.message);
      setNotifications(prev => [
        ...prev,
        { type: 'error', message: `Failed: ${err.message}` }
      ]);
    }
     finally {
    setCreating(false); 
  }
  };

  const handleAcceptTicket = async (ticketId) => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/tickets/${ticketId}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) throw new Error('Failed to accept ticket');

      if (socketRef.current) {
        socketRef.current.emit('ticket_accepted', {
          ticket_id: ticketId,
          member_id: user.id
        });
      }

      setNotifications(prev => [
        ...prev,
        { type: 'success', message: `Ticket #${ticketId} accepted` }
      ]);
      fetchTickets();
    } catch (err) {
      console.error('Accept ticket error:', err);
      setError(err.message);
      setNotifications(prev => [
        ...prev,
        { type: 'error', message: `Accept failed: ${err.message}` }
      ]);
    }
  };

  const handleRejectTicket = async (ticketId) => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/tickets/reject/${ticketId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) throw new Error('Failed to reject ticket');

      setNotifications(prev => [
        ...prev,
        { type: 'success', message: `Ticket #${ticketId} rejected` }
      ]);
      fetchTickets();
    } catch (err) {
      console.error('Reject ticket error:', err);
      setError(err.message);
      setNotifications(prev => [
        ...prev,
        { type: 'error', message: `Reject failed: ${err.message}` }
      ]);
    }
  };

  const handleReopenTicket = async (ticketId) => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/tickets/${ticketId}/reopen`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) throw new Error('Failed to reopen ticket');

      setNotifications(prev => [
        ...prev,
        { type: 'success', message: `Ticket #${ticketId} reopened` }
      ]);
      fetchTickets();
    } catch (err) {
      console.error('Reopen ticket error:', err);
      setError(err.message);
      setNotifications(prev => [
        ...prev,
        { type: 'error', message: `Reopen failed: ${err.message}` }
      ]);
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleSearchChange = (prop) => (event) => {
    setSearchValues({ ...searchValues, [prop]: event.target.value });
  };

  const stableSort = (array, comparator) => {
    const stabilizedThis = array.map((el, index) => [el, index]);
    stabilizedThis.sort((a, b) => {
      const order = comparator(a[0], b[0]);
      if (order !== 0) return order;
      return a[1] - b[1];
    });
    return stabilizedThis.map((el) => el[0]);
  };

  const getComparator = (order, orderBy) => {
    return order === 'desc'
      ? (a, b) => descendingComparator(a, b, orderBy)
      : (a, b) => -descendingComparator(a, b, orderBy);
  };

  const descendingComparator = (a, b, orderBy) => {
    if (orderBy === 'created_at' || orderBy === 'last_message_at') {
      const aValue = a[orderBy] || new Date(0);
      const bValue = b[orderBy] || new Date(0);
      return bValue - aValue;
    }
    if (b[orderBy] < a[orderBy]) return -1;
    if (b[orderBy] > a[orderBy]) return 1;
    return 0;
  };

  const renderStatusBadge = (status) => (
    <Box sx={{
      color: status === 'open' ? 'warning.main' :
        status === 'assigned' ? 'info.main' :
        status === 'inactive' ? 'error.main' :
        status === 'reassigned' ? 'secondary.main' :
        status === 'closed' ? 'success.main' :
        status === 'rejected' ? 'error.main' : 'inherit',
      lineHeight: '32px',
      textAlign: 'center',
      display: 'inline-block',
      font: 'Open Sans',
      fontSize: '16px',
      fontWeight: '700',
      textTransform: 'capitalize'
    }}>
      {status}
    </Box>
  );

  const renderActionButtons = (ticket) => (
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
      {(ticket.status === 'assigned' || ticket.status === 'reassigned') && (
        <>
          <Button
            variant="contained"
            size="small"
            onClick={() => handleTicketSelect(ticket)}
          >
            View
          </Button>
          <Button
            variant="outlined"
            color="error"
            size="small"
            onClick={() => {
              setSelectedTicket(ticket);
              setCloseDialogOpen(true);
            }}
          >
            Reassign/Close
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
  );

  const headers = [
    { label: 'Ticket ID', id: 'auto_generated_key' },
    { label: 'Created By', id: 'userName' },
    { label: 'Category', id: 'category' },
    { label: 'Priority', id: 'priority' },
    { label: 'Status', id: 'status' },
    { label: 'Created At', id: 'createdAt' },
    { label: 'Last Response Date', id: 'lastMessageAt' },
    { label: 'Last Response Time', id: 'lastResponseTime' },
    { label: 'Actions', id: 'actions' }
  ];

  if (loading) {
    return (
      <ErrorBoundary>
        <Navbar />
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <CircularProgress />
        </Box>
      </ErrorBoundary>
    );
  }

  if (error) {
    return (
      <ErrorBoundary>
        <Navbar />
        <Box sx={{ p: 2, mt: 8 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      </ErrorBoundary>
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
            <TableContainer sx={{ maxHeight: 'calc(100vh - 220px)', overflowX: 'auto' }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    {headers.map((header) => (
                      <TableCell
                        key={header.id}
                        sx={{
                          whiteSpace: 'nowrap',
                          backgroundColor: '#007007',
                          color: 'white'
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
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {header.id !== 'actions' && (
                          <TextField
                            size="small"
                            variant="outlined"
                            value={searchValues[header.id] || ''}
                            onChange={handleSearchChange(header.id)}
                            placeholder={`Filter ${header.label}`}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <SearchIcon fontSize="small" sx={{ color: 'black' }} />
                                </InputAdornment>
                              ),
                              sx: { color: 'black' }
                            }}
                            sx={{
                              mt: 1,
                              width: '100%',
                              '& .MuiOutlinedInput-root': {
                                '& fieldset': { borderColor: 'rgba(0,0,0,0.2)' },
                                '&:hover fieldset': { borderColor: 'rgba(0,0,0,0.5)' }
                              }
                            }}
                          />
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stableSort(filteredTickets, getComparator(order, orderBy))
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((ticket) => (
                      <TableRow hover key={ticket.id}>
                        <TableCell>{ticket.auto_generated_key}</TableCell>
                        <TableCell>{ticket.userName}</TableCell>
                        <TableCell>{ticket.category}</TableCell>
                        <TableCell>{ticket.priority}</TableCell>
                        <TableCell>{renderStatusBadge(ticket.status)}</TableCell>
                        <TableCell>{ticket.createdAtFormatted}</TableCell>
                        <TableCell>{ticket.lastResponseDate}</TableCell>
                        <TableCell>{ticket.lastResponseTime}</TableCell>
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
            <DialogTitle>Reassign or Close Ticket</DialogTitle>
            <DialogContent>
              <Box sx={{ mt: 2 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Reason for action"
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
                    <MenuItem value="">None (Close Ticket)</MenuItem>
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
                disabled={!closeReason.trim()}
              >
                Confirm
              </Button>
            </DialogActions>
          </Dialog>

          <NotificationDrawer
            open={notifications.length > 0}
            onClose={() => setNotifications([])}
            notifications={notifications}
          />
        </Container>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default MemberDashboard;