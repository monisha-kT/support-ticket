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
