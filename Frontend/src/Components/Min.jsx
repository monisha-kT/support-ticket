import React from "react";
import ProtectedRoute from "./ProtectedRoute";
import UserDashboard from "./UserDashboard";
import MemberDashboard from "./MemberDashboard";
import AdminDashboard from './AdminDashboard'

const Min = () => {
  const user = localStorage.getItem("user");

  const users = JSON.parse(user);

  console.log(users);
  return (
    <div>
      {users.role === "user" ? (
        <ProtectedRoute element={<UserDashboard />} allowedRoles={["user"]} />
      ) : users.role === "member" ? (
        <div>
         <ProtectedRoute element={<MemberDashboard />} allowedRoles={['member']} />
        </div>
      ) : users.role === "admin" ? (
        <div>
         <ProtectedRoute element={<AdminDashboard />} allowedRoles={['admin']} />
        </div>
      ) : (
        <div>
          <h1>Not User</h1>
        </div>
      ) }
    </div>
  );
};

export default Min;
