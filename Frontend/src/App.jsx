import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,

} from "react-router-dom";
import { Box } from "@mui/material";
import UserDashboard from "./Components/UserDashboard";
import MemberDashboard from "./Components/MemberDashboard";
import AdminDashboard from "./Components/AdminDashboard";
import AuthForm from "./Components/AuthForm";
import Navbar from "./Components/Navbar";
import ProtectedRoute from "./Components/ProtectedRoute";
// import UserChat from "./Components/UserChat";
import useStore from "./store/useStore";
import TicketPage from "./Components/TicketPage";   
import Main from "./Components/Min";

import { useEffect } from "react";

function RedirectHandler() {
  const { user, initializeUser } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      const { user: initializedUser, route } = await initializeUser();
      if (initializedUser) {
        navigate(route, { replace: true });
      } else {
        navigate("/auth", { replace: true });
      }
    };
    init();
  }, [initializeUser, navigate]);

  return null; // This component only handles redirection
}

import Min from "./Components/Min";
import UserTicketsPage from "./Components/UserTicketsPage";
import UserChatPage from "./Components/UserChatPage";

function App() {
  const { user } = useStore();

  return (
    <Router>
      <Routes>
        <Route path="/" element={<RedirectHandler />} />
        <Route path="/auth" element={<AuthForm />} />
        <Route path="/dashboard" element={<Min />} />
        <Route path="/user/tickets" element={<UserChatPage />} />
        <Route path="/user/tickets/:ticketId" element={<UserChatPage />} />
        <Route path="/member/tickets/:ticketId" element={<TicketPage />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    </Router>
  );
}

// Utility function to determine dashboard route based on role

export default App;


// import React, { useEffect, useRef } from 'react';
// import {
//   BrowserRouter as Router,
//   Routes,
//   Route,
//   Navigate,
//   useNavigate,
// } from 'react-router-dom';
// import { Box } from '@mui/material';
// import UserDashboard from './Components/UserDashboard';
// import MemberDashboard from './Components/MemberDashboard';
// import AdminDashboard from './Components/AdminDashboard';
// import AuthForm from './Components/AuthForm';
// import Navbar from './Components/Navbar';
// import ProtectedRoute from './Components/ProtectedRoute';
// import TicketPage from './Components/TicketPage';
// import Main from './Components/Min';
// import UserChatPage from './Components/UserChatPage';
// import useStore from './store/useStore';
// import { getSocket } from './Components/socket';

// function RedirectHandler() {
//   const { user, initializeUser } = useStore();
//   const navigate = useNavigate();

//   useEffect(() => {
//     const init = async () => {
//       const { user: initializedUser, route } = await initializeUser();
//       if (initializedUser) {
//         navigate(route, { replace: true });
//       } else {
//         navigate('/auth', { replace: true });
//       }
//     };
//     init();
//   }, [initializeUser, navigate]);

//   return null; // This component only handles redirection
// }

// function App() {
//   const { user, fetchTickets, updateTicket, tickets } = useStore();
//   const socketRef = useRef(null);

//   useEffect(() => {
//     const initializeSocket = async () => {
//       try {
//         const socket = await getSocket();
//         if (!socket) {
//           console.error('Failed to initialize socket connection');
//           return;
//         }
//         socketRef.current = socket;

//         socket.on('ticket_closed', ({ ticket_id, reason, reassigned_to }) => {
//           console.log('Received ticket_closed event:', { ticket_id, reason, reassigned_to });
//           updateTicket(ticket_id, { status: 'closed', closure_reason: reason, reassigned_to });
//         });

//         socket.on('ticket_reassigned', ({ ticket_id, reassigned_to }) => {
//           console.log('Received ticket_reassigned event:', { ticket_id, reassigned_to });
//           updateTicket(ticket_id, { status: 'reassigned', reassigned_to });
//         });

//         socket.on('ticket_reopened', ({ ticket_id }) => {
//           console.log('Received ticket_reopened event:', { ticket_id });
//           updateTicket(ticket_id, { status: 'assigned', closure_reason: null, reassigned_to: null });
//         });

//         socket.on('chat_inactive', ({ ticket_id, reason }) => {
//           console.log('Received chat_inactive event:', { ticket_id, reason });
//           updateTicket(ticket_id, { status: 'closed', closure_reason: reason });
//         });

//         socket.on('new_message', ({ ticket_id, message }) => {
//           console.log('Received new_message event:', { ticket_id, message });
//           updateTicket(ticket_id, {
//             chatHistory: [...(tickets.find((t) => t.id === ticket_id)?.chatHistory || []), message],
//           });
//         });
//       } catch (err) {
//         console.error('Socket initialization failed:', err);
//       }
//     };

//     if (user) {
//       initializeSocket();
//       fetchTickets();
//     }

//     return () => {
//       if (socketRef.current) {
//         socketRef.current.off('ticket_closed');
//         socketRef.current.off('ticket_reassigned');
//         socketRef.current.off('ticket_reopened');
//         socketRef.current.off('chat_inactive');
//         socketRef.current.off('new_message');
//         socketRef.current.off('joined');
//       }
//     };
//   }, [user, fetchTickets, updateTicket, tickets]);

//   return (
//     <Router>
//       <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
//         {user && <Navbar />} {/* Render Navbar only for authenticated users */}
//         <Routes>
//           <Route path="/" element={<RedirectHandler />} />
//           <Route path="/auth" element={<AuthForm />} />
//           <Route
//             path="/dashboard"
//             element={
//               <ProtectedRoute>
//                 <Main />
//               </ProtectedRoute>
//             }
//           />
//           <Route
//             path="/user/tickets"
//             element={
//               <ProtectedRoute role="user">
//                 <UserDashboard />
//               </ProtectedRoute>
//             }
//           />
//           <Route
//             path="/user/tickets/:ticketId"
//             element={
//               <ProtectedRoute role="user">
//                 <UserChatPage />
//               </ProtectedRoute>
//             }
//           />
//           <Route
//             path="/member/tickets/:ticketId"
//             element={
//               <ProtectedRoute role="member">
//                 <TicketPage />
//               </ProtectedRoute>
//             }
//           />
//           <Route
//             path="/admin/dashboard"
//             element={
//               <ProtectedRoute role="admin">
//                 <AdminDashboard />
//               </ProtectedRoute>
//             }
//           />
//           <Route
//             path="/member/dashboard"
//             element={
//               <ProtectedRoute role="member">
//                 <MemberDashboard />
//               </ProtectedRoute>
//             }
//           />
//           <Route path="*" element={<Navigate to="/auth" replace />} />
//         </Routes>
//       </Box>
//     </Router>
//   );
// }

// export default App;