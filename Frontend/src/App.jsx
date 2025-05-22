import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Box } from '@mui/material';
import UserDashboard from './Components/UserDashboard';
import MemberDashboard from './Components/MemberDashboard';
import AdminDashboard from './Components/AdminDashboard';
import AuthForm from './Components/AuthForm';
import Navbar from './Components/Navbar';
import ProtectedRoute from './Components/ProtectedRoute';
import UserChat from './Components/UserChat';
import useStore from './store/useStore';
import { useEffect } from 'react';

function RedirectHandler() {
  const { user, initializeUser } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      const { user: initializedUser, route } = await initializeUser();
      if (initializedUser) {
        navigate(route, { replace: true });
      } else {
        navigate('/auth', { replace: true });
      }
    };
    init();
  }, [initializeUser, navigate]);

  return null; // This component only handles redirection
}

function App() {
  const { user } = useStore();

  return (
    <Router>
      <Routes>
        <Route path="/" element={<RedirectHandler />} />
        <Route path="/auth" element={<AuthForm />} />
        <Route 
          path="/dashboard" 
          element={<ProtectedRoute element={<UserDashboard />} allowedRoles={['user']} />} 
        />
        <Route 
          path="/member/dashboard" 
          element={<ProtectedRoute element={<MemberDashboard />} allowedRoles={['member']} />} 
        />
        <Route 
          path="/admin/dashboard" 
          element={<ProtectedRoute element={<AdminDashboard />} allowedRoles={['admin']} />} 
        />
        <Route 
          path="/user/chat" 
          element={<ProtectedRoute element={<UserChat />} allowedRoles={['user']} />} 
        />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    </Router>
  );
}

// Utility function to determine dashboard route based on role
const getDashboardRoute = (role) => {
  switch (role) {
    case 'user':
      return '/dashboard';
    case 'member':
      return '/member/dashboard';
    case 'admin':
      return '/admin/dashboard';
    default:
      return '/auth';
  }
};

export default App;