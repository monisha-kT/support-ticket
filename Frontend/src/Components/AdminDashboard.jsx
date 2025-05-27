
import React, { useState, useEffect } from 'react';
import {
  Box, Typography, CircularProgress, Alert, Button, Paper, Modal, Grid, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem,
  TextField, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,Badge,
  TablePagination
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { getSocket, useSocket } from './socket';
import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import Navbar from './Navbar';
import ChatWindow from './ChatWindow';
import NotificationDrawer from './NotificationDrawer';

function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedTicketDetails, setSelectedTicketDetails] = useState(null);
  const [members, setMembers] = useState([]);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [reassignTicketId, setReassignTicketId] = useState(null);
  const [closeTicketId, setCloseTicketId] = useState(null);
  const [reassignTo, setReassignTo] = useState('');
  const [closeReason, setCloseReason] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchFilters, setSearchFilters] = useState({
    id: '',
    category: '',
    priority: '',
    subject: '',
    status: '',
    last_message_at: '',
    activeStatus: '',
    closure_reason: '',
    userName: '',
    memberName: ''
  });
  const user = useStore((state) => state.user);
  const navigate = useNavigate();
  const { isConnected, error: socketError } = useSocket();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/auth');
      return;
    }
    if (!user) return;
    if (user.role !== 'admin') {
      navigate(user.role === 'user' ? '/dashboard' : '/member/tickets');
      return;
    }

    let socket = null;
    const setupSocket = async () => {
      socket = await getSocket();
      if (!socket) {
        setError('Failed to establish socket connection');
        return;
      }

      socket.on('new_ticket', fetchTickets);
      socket.on('ticket_closed', ({ ticket_id, reason, reassigned_to }) => {
        setTickets((prev) =>
          prev.map((ticket) =>
            ticket.id === ticket_id
              ? { ...ticket, status: reassigned_to ? 'reassigned' : 'closed', closure_reason: reason, reassigned_to }
              : ticket
          )
        );
        setNotifications((prev) => [
          ...prev,
          { type: 'info', message: `Ticket #${ticket_id} ${reassigned_to ? 'reassigned' : 'closed'}: ${reason}` }
        ]);
      });
      socket.on('ticket_reopened', ({ ticket_id }) => {
        setTickets((prev) =>
          prev.map((ticket) =>
            ticket.id === ticket_id
              ? { ...ticket, status: 'assigned', closure_reason: null, reassigned_to: null }
              : ticket
          )
        );
      });
      socket.on('chat_inactive', ({ ticket_id, reason }) => {
        setTickets((prev) =>
          prev.map((ticket) =>
            ticket.id === ticket_id
              ? { ...ticket, status: 'closed', closure_reason: reason }
              : ticket
          )
        );
      });
      socket.on('ticket_reassigned', ({ ticket_id, assigned_to, status }) => {
        const member = members.find(m => m.id === assigned_to);
        setTickets((prev) =>
          prev.map((ticket) =>
            ticket.id === ticket_id
              ? {
                  ...ticket,
                  assigned_to,
                  status,
                  memberName: member ? `${member.first_name} ${member.last_name}` : 'Unassigned'
                }
              : ticket
          )
        );
        setNotifications((prev) => [
          ...prev,
          { type: 'info', message: `Ticket #${ticket_id} reassigned to ${member ? `${member.first_name} ${member.last_name}` : 'Unassigned'}` }
        ]);
      });
      socket.on('ticket_inactive', ({ ticket_id, status, reason }) => {
        setTickets((prev) =>
          prev.map((ticket) =>
            ticket.id === ticket_id
              ? { ...ticket, status, closure_reason: reason }
              : ticket
          )
        );
      });
    };

    setupSocket();
    fetchTickets();
    fetchMembers();

    return () => {
      if (socket) {
        socket.off('new_ticket');
        socket.off('ticket_closed');
        socket.off('ticket_reopened');
        socket.off('chat_inactive');
        socket.off('ticket_reassigned');
        socket.off('ticket_inactive');
      }
    };
  }, [user, navigate, members]);

  useEffect(() => {
    if (socketError) {
      setError(socketError);
    }
  }, [socketError]);

  const fetchMembers = async () => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/users/members', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch members');
      const data = await res.json();
      setMembers(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchTickets = async () => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/tickets', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch tickets');
      const data = await res.json();
      const userIds = [
        ...new Set(
          data
            .map((ticket) => ticket.user_id)
            .concat(data.map((ticket) => ticket.assigned_to).filter((id) => id))
        ),
      ];
      const usersRes = await fetch('http://localhost:5000/api/users/bulk', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_ids: userIds }),
      });
      if (!usersRes.ok) throw new Error('Failed to fetch user details');
      const usersData = await usersRes.json();
      const ticketsWithDetails = data.map((ticket) => ({
        ...ticket,
        userName: usersData[ticket.user_id]
          ? `${usersData[ticket.user_id].first_name} ${usersData[ticket.user_id].last_name}`
          : 'Unknown',
        memberName: ticket.assigned_to && usersData[ticket.assigned_to]
          ? `${usersData[ticket.assigned_to].first_name} ${usersData[ticket.assigned_to].last_name}`
          : 'Unassigned',
        activeStatus:
          ticket.status === 'assigned' && ticket.last_message_at
            ? new Date(ticket.last_message_at) > new Date(Date.now() - 2 * 60 * 1000)
              ? 'Active'
              : 'Inactive'
            : 'N/A',
      }));
      setTickets(ticketsWithDetails);
      setFilteredTickets(ticketsWithDetails);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (ticket) => {
    try {
      setError(null);
      setDetailsLoading(true);
      const token = localStorage.getItem('token');
      const ticketId = ticket.id;
      
      const [ticketRes, chatRes, userRes] = await Promise.all([
        fetch(`http://localhost:5000/api/tickets/${ticket.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`http://localhost:5000/api/chats/${ticket.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`http://localhost:5000/api/users/${ticket.user_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ]);

      if (!ticketRes.ok || !chatRes.ok || !userRes.ok) {
        throw new Error('Failed to fetch ticket details');
      }

      const ticketData = await ticketRes.json();
      const chatData = await chatRes.json();
      const userData = await userRes.json();

      if (ticket.id !== ticketId) return;

      setSelectedTicketDetails({
        ...ticketData,
        userName: `${userData.first_name} ${userData.last_name}`,
        userEmail: userData.email,
      });
      
      setSelectedTicket({
        ...ticketData,
        chats: chatData,
        userName: `${userData.first_name} ${userData.last_name}`,
        userEmail: userData.email
      });
    } catch (err) {
      setError('Failed to fetch ticket details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleReassignTicket = async () => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/tickets/${reassignTicketId}/reassign`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          reassign_to: parseInt(reassignTo),
          reason: 'Reassigned by admin'
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      
      setReassignDialogOpen(false);
      setReassignTo('');
      setReassignTicketId(null);
      fetchTickets();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCloseTicket = async () => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/tickets/${closeTicketId}/close`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: closeReason || 'Closed by admin' }),
      });
      if (!res.ok) throw new Error(await res.text());
      const socket = await getSocket();
      if (socket) {
        socket.emit('ticket_closed', { ticket_id: closeTicketId, reason: closeReason || 'Closed by admin' });
      }
      setCloseDialogOpen(false);
      setCloseReason('');
      setCloseTicketId(null);
      setSelectedTicket(null);
      fetchTickets();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSearchChange = (field, value) => {
    setSearchFilters((prev) => ({ ...prev, [field]: value }));
    const filtered = tickets.filter((ticket) =>
      Object.keys(searchFilters).every((key) => {
        if (key === field && value) {
          return String(ticket[key] || '')
            .toLowerCase()
            .includes(value.toLowerCase());
        }
        if (searchFilters[key]) {
          return String(ticket[key] || '')
            .toLowerCase()
            .includes(searchFilters[key].toLowerCase());
        }
        return true;
      })
    );
    setFilteredTickets(filtered);
    setPage(0);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const columns = [
    { field: 'id', headerName: 'Ticket ID', minWidth: 100 },
    { field: 'category', headerName: 'Category', minWidth: 120 },
    { field: 'priority', headerName: 'Priority', minWidth: 100 },
    { field: 'subject', headerName: 'Subject', minWidth: 150 },
    { field: 'status', headerName: 'Status', minWidth: 100 },
    { field: 'last_message_at', headerName: 'Last Response', minWidth: 180 },
    { field: 'activeStatus', headerName: 'Active Status', minWidth: 120 },
    { field: 'closure_reason', headerName: 'Closure Reason', minWidth: 150 },
    { field: 'userName', headerName: 'Created By', minWidth: 150 },
    { field: 'memberName', headerName: 'Assigned To', minWidth: 150 },
    { field: 'actions', headerName: 'Actions', minWidth: 250 }
  ];

  return (
    <>
      <Navbar />
      <Box sx={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', bgcolor: '#f5f5f5' }}>
        <Box sx={{ p: 2, marginBottom: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 7 }}>
              Admin Dashboard
            </Typography>
            <IconButton onClick={() => setNotificationDrawerOpen(true)}>
              <Badge badgeContent={notifications.length} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Box>
        </Box>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, flexGrow: 1 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ m: 2, flexGrow: 1 }}>
            {error}
          </Alert>
        ) : (
          <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', px: 2, pb: 2 }}>
            <TableContainer component={Paper} sx={{ flexGrow: 1, maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    {columns.map((column) => (
                      <TableCell key={column.field} sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', minWidth: column.minWidth }}>
                        {column.headerName}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    {columns.map((column) => (
                      <TableCell key={column.field} sx={{ minWidth: column.minWidth }}>
                        {column.field !== 'actions' && column.field !== 'status' && column.field !== 'last_message_at' ? (
                          <TextField
                            size="small"
                            placeholder={`Search ${column.headerName}`}
                            value={searchFilters[column.field]}
                            onChange={(e) => handleSearchChange(column.field, e.target.value)}
                            fullWidth
                          />
                        ) : column.field === 'status' ? (
                          <FormControl fullWidth size="small">
                            <InputLabel>Status</InputLabel>
                            <Select
                              value={searchFilters.status}
                              label="Status"
                              onChange={(e) => handleSearchChange('status', e.target.value)}
                            >
                              <MenuItem value="">All</MenuItem>
                              <MenuItem value="open">Open</MenuItem>
                              <MenuItem value="assigned">Assigned</MenuItem>
                              <MenuItem value="inactive">Inactive</MenuItem>
                              <MenuItem value="reassigned">Reassigned</MenuItem>
                              <MenuItem value="closed">Closed</MenuItem>
                              <MenuItem value="rejected">Rejected</MenuItem>
                            </Select>
                          </FormControl>
                        ) : column.field === 'last_message_at' ? (
                          <Box sx={{ minWidth: 180 }} />
                        ) : null}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredTickets
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell>{ticket.id}</TableCell>
                        <TableCell>{ticket.category}</TableCell>
                        <TableCell>{ticket.priority}</TableCell>
                        <TableCell>{ticket.subject}</TableCell>
                        <TableCell>
                          <Typography
                            sx={{
                              bgcolor:
                                ticket.status === 'open' ? 'warning.main' :
                                ticket.status === 'assigned' ? 'info.main' :
                                ticket.status === 'inactive' ? 'error.main' :
                                ticket.status === 'reassigned' ? 'secondary.main' :
                                ticket.status === 'closed' ? 'success.main' :
                                ticket.status === 'rejected' ? 'error.main' : 'inherit',
                              color: 'white',
                              px: 2,
                              py: 0.5,
                              borderRadius: 1,
                              display: 'inline-block',
                            }}
                          >
                            {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {ticket.last_message_at
                            ? new Date(ticket.last_message_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })
                            : 'N/A'}
                        </TableCell>
                        <TableCell>{ticket.activeStatus}</TableCell>
                        <TableCell>{ticket.closure_reason || 'N/A'}</TableCell>
                        <TableCell>{ticket.userName}</TableCell>
                        <TableCell>{ticket.memberName}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              variant="contained"
                              size="small"
                              onClick={() => handleViewDetails(ticket)}
                            >
                              View Details
                            </Button>
                            {ticket.status !== 'closed' && ticket.status !== 'rejected' && (
                              <>
                                <Button
                                  variant="contained"
                                  size="small"
                                  color="secondary"
                                  onClick={() => {
                                    setReassignTicketId(ticket.id);
                                    setReassignDialogOpen(true);
                                  }}
                                >
                                  Reassign
                                </Button>
                                <Button
                                  variant="contained"
                                  size="small"
                                  color="error"
                                  onClick={() => {
                                    setCloseTicketId(ticket.id);
                                    setCloseDialogOpen(true);
                                  }}
                                >
                                  Close
                                </Button>
                              </>
                            )}
                          </Box>
                        </TableCell>
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
          </Box>
        )}
        <Modal
          open={Boolean(selectedTicket)}
          onClose={() => setSelectedTicket(null)}
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-labelledby="ticket-details-modal"
          aria-describedby="ticket-details-description"
        >
          <Paper sx={{ width: '90%', height: '90vh', maxWidth: 1200, p: 3, position: 'relative', overflow: 'hidden' }}>
            {detailsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress />
              </Box>
            ) : selectedTicket && (
              <Grid container spacing={2} sx={{ height: '100%' }}>
                <Grid item xs={4}>
                  <Paper elevation={2} sx={{ p: 2, height: '100%', overflow: 'auto' }}>
                    <Typography variant="h6" gutterBottom id="ticket-details-modal">Ticket Details</Typography>
                    <Divider sx={{ my: 2 }} />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }} id="ticket-details-description">
                      <Typography><strong>Ticket ID:</strong> #{selectedTicket.id}</Typography>
                      <Typography><strong>Subject:</strong> {selectedTicket.subject}</Typography>
                      <Typography><strong>Created By:</strong> {selectedTicketDetails?.userName || 'Loading...'}</Typography>
                      <Typography><strong>User Email:</strong> {selectedTicketDetails?.userEmail || 'Loading...'}</Typography>
                      <Typography><strong>Category:</strong> {selectedTicket.category}</Typography>
                      <Typography><strong>Priority:</strong> {selectedTicket.priority}</Typography>
                      <Typography><strong>Status:</strong> {selectedTicket.status.charAt(0).toUpperCase() + selectedTicket.status.slice(1)}</Typography>
                      <Typography><strong>Active Status:</strong> {selectedTicket.activeStatus}</Typography>
                      {selectedTicket.closure_reason && (
                        <Typography><strong>Closure Reason:</strong> {selectedTicket.closure_reason}</Typography>
                      )}
                      {selectedTicket.reassigned_to && (
                        <Typography><strong>Reassigned To:</strong> Member ID {selectedTicket.reassigned_to}</Typography>
                      )}
                      <Typography><strong>Created:</strong> {new Date(selectedTicket.created_at).toLocaleString()}</Typography>
                      <Typography><strong>Description:</strong></Typography>
                      <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                        {selectedTicket.description}
                      </Paper>
                      {selectedTicket.assigned_to && (
                        <>
                          <Typography><strong>Current Status:</strong></Typography>
                          <Alert
                            severity={
                              selectedTicket.status === 'open' ? 'warning' :
                              selectedTicket.status === 'assigned' ? 'info' :
                              selectedTicket.status === 'reassigned' ? 'secondary' :
                              selectedTicket.status === 'rejected' ? 'error' : 'success'
                            }
                          >
                            {selectedTicket.status.charAt(0).toUpperCase() + selectedTicket.status.slice(1)}
                          </Alert>
                        </>
                      )}
                    </Box>
                  </Paper>
                </Grid>
                <Grid item xs={8}>
                  <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6">Chat History</Typography>
                      <Button variant="outlined" onClick={() => setSelectedTicket(null)}>
                        Close
                      </Button>
                    </Box>
                    <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                      <ChatWindow
                        ticketId={selectedTicket.id}
                        readOnly={false}
                        initialMessages={selectedTicket.chats}
                      />
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            )}
          </Paper>
        </Modal>
        <Dialog open={reassignDialogOpen} onClose={() => setReassignDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Reassign Ticket</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Reassign To</InputLabel>
                <Select
                  value={reassignTo}
                  label="Reassign To"
                  onChange={(e) => setReassignTo(e.target.value)}
                >
                  <MenuItem value="">Select Member</MenuItem>
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
            <Button onClick={() => setReassignDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleReassignTicket}
              disabled={!reassignTo}
            >
              Confirm
            </Button>
          </DialogActions>
        </Dialog>
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
                placeholder="Enter reason for closing the ticket"
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
        <NotificationDrawer
          open={notificationDrawerOpen}
          onClose={() => setNotificationDrawerOpen(false)}
          notifications={notifications}
        />
      </Box>
    </>
  );
}

export default AdminDashboard;