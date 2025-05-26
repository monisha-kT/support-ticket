import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import UserDashboard from "./UserDashboard";
import MemberDashboard from "./MemberDashboard";
import AdminDashboard from "./AdminDashboard";

const Min = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      setLoading(false);
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
    } catch (err) {
      console.error("Invalid user data", err);
      localStorage.removeItem("user");
    } finally {
      setLoading(false);
    }
  }, []);

  // Show nothing until user is fetched or validated
  if (loading) return null;

  // Redirect if user not found
  if (!user) return <Navigate to="/auth" replace />;

  // Load role-based dashboard
  switch (user.role) {
    case "user":
      return <ProtectedRoute element={<UserDashboard />} allowedRoles={["user"]} />;
    case "member":
      return <ProtectedRoute element={<MemberDashboard />} allowedRoles={["member"]} />;
    case "admin":
      return <ProtectedRoute element={<AdminDashboard />} allowedRoles={["admin"]} />;
    default:
      return <Navigate to="/auth" replace />;
  }
};

export default Min;

