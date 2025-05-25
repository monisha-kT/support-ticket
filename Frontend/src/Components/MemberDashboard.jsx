import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, CircularProgress, Alert, Button, Container, Paper, Modal, Grid, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Select, MenuItem, FormControl, InputLabel,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, TableSortLabel,
  InputAdornment, IconButton
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { getSocket } from './socket';
import { useNavigate, useParams } from 'react-router-dom';
import useStore from '../store/useStore';
import Navbar from './Navbar';
import ChatWindow from './ChatWindow';

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
  const [notifications, setNotifications] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [order, setOrder] = useState('asc');
  const [orderBy, setOrderBy] = useState('id');
  const [searchValues, setSearchValues] = useState({
    id: '',
    userName: '',
    category: '',
    urgency: '',
    status: '',
    lastResponseTime: ''
  });

  const user = useStore((state) => state.user);
  const navigate = useNavigate();
  const { ticketId } = useParams();
  const socketRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !user) {
      navigate('/auth');
      return;
    }

    socketRef.current = getSocket();
    
    socketRef.current.on('new_ticket', fetchTickets);
    socketRef.current.on('ticket_reassigned', fetchTickets);
    socketRef.current.on('ticket_reopened', fetchTickets);
    socketRef.current.on('chat_inactive', ({ ticket_id, reason, reassigned_to }) => {
      setTickets(prev => prev.map(t => 
        t.id === ticket_id ? { ...t, status: 'closed', closure_reason: reason, reassigned_to } : t
      ));
    });

    fetchTickets();
    fetchMembers();

    return () => {
      if (socketRef.current) {
        socketRef.current.off('new_ticket');
        socketRef.current.off('ticket_reassigned');
        socketRef.current.off('chat_inactive');
        socketRef.current.off('ticket_reopened');
      }
    };
  }, [user, navigate]);

  useEffect(() => {
    if (ticketId && tickets.length > 0) {
      const ticket = tickets.find(t => t.id === parseInt(ticketId));
      if (ticket) {
        handleTicketSelect(ticket.id);
      }
    }
  }, [ticketId, tickets]);

  useEffect(() => {
    filterTickets();
  }, [tickets, searchValues]);

  const filterTickets = () => {
    let filtered = tickets.filter(ticket => {
      return Object.keys(searchValues).every(key => {
        if (!searchValues[key]) return true;
        return String(ticket[key]).toLowerCase().includes(searchValues[key].toLowerCase());
      });
    });
    setFilteredTickets(filtered);
  };

  const fetchTickets = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/tickets', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch tickets');
      
      const data = await res.json();
      const userIds = [...new Set(data.map(ticket => ticket.user_id))];
      
      const usersRes = await fetch('http://localhost:5000/api/users/bulk', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_ids: userIds }),
      });
      
      if (!usersRes.ok) throw new Error('Failed to fetch user details');
      const usersData = await usersRes.json();
      
      const ticketsWithDetails = data.map(ticket => ({
        ...ticket,
        userName: usersData[ticket.user_id] 
          ? `${usersData[ticket.user_id].first_name} ${usersData[ticket.user_id].last_name}`
          : 'Unknown',
        userEmail: usersData[ticket.user_id]?.email || 'N/A',
        lastResponseTime: ticket.last_message_at 
          ? new Date(ticket.last_message_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
          : 'No response yet'
      }));
      
      setTickets(ticketsWithDetails);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/users/members', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch members');
      setMembers(await res.json());
    } catch (err) {
      setError(err.message);
    }
  };

  const handleTicketSelect = async (ticketId) => {
    try {
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
        throw new Error('Failed to fetch ticket details');
      }
      
      const ticketData = await ticketRes.json();
      const chatData = await chatRes.json();
      
      const userRes = await fetch(`http://localhost:5000/api/users/${ticketData.user_id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (!userRes.ok) throw new Error('Failed to fetch user details');
      const userData = await userRes.json();
      
      setSelectedTicket({
        ...ticketData,
        userName: `${userData.first_name} ${userData.last_name}`,
        userEmail: userData.email,
        chatHistory: chatData
      });
      
      navigate(`/member/tickets/${ticketId}`);
    } catch (err) {
      setError(err.message);
    }
  };

const handleCloseTicket = async () => {
  if (!closeReason.trim()) {
    setError('Closure reason is required');
    return;
  }

  try {
    const token = localStorage.getItem('token');
    const status = reassignTo ? 'reassigned' : 'closed';
    const res = await fetch(`http://localhost:5000/api/tickets/${selectedTicket.id}/close`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason: closeReason,
        reassign_to: reassignTo || null,
        status
      }),
    });

    if (!res.ok) throw new Error(await res.text());

    setCloseDialogOpen(false);
    setCloseReason('');
    setReassignTo('');
    fetchTickets();
    setSelectedTicket(null);
    navigate('/member/tickets');
  } catch (err) {
    setError(err.message);
  }
};

  const handleAcceptTicket = async (ticketId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/tickets/${ticketId}/assign`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'assigned' }),
      });
      
      if (!res.ok) throw new Error('Failed to accept ticket');
      
      fetchTickets();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRejectTicket = async (ticketId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/tickets/${ticketId}/reject`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'rejected' }),
      });
      
      if (!res.ok) throw new Error('Failed to reject ticket');
      
      fetchTickets();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReopenTicket = async (ticketId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/tickets/${ticketId}/reopen`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!res.ok) throw new Error('Failed to reopen ticket');
      
      fetchTickets();
    } catch (err) {
      setError(err.message);
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
    if (b[orderBy] < a[orderBy]) {
      return -1;
    }
    if (b[orderBy] > a[orderBy]) {
      return 1;
    }
    return 0;
  };

  const renderStatusCell = (status) => (
    <Typography
      sx={{
        bgcolor:
          status === 'open' ? 'warning.main' :
        status === 'assigned' ? 'info.main' :
        status === 'closed' ? 'success.main' :
        status === 'reassigned' ? 'primary.main' : 'error.main',
        color: 'white',
        px: 2,
        py: 0.5,
        borderRadius: 1,
        display: 'inline-block',
      }}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Typography>
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
      {ticket.status === 'assigned' && (
        <>
          <Button
            variant="contained"
            size="small"
            onClick={() => handleTicketSelect(ticket.id)}
          >
            View
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
  );

  const headers = [
    { id: 'id', label: 'Ticket ID' },
    { id: 'userName', label: 'Created By' },
    { id: 'category', label: 'Category' },
    { id: 'urgency', label: 'Urgency' },
    { id: 'status', label: 'Status' },
    { id: 'lastResponseTime', label: 'Last Response' },
    { id: 'actions', label: 'Actions' }
  ];

  if (loading) {
    return (
      <>
        <Navbar />
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <CircularProgress />
        </Box>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navbar />
        <Box sx={{ p: 2, mt: 8 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <Container maxWidth="xl" sx={{ mt: 10, mb: 4 ,overflow:'hidden'}}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold' }}>
            Member Support Dashboard
          </Typography>
        </Box>

        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 230px)' }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  {headers.map((header) => (
                    <TableCell key={header.id}>
                      {header.id !== 'actions' ? (
                        <>
                          <TableSortLabel
                            active={orderBy === header.id}
                            direction={orderBy === header.id ? order : 'asc'}
                            onClick={() => handleRequestSort(header.id)}
                          >
                            {header.label}
                          </TableSortLabel>
                          <TextField
                            size="small"
                            variant="standard"
                            value={searchValues[header.id] || ''}
                            onChange={handleSearchChange(header.id)}
                            placeholder={`Search ${header.label}`}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <SearchIcon fontSize="small" />
                                </InputAdornment>
                              ),
                            }}
                            sx={{ mt: 1, width: '100%' }}
                          />
                        </>
                      ) : (
                        header.label
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {stableSort(filteredTickets, getComparator(order, orderBy))
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((ticket) => (
                    <TableRow key={ticket.id} hover>
                      <TableCell>#{ticket.id}</TableCell>
                      <TableCell>{ticket.userName}</TableCell>
                      <TableCell>{ticket.category}</TableCell>
                      <TableCell>{ticket.urgency}</TableCell>
                      <TableCell>{renderStatusCell(ticket.status)}</TableCell>
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
      </Container>
    </>
  );
}

export default MemberDashboard;

