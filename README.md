# Customer Support Ticket System

A real-time support ticket system with chat functionality built using React and Flask. This system enables customers to create support tickets and chat with support members in real-time.

## Core Features

### Ticket Management System

1. **User Dashboard**
   - Create new support tickets with category, urgency, and description
   - View all tickets with their current status (open, assigned, rejected, closed)
   - Real-time status updates for ticket acceptance/rejection
   - Chat access for assigned tickets

2. **Member Dashboard**
   - Real-time notifications for new ticket submissions
   - View open tickets in a table format
   - Accept or reject tickets
   - Chat with users for assigned tickets
   - Close tickets when resolved

3. **Chat System**
   - Split view with ticket details on the left and chat on the right
   - Real-time messaging between users and support members
   - Message history preservation
   - Automatic updates and notifications
   - Chat disabled after ticket closure

4. **Admin Dashboard**
   - Complete overview of all tickets
   - Access to all chat conversations
   - System monitoring capabilities

## Technical Architecture

### Frontend (React + Vite)

```bash
Frontend/
├── src/
│   ├── Components/
│   │   ├── UserDashboard.jsx    # User ticket management
│   │   ├── MemberDashboard.jsx  # Support member interface
│   │   ├── ChatWindow.jsx       # Real-time chat component
│   │   ├── AdminDashboard.jsx   # Admin overview
│   │   └── NotificationDrawer.jsx # Real-time notifications
│   └── store/
│       └── useStore.jsx         # State management
