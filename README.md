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
```

### Backend (Flask)

```bash
Backend/
├── app.py           # Main application file
├── models.py        # Database models
└── requirements.txt # Dependencies
```

## Workflow

1. **Ticket Creation**
   ```
   User Dashboard -> Create Ticket -> Member Dashboard Notification
   ```

2. **Ticket Assignment**
   ```
   Member Dashboard -> Accept/Reject Ticket -> User gets status update
   ```

3. **Support Chat**
   ```
   Assigned Ticket -> Chat Window (Ticket Details + Conversation)
   ```

4. **Ticket Closure**
   ```
   Member Dashboard -> Close Button -> Chat Disabled
   ```

## Setup Instructions

### Backend Setup

1. Install dependencies:
```bash
cd Backend
pip install -r requirements.txt
```

2. Configure PostgreSQL:
```python
# Backend/.env
DATABASE_URL=postgresql://postgres:password@localhost:5432/chat_db
```

3. Run the server:
```bash
python app.py
```

### Frontend Setup

1. Install dependencies:
```bash
cd Frontend
npm install
```

2. Start development server:
```bash
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

## Key Interactions

### User Flow
1. User creates a new support ticket
2. System notifies available support members
3. User sees real-time status updates when ticket is accepted/rejected
4. User can chat with support member once ticket is assigned
5. Chat is disabled when ticket is closed

### Support Member Flow
1. Receives notification when new ticket is created
2. Views ticket in dashboard table
3. Can accept or reject tickets
4. Accesses chat window with ticket details and conversation
5. Can close ticket when issue is resolved

### Admin Flow
1. Complete overview of all tickets in system
2. Access to all chat conversations
3. System monitoring capabilities

## Socket Events

### Client Events
- `join`: Join a chat room
- `message`: Send a chat message
- `connect`: Initial socket connection

### Server Events
- `ticket_created`: New ticket notification
- `ticket_accepted`: Ticket assignment notification
- `ticket_rejected`: Rejection notification
- `ticket_closed`: Closure notification
- `message`: New chat message

## Project Structure

### Frontend Components
- `UserDashboard`: Ticket creation and management for users
- `MemberDashboard`: Support member interface with ticket table
- `ChatWindow`: Real-time chat interface with ticket details
- `NotificationDrawer`: Real-time system notifications
- `AdminDashboard`: Complete system overview

### Backend API
- `/api/tickets`: Ticket CRUD operations
- `/api/chats`: Chat message management
- WebSocket endpoints for real-time communication

## Real-time Features
- Instant ticket status updates
- Live chat functionality
- Immediate notifications
- Dynamic dashboard updates

## Contributing
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## License
MIT License
