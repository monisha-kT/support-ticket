import eventlet
eventlet.monkey_patch()

from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import (
    JWTManager, jwt_required, get_jwt_identity, 
    decode_token, create_access_token
)
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
from pytz import timezone
import logging
import threading

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:monisha@localhost:5432/chat_db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)

# Initialize extensions
db = SQLAlchemy()
db.init_app(app)
jwt = JWTManager(app)

# Configure CORS
CORS(app, resources={
    r"/api/*": {
        "origins": "http://localhost:5173",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

# Initialize Socket.IO
socketio = SocketIO(
    app,
    cors_allowed_origins="http://localhost:5173",
    async_mode='eventlet',
    ping_timeout=30,
    ping_interval=10,
    max_http_buffer_size=1e4,
    manage_session=False,
    engineio_logger=True
)

# Active socket connections
active_connections = {}
IST = timezone('Asia/Kolkata')

# Models
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    dob = db.Column(db.Date, nullable=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    phone = db.Column(db.String(15), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='user')
    
class Ticket(db.Model):
    __tablename__ = 'tickets'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    category = db.Column(db.String(50), nullable=False)
    priority = db.Column(db.String(20), nullable=False)
    description = db.Column(db.Text, nullable=False)
    predefined_question = db.Column(db.String(255), nullable=True)
    visibility = db.Column(db.String(20), nullable=False, default='all_members')
    created_by = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(20), nullable=False, default='open')
    assigned_to = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(IST))
    closure_reason = db.Column(db.Text, nullable=True)
    reassigned_to = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    last_message_at = db.Column(db.DateTime, nullable=True)
    subject = db.Column(db.String(50), nullable=False)

class ChatMessage(db.Model):
    __tablename__ = 'chat_messages'
    id = db.Column(db.Integer, primary_key=True)
    ticket_id = db.Column(db.Integer, db.ForeignKey('tickets.id'), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # Allow NULL for system messages
    message = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(IST))
    is_system = db.Column(db.Boolean, default=False)

class UnreadMessage(db.Model):
    __tablename__ = 'unread_messages'
    id = db.Column(db.Integer, primary_key=True)
    ticket_id = db.Column(db.Integer, db.ForeignKey('tickets.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    message_id = db.Column(db.Integer, db.ForeignKey('chat_messages.id'), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(IST))

# Socket.IO Events

   
@socketio.on('connect')
def handle_connect():
    try:
        token = request.args.get('token')
        if not token:
            logger.warning("No token provided for socket connection")
            emit('error', {'message': 'No token provided'})
            return False

        decoded = decode_token(token)
        user_id = decoded['sub']
        
        active_connections[request.sid] = {
            'user_id': user_id,
            'rooms': {str(user_id)}
        }
        
        join_room(str(user_id))
        
        logger.info(f"User {user_id} connected with sid {request.sid}")
        emit('connect_success', {
            'message': 'Connected successfully',
            'user_id': user_id
        })
        return True
    
    except Exception as e:
        logger.error(f"Connection error: {str(e)}")
        emit('error', {'message': f'Invalid token: {str(e)}'})
        return False
    

@socketio.on('disconnect')
def handle_disconnect():
    if request.sid in active_connections:
        user_data = active_connections[request.sid]
        for room in user_data['rooms']:
            leave_room(room)
        del active_connections[request.sid]
        logger.info(f"Client {request.sid} disconnected : User {user_data['user_id']}")

@socketio.on('join')
def on_join(data):
    try:
        if request.sid not in active_connections:
            logger.error(f"Unknown client trying to join: {request.sid}")
            return
        
        ticket_id = str(data['ticket_id'])
        user_data = active_connections[request.sid]
        
        join_room(ticket_id)
        user_data['rooms'].add(ticket_id)
        
        logger.info(f"User {user_data['user_id']} joined room {ticket_id}")
        emit('joined', {'room': ticket_id}, room=ticket_id)
    
    except Exception as e:
        logger.error(f"Error in join: {str(e)}")
        emit('error', {'message': 'Failed to join room'}, room=request.sid)

@socketio.on('leave')
def on_leave(data):
    try:
        if request.sid not in active_connections:
            logger.error(f"Unknown client trying to leave: {request.sid}")
            return
        
        ticket_id = str(data['ticket_id'])
        user_data = active_connections[request.sid]
        
        if ticket_id in user_data['rooms']:
            leave_room(ticket_id)
            user_data['rooms'].remove(ticket_id)
            logger.info(f"User {user_data['user_id']} left room {ticket_id}")
    
    except Exception as e:
        logger.error(f"Error in leave: {str(e)}")
        emit('error', {'message': 'Failed to leave room'}, room=request.sid)


    try:
        if request.sid not in active_connections:
            logger.error(f"Unknown client sending message: {request.sid}")
            return

        user_data = active_connections[request.sid]
        ticket_id = str(data['ticket_id'])
        
        if ticket_id not in user_data['rooms']:
            logger.error(f"User {user_data['user_id']} not in room {ticket_id}")
            return
        
        ticket = Ticket.query.get_or_404(ticket_id)
        if ticket.status == 'closed':
            emit('error', {'message': 'Ticket is closed'}, room=request.sid)
            return

        message = ChatMessage(
            ticket_id=ticket_id,
            sender_id=data['sender_id'],
            message=data['message'],
            timestamp=datetime.now(IST)
        )
        ticket.last_message_at = datetime.now(IST)
        db.session.add(message)
        db.session.commit()
        
        emit('message', {
            'id': message.id,
            'sender_id': message.sender_id,
            'message': message.message,
            'timestamp': message.timestamp.isoformat()
        }, room=ticket_id)
        
        emit('message_sent', {
            'success': True,
            'message': message.message,
            'timestamp': message.timestamp.isoformat()
        }, to=request.sid)
    
    except Exception as e:
        logger.error(f"Error in message: {str(e)}")
        emit('error', {'message': 'Failed to send message'}, room=request.sid)
# @socketio.on('message')
# def handle_message(data):
#     try:
#         if request.sid not in active_connections:
#             logger.error(f"Unknown client sending message: {request.sid}")
#             return

#         user_data = active_connections[request.sid]
#         ticket_id = str(data['ticket_id'])
        
#         if ticket_id not in user_data['rooms']:
#             logger.error(f"User {user_data['user_id']} not in room {ticket_id}")
#             return
        
#         ticket = Ticket.query.get_or_404(ticket_id)
#         if ticket.status == 'closed':
#             emit('error', {'message': 'Ticket is closed'}, room=request.sid)
#             return

#         message = ChatMessage(
#             ticket_id=ticket_id,
#             sender_id=data['sender_id'],
#             message=data['message'],
#             timestamp=datetime.now(IST)
#         )
#         ticket.last_message_at = datetime.now(IST)
#         db.session.add(message)
#         db.session.flush()  # Ensure message.id is available

#         # Mark message as unread for other participants
#         participants = {ticket.user_id, ticket.assigned_to} - {data['sender_id']}
#         for participant_id in participants:
#             if participant_id:
#                 unread = UnreadMessage(
#                     ticket_id=ticket_id,
#                     user_id=participant_id,
#                     message_id=message.id
#                 )
#                 db.session.add(unread)

#         db.session.commit()
        
#         emit('message', {
#             'id': message.id,
#             'sender_id': message.sender_id,
#             'message': message.message,
#             'timestamp': message.timestamp.isoformat()
#         }, room=ticket_id)
        
#         emit('message_sent', {
#             'success': True,
#             'message': message.message,
#             'timestamp': message.timestamp.isoformat()
#         }, to=request.sid)
    
#     except Exception as e:
#         logger.error(f"Error in message: {str(e)}")
#         db.session.rollback()
#         emit('error', {'message': 'Failed to send message'}, room=request.sid)



#     try:
#         ticket_id = str(data['ticket_id'])
#         ticket = Ticket.query.get_or_404(ticket_id)
#         if ticket.status != 'closed':
#             ticket.status = 'closed'
#             ticket.closure_reason = 'Closed due to 2-minute inactivity'
#             ticket.last_message_at = datetime.now(IST)
#             system_message = ChatMessage(
#                 ticket_id=ticket_id,
#                 sender_id=None,
#                 message="Ticket closed due to 2-minute inactivity",
#                 timestamp=datetime.now(IST),
#                 is_system=True
#             )
#             db.session.add(system_message)
#             db.session.commit()
#             emit('chat_inactive', {
#                 'ticket_id': ticket_id,
#                 'reason': ticket.closure_reason
#             }, room=ticket_id)
    
#     except Exception as e:
#         logger.error(f"Error in inactivity timeout: {str(e)}")

#     try:
#         ticket_id = str(data['ticket_id'])
#         ticket = Ticket.query.get_or_404(ticket_id)
        
#         if ticket.status != 'closed':
#             # Mark as inactive first
#             ticket.status = 'inactive'
#             db.session.commit()
            
#             # Emit inactive status
#             socketio.emit('ticket_inactive', {
#                 'ticket_id': ticket_id,
#                 'status': 'inactive'
#             }, room=ticket_id)
            
#             # After 1 minute of inactivity, close the ticket
#             def close_after_delay():
#                 with app.app_context():
#                     ticket = Ticket.query.get(ticket_id)
#                     if ticket and ticket.status == 'inactive':
#                         ticket.status = 'closed'
#                         ticket.closure_reason = 'Closed due to 2-minute inactivity'
#                         system_message = ChatMessage(
#                             ticket_id=ticket_id,
#                             sender_id=None,
#                             message="Ticket closed due to 2-minute inactivity",
#                             timestamp=datetime.now(IST),
#                             is_system=True
#                         )
#                         db.session.add(system_message)
#                         db.session.commit()
#                         socketio.emit('chat_inactive', {
#                             'ticket_id': ticket_id,
#                             'reason': 'Closed due to 2-minute inactivity'
#                         }, room=ticket_id)
            
#             threading.Timer(60, close_after_delay).start()
    
#     except Exception as e:
#         logger.error(f"Error in inactivity timeout: {str(e)}")

#     try:
#         ticket_id = str(data['ticket_id'])
#         ticket = Ticket.query.get_or_404(ticket_id)
        
#         if ticket.status not in ['open', 'assigned']:
#             return  # Do not modify closed or rejected tickets

#         ticket.status = 'inactive'
#         ticket.last_message_at = datetime.now(IST)
#         system_message = ChatMessage(
#             ticket_id=ticket_id,
#             sender_id=None,
#             message="Ticket marked as inactive due to 2-minute inactivity",
#             timestamp=datetime.now(IST),
#             is_system=True
#         )
#         db.session.add(system_message)
#         db.session.commit()

#         socketio.emit('ticket_inactive', {
#             'ticket_id': ticket_id,
#             'status': 'inactive',
#             'reason': 'Marked inactive due to 2-minute inactivity'
#         }, room=ticket_id)

#         logger.info(f"Ticket {ticket_id} marked as inactive due to 2-minute inactivity")
    
#     except Exception as e:
#         logger.error(f"Error in inactivity timeout: {str(e)}")
#         db.session.rollback()

@socketio.on('message')
def handle_message(data):
    try:
        if request.sid not in active_connections:
            logger.error(f"Unknown client sending message: {request.sid}")
            return

        user_data = active_connections[request.sid]
        ticket_id = str(data['ticket_id'])
        
        if ticket_id not in user_data['rooms']:
            logger.error(f"User {user_data['user_id']} not in room {ticket_id}")
            return
        
        ticket = Ticket.query.get_or_404(ticket_id)
        if ticket.status == 'closed':
            emit('error', {'message': 'Ticket is closed'}, room=request.sid)
            return

        message = ChatMessage(
            ticket_id=ticket_id,
            sender_id=data['sender_id'],
            message=data['message'],
            timestamp=datetime.now(IST)
        )
        ticket.last_message_at = datetime.now(IST)
        db.session.add(message)
        db.session.flush()  # Ensure message.id is available

        # Mark message as unread for other participants
        participants = {ticket.user_id, ticket.assigned_to} - {data['sender_id']}
        for participant_id in participants:
            if participant_id:
                unread = UnreadMessage(
                    ticket_id=ticket_id,
                    user_id=participant_id,
                    message_id=message.id
                )
                db.session.add(unread)

        db.session.commit()
        
        emit('message', {
            'id': message.id,
            'sender_id': message.sender_id,
            'message': message.message,
            'timestamp': message.timestamp.isoformat()
        }, room=ticket_id)
        
        emit('message_sent', {
            'success': True,
            'message': message.message,
            'timestamp': message.timestamp.isoformat()
        }, to=request.sid)
    
    except Exception as e:
        logger.error(f"Error in message: {str(e)}")
        db.session.rollback()
        emit('error', {'message': 'Failed to send message'}, room=request.sid)

# In your socket.io server code
# @socketio.on('inactivity_timeout')
# def handle_inactivity_timeout(data):
#     try:
#         ticket_id = str(data['ticket_id'])
#         ticket = Ticket.query.get_or_404(ticket_id)
        
#         if ticket.status not in ['open', 'assigned']:
#             return  # Do not modify closed or rejected tickets

#         # First mark as inactive
#         ticket.status = 'inactive'
#         ticket.last_message_at = datetime.now(IST)
#         system_message = ChatMessage(
#             ticket_id=ticket_id,
#             sender_id=None,
#             message="Ticket marked as inactive due to 2-minute inactivity",
#             timestamp=datetime.now(IST),
#             is_system=True
#         )
#         db.session.add(system_message)
#         db.session.commit()

#         socketio.emit('ticket_inactive', {
#             'ticket_id': ticket_id,
#             'status': 'inactive',
#             'reason': 'Marked inactive due to 2-minute inactivity'
#         }, room=ticket_id)

#         # Schedule closure after additional 5 minutes (total 7 minutes)
#         def close_after_delay():
#             with app.app_context():
#                 ticket = Ticket.query.get(ticket_id)
#                 if ticket and ticket.status == 'inactive':
#                     ticket.status = 'closed'
#                     ticket.closure_reason = 'Closed due to 7-minute inactivity'
#                     system_message = ChatMessage(
#                         ticket_id=ticket_id,
#                         sender_id=None,
#                         message="Ticket closed due to 7-minute inactivity",
#                         timestamp=datetime.now(IST),
#                         is_system=True
#                     )
#                     db.session.add(system_message)
#                     db.session.commit()
#                     socketio.emit('chat_inactive', {
#                         'ticket_id': ticket_id,
#                         'reason': 'Closed due to 7-minute inactivity'
#                     }, room=ticket_id)
        
#         threading.Timer(300, close_after_delay).start()  # 5 minutes = 300 seconds

#     except Exception as e:
#         logger.error(f"Error in inactivity timeout: {str(e)}")
#         db.session.rollback()

# Auth Routes

    try:
        data = request.get_json()
        
        if not data or not all(key in data for key in ['firstName', 'lastName', 'dob', 'email', 'phone', 'password']):
            return jsonify({'error': 'Missing required fields'}), 400

        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already exists'}), 400

        user = User(
            first_name=data['firstName'],
            last_name=data['lastName'],
            dob=datetime.strptime(data['dob'], '%Y-%m-%d').date(),
            email=data['email'],
            phone=data['phone'],
            password=generate_password_hash(data['password']),
            role='user'
        )
        db.session.add(user)
        db.session.commit()

        access_token = create_access_token(identity=str(user.id))
        return jsonify({
            'message': 'User created successfully',
            'access_token': access_token,
            'user': {
                'id': user.id,
                'firstName': user.first_name,
                'lastName': user.last_name,
                'email': user.email,
                'role': user.role
            }
        }), 201
    except Exception as e:
        logger.error(f"Signup error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Internal server error'}), 500
@app.route('/api/auth/signup', methods=['POST'])
def signup():
    try:
        data = request.get_json()
        if not data or not all(key in data for key in ['firstName', 'lastName', 'dob', 'email', 'phone', 'password']):
            logger.error("Missing required fields in signup request")
            return jsonify({'error': 'Missing required fields'}), 400

        if User.query.filter_by(email=data['email']).first():
            logger.error(f"Email already exists: {data['email']}")
            return jsonify({'error': 'Email already exists'}), 400

        user = User(
            first_name=data['firstName'],
            last_name=data['lastName'],
            dob=datetime.strptime(data['dob'], '%Y-%m-%d').date(),
            email=data['email'],
            phone=data['phone'],
            password=generate_password_hash(data['password']),
            role='user'
        )
        db.session.add(user)
        db.session.commit()

        access_token = create_access_token(identity=str(user.id))
        logger.info(f"User created successfully: {user.email}")
        return jsonify({
            'message': 'User created successfully',
            'access_token': access_token,
            'user': {
                'id': user.id,
                'firstName': user.first_name,
                'lastName': user.last_name,
                'email': user.email,
                'role': user.role
            }
        }), 201
    except ValueError as e:
        logger.error(f"Invalid date format: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Invalid date format for DOB'}), 400
    except Exception as e:
        logger.error(f"Signup error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e) or 'Internal server error'}), 500
    
    
@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        if not data or 'email' not in data or 'password' not in data:
            return jsonify({'error': 'Email and password are required'}), 400

        user = User.query.filter_by(email=data['email']).first()
        if not user or not check_password_hash(user.password, data['password']):
            return jsonify({'error': 'Invalid credentials'}), 401

        access_token = create_access_token(identity=str(user.id))
        return jsonify({
            'access_token': access_token,
            'user': {
                'id': user.id,
                'firstName': user.first_name,
                'lastName': user.last_name,
                'email': user.email,
                'role': user.role
            }
        }), 200
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/auth/logout', methods=['POST', 'OPTIONS'])
@jwt_required()
def logout():
    try:
        return jsonify({'message': 'Logout successful'}), 200
    except Exception as e:
        logger.error(f"Logout error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

# User Routes
@app.route('/api/users/<user_id>', methods=['GET'])
@jwt_required()
def get_user(user_id):
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or user.role not in ['admin', 'member']:
            return jsonify({'error': 'Unauthorized'}), 403

        target_user = User.query.get(user_id)
        if not target_user:
            return jsonify({'error': 'User not found'}), 404

        return jsonify({
            'id': target_user.id,
            'first_name': target_user.first_name,
            'last_name': target_user.last_name,
            'email': target_user.email,
            'role': target_user.role
        }), 200
    except Exception as e:
        logger.error(f"Error fetching user details: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/users/bulk', methods=['POST'])
@jwt_required()
def get_users_bulk():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or user.role not in ['admin', 'member']:
            return jsonify({'error': 'Unauthorized'}), 403

        data = request.get_json()
        user_ids = data.get('user_ids', [])
        if not user_ids:
            return jsonify({'error': 'No user IDs provided'}), 400

        users = User.query.filter(User.id.in_(user_ids)).all()
        return jsonify({
            str(user.id): {
                'id': user.id,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'email': user.email,
                'role': user.role
            } for user in users
        }), 200
    except Exception as e:
        logger.error(f"Error fetching users: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/users/members', methods=['GET'])
@jwt_required()
def get_members():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        if not user or user.role not in ['member', 'admin']:
            return jsonify({'error': 'Unauthorized'}), 403

        members = User.query.filter_by(role='member').all()
        return jsonify([
            {
                'id': member.id,
                'name': f'{member.first_name} {member.last_name}',
                'first_name': member.first_name,
                'last_name': member.last_name
            } for member in members
        ]), 200
    except Exception as e:
        logger.error(f"Error fetching members: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Ticket Routes
@app.route('/api/tickets', methods=['GET', 'POST'])
@jwt_required()
def tickets():
    if request.method == 'POST':
        try:
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)
            
            if not user or user.role != 'user':
                return jsonify({'error': 'Unauthorized'}), 403

            data = request.get_json()
            required_fields = ['category', 'priority', 'description']
            
            if not all(field in data for field in required_fields):
                return jsonify({'error': 'Missing required fields'}), 400

            ticket = Ticket(
                user_id=current_user_id,
                category=data['category'],
                priority=data['priority'],
                subject=data['subject'],
                description=data['description'],
                predefined_question=data.get('predefined_question'),
                visibility=data.get('visibility', 'all_members'),
                created_by=current_user_id,
                status='open',
                created_at=datetime.now(IST)
            )
            
            db.session.add(ticket)
            db.session.commit()
            db.session.refresh(ticket)

            socketio.emit('new_ticket', {
                'ticket_id': ticket.id,
                'category': ticket.category,
                'priority': ticket.priority
            })

            return jsonify({
                'message': 'Ticket created successfully',
                'ticket_id': ticket.id
            }), 201
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error creating ticket: {str(e)}")
            return jsonify({'error': str(e)}), 500

    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404

        if user.role == 'user':
            tickets = Ticket.query.filter_by(user_id=current_user_id).all()
        elif user.role == 'member':
            tickets = Ticket.query.filter(
                (Ticket.status == 'open') | 
                (Ticket.assigned_to == current_user_id)
            ).all()
        else:  # admin
            tickets = Ticket.query.all()

        return jsonify([{
            'id': t.id,
            'category': t.category,
            'priority': t.priority,
            'subject': t.subject,
            'status': t.status,
            'description': t.description,
            'user_id': t.user_id,
            'assigned_to': t.assigned_to,
            'created_at': t.created_at.isoformat() if t.created_at else None,
            'closure_reason': t.closure_reason,
            'reassigned_to': t.reassigned_to,
            'last_message_at': t.last_message_at.isoformat() if t.last_message_at else None
        } for t in tickets]), 200
    except Exception as e:
        logger.error(f"Error fetching tickets: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/tickets/<ticket_id>', methods=['GET'])
@jwt_required()
def get_ticket(ticket_id):
    try:
        if not ticket_id or ticket_id == 'null':
            return jsonify({'error': 'Invalid ticket ID'}), 400
            
        current_user_id = get_jwt_identity()
        ticket = Ticket.query.get(ticket_id)
        
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404

        return jsonify({
            'id': ticket.id,
            'status': ticket.status,
            'subject': ticket.subject,
            'category': ticket.category,
            'priority': ticket.priority,
            'description': ticket.description,
            'user_id': ticket.user_id,
            'assigned_to': ticket.assigned_to,
            'created_at': ticket.created_at.isoformat() if ticket.created_at else None,
            'closure_reason': ticket.closure_reason,
            'reassigned_to': ticket.reassigned_to,
            'last_message_at': ticket.last_message_at.isoformat() if ticket.last_message_at else None
        }), 200
    except Exception as e:
        logger.error(f"Error fetching ticket: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/tickets/<ticket_id>/accept', methods=['POST'])
@jwt_required()
def accept_ticket(ticket_id):
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or user.role != 'member':
            return jsonify({'error': 'Unauthorized'}), 403

        ticket = Ticket.query.get(ticket_id)
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404

        if ticket.status != 'open':
            return jsonify({'error': 'Ticket is not available'}), 400

        ticket.status = 'assigned'
        ticket.assigned_to = current_user_id
        ticket.last_message_at = datetime.now(IST)
        welcome_msg = ChatMessage(
            ticket_id=ticket_id,
            sender_id=current_user_id,
            message="Hello! I'll be assisting you with your ticket.",
            timestamp=datetime.now(IST)
        )
        db.session.add(welcome_msg)
        db.session.commit()

        socketio.emit('ticket_accepted', {
            'ticket_id': ticket_id,
            'member_id': current_user_id
        }, room=str(ticket.user_id))

        return jsonify({'message': 'Ticket accepted successfully'}), 200
    except Exception as e:
        logger.error(f"Error accepting ticket: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/tickets/reject/<ticket_id>', methods=['POST'])
@jwt_required()
def reject_ticket(ticket_id):
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or user.role != 'member':
            return jsonify({'error': 'Unauthorized'}), 403

        ticket = Ticket.query.get(ticket_id)
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404

        if ticket.status != 'open':
            return jsonify({'error': 'Ticket is not available'}), 400

        ticket.status = 'rejected'
        db.session.commit()

        socketio.emit('ticket_rejected', {
            'ticket_id': ticket_id
        }, room=str(ticket.user_id))

        return jsonify({'message': 'Ticket rejected successfully'}), 200
    except Exception as e:
        logger.error(f"Error rejecting ticket: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or user.role != 'admin':
            return jsonify({'error': 'Unauthorized'}), 403

        ticket = Ticket.query.get_or_404(ticket_id)
        if ticket.status not in ['open', 'assigned']:
            return jsonify({'error': 'Cannot reassign closed or rejected ticket'}), 400

        data = request.get_json()
        reassign_to = data.get('reassign_to')
        if not reassign_to:
            return jsonify({'error': 'Reassignment member ID is required'}), 400

        reassign_user = User.query.get(reassign_to)
        if not reassign_user or reassign_user.role != 'member':
            return jsonify({'error': 'Invalid reassignment member'}), 400

        ticket.assigned_to = reassign_to
        ticket.status = 'assigned'
        ticket.reassigned_to = None  # Clear reassigned_to field
        ticket.last_message_at = datetime.now(IST)
        system_message = ChatMessage(
            ticket_id=ticket_id,
            sender_id=None,
            message=f"Ticket reassigned to {reassign_user.first_name} {reassign_user.last_name}",
            timestamp=datetime.now(IST),
            is_system=True
        )
        db.session.add(system_message)
        db.session.commit()

        socketio.emit('ticket_reassigned', {
            'ticket_id': ticket_id,
            'category': ticket.category,
            'priority': ticket.priority,
            'description': ticket.description,
            'user_id': ticket.user_id,
            'reassigned_to': reassign_to
        }, room=f"user_{reassign_to}")

        socketio.emit('ticket_updated', {
            'ticket_id': ticket_id,
            'status': 'assigned'
        }, room=ticket_id)

        return jsonify({'message': 'Ticket reassigned successfully'}), 200
    except Exception as e:
        logger.error(f"Error reassigning ticket: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
@app.route('/api/tickets/<ticket_id>/reassign', methods=['PUT'])
@jwt_required()
def reassign_ticket(ticket_id):
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or user.role not in ['admin', 'member']:
            return jsonify({'error': 'Unauthorized'}), 403

        ticket = Ticket.query.get_or_404(ticket_id)
        if ticket.status not in ['open', 'assigned']:
            return jsonify({'error': 'Cannot reassign closed or rejected ticket'}), 400

        data = request.get_json()
        reassign_to = data.get('reassign_to')
        if not reassign_to:
            return jsonify({'error': 'Reassignment member ID is required'}), 400

        reassign_user = User.query.get(reassign_to)
        if not reassign_user or reassign_user.role != 'member':
            return jsonify({'error': 'Invalid reassignment member'}), 400

        previous_assignee = ticket.assigned_to
        ticket.assigned_to = reassign_to
        ticket.reassigned_to = reassign_to
        ticket.status = 'assigned'
        ticket.last_message_at = datetime.now(IST)
        
        system_message = ChatMessage(
            ticket_id=ticket_id,
            sender_id=None,
            message=f"Ticket reassigned from {previous_assignee} to {reassign_user.first_name} {reassign_user.last_name}",
            timestamp=datetime.now(IST),
            is_system=True
        )
        db.session.add(system_message)
        db.session.commit()

        # Notify all parties
        socketio.emit('ticket_reassigned', {
            'ticket_id': ticket_id,
            'previous_assignee': previous_assignee,
            'assigned_to': reassign_to,
            'reassigned_by': current_user_id,
            'member_name': f"{reassign_user.first_name} {reassign_user.last_name}"
        }, room=ticket_id)

        # Specific notification to new assignee
        socketio.emit('reassignment_notification', {
            'ticket_id': ticket_id,
            'message': f'You have been assigned to ticket #{ticket_id}',
            'category': ticket.category,
            'priority': ticket.priority
        }, room=str(reassign_to))

        return jsonify({'message': 'Ticket reassigned successfully'}), 200
    except Exception as e:
        logger.error(f"Error reassigning ticket: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
    


    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or user.role != 'member':
            return jsonify({'error': 'Unauthorized'}), 403

        ticket = Ticket.query.get(ticket_id)
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404

        if ticket.status != 'assigned' or ticket.assigned_to != int(current_user_id):
            return jsonify({'error': 'Cannot close this ticket'}), 400

        data = request.get_json()
        reason = data.get('reason')

        if not reason:
            return jsonify({'error': 'Closure reason is required'}), 400

        ticket.status = 'closed'
        ticket.closure_reason = reason
        ticket.reassigned_to = None
        ticket.last_message_at = datetime.now(IST)

        system_message = ChatMessage(
            ticket_id=ticket_id,
            sender_id=None,
            message=f"Ticket closed. Reason: {reason}",
            timestamp=datetime.now(IST),
            is_system=True
        )
        db.session.add(system_message)
        db.session.commit()

        socketio.emit('ticket_closed', {
            'ticket_id': ticket_id,
            'reason': reason
        }, room=ticket_id)

        return jsonify({'message': 'Ticket closed successfully'}), 200

    except Exception as e:
        logger.error(f"Error closing ticket: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404

        ticket = Ticket.query.get(ticket_id)
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404

        data = request.get_json()
        reason = data.get('reason')
        reassign_to = data.get('reassign_to')

        if not reason:
            return jsonify({'error': 'Closure reason is required'}), 400

        ticket.status = 'closed'
        ticket.closure_reason = reason
        ticket.last_message_at = datetime.now(IST)
        
        if reassign_to:
            reassign_user = User.query.get(reassign_to)
            if not reassign_user or reassign_user.role != 'member':
                return jsonify({'error': 'Invalid reassignment member'}), 400
            ticket.reassigned_to = reassign_to
            ticket.assigned_to = reassign_to
            ticket.status = 'assigned'  # Keep as assigned if being reassigned

        system_message = ChatMessage(
            ticket_id=ticket_id,
            sender_id=None,
            message=f"Ticket closed. Reason: {reason}" + 
                   (f". Reassigned to {reassign_user.first_name} {reassign_user.last_name}" 
                    if reassign_to else ""),
            timestamp=datetime.now(IST),
            is_system=True
        )
        db.session.add(system_message)
        db.session.commit()

        socketio.emit('ticket_closed', {
            'ticket_id': ticket_id,
            'reason': reason,
            'reassigned_to': reassign_to,
            'assigned_to': ticket.assigned_to
        }, room=ticket_id)

        return jsonify({'message': 'Ticket closed successfully'}), 200

    except Exception as e:
        logger.error(f"Error closing ticket: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        ticket = Ticket.query.get_or_404(ticket_id)
        
        if user.role != 'admin' and ticket.assigned_to != int(current_user_id):
            return jsonify({'error': 'Unauthorized'}), 403

        data = request.get_json()
        reason = data.get('reason')
        if not reason:
            return jsonify({'error': 'Closure reason is required'}), 400

        ticket.status = 'closed'
        ticket.closure_reason = reason
        ticket.closed_at = datetime.now(IST)
        db.session.commit()

        system_message = ChatMessage(
            ticket_id=ticket_id,
            sender_id=None,
            message=f"Ticket closed. Reason: {reason}",
            timestamp=datetime.now(IST),
            is_system=True
        )
        db.session.add(system_message)
        db.session.commit()

        socketio.emit('ticket_closed', {
            'ticket_id': ticket_id,
            'reason': reason
        }, room=ticket_id)

        return jsonify({'message': 'Ticket closed successfully'}), 200
    except Exception as e:
        logger.error(f"Error closing ticket: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/tickets/<ticket_id>/close', methods=['PUT'])
@jwt_required()
def close_ticket(ticket_id):
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        ticket = Ticket.query.get_or_404(ticket_id)
        
        if user.role != 'admin' and ticket.assigned_to != int(current_user_id):
            return jsonify({'error': 'Unauthorized'}), 403

        data = request.get_json()
        reason = data.get('reason')
        reassign_to = data.get('reassign_to')  # Handle reassignment

        if not reason:
            return jsonify({'error': 'Closure reason is required'}), 400

        if reassign_to:
            reassign_user = User.query.get(reassign_to)
            if not reassign_user or reassign_user.role != 'member':
                return jsonify({'error': 'Invalid reassignment member'}), 400
            ticket.reassigned_to = reassign_to
            ticket.assigned_to = reassign_to
            ticket.status = 'assigned'  # Keep as assigned if reassigned
        else:
            ticket.status = 'closed'
            ticket.reassigned_to = None

        ticket.closure_reason = reason
        ticket.closed_at = datetime.now(IST)
        ticket.last_message_at = datetime.now(IST)

        system_message = ChatMessage(
            ticket_id=ticket_id,
            sender_id=None,
            message=f"Ticket {'reassigned' if reassign_to else 'closed'}. Reason: {reason}" +
                   (f". Reassigned to {reassign_user.first_name} {reassign_user.last_name}" if reassign_to else ""),
            timestamp=datetime.now(IST),
            is_system=True
        )
        db.session.add(system_message)
        db.session.commit()

        socketio.emit('ticket_closed', {
            'ticket_id': ticket_id,
            'reason': reason,
            'reassigned_to': reassign_to,
            'status': ticket.status
        }, room=ticket_id)

        return jsonify({'message': f"Ticket {'reassigned' if reassign_to else 'closed'} successfully"}), 200
    except Exception as e:
        logger.error(f"Error closing ticket: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/tickets/<ticket_id>/reopen', methods=['PUT'])
@jwt_required()
def reopen_ticket(ticket_id):
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        ticket = Ticket.query.get_or_404(ticket_id)

        if (user.role == 'user' and ticket.user_id != int(current_user_id)) or \
           (user.role == 'member' and ticket.assigned_to != int(current_user_id)):
            return jsonify({'error': 'Unauthorized'}), 403

        if ticket.status != 'closed':
            return jsonify({'error': 'Ticket is not closed'}), 400

        ticket.status = 'assigned'
        ticket.closure_reason = None
        ticket.reassigned_to = None
        ticket.last_message_at = datetime.now(IST)
        system_message = ChatMessage(
            ticket_id=ticket_id,
            sender_id=None,
            message="Ticket has been reopened.",
            timestamp=datetime.now(IST),
            is_system=True
        )
        db.session.add(system_message)
        db.session.commit()

        socketio.emit('ticket_reopened', {'ticket_id': ticket_id}, room=ticket_id)
        return jsonify({'message': 'Ticket reopened successfully'}), 200
    except Exception as e:
        logger.error(f"Error reopening ticket: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Chat Routes

    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        ticket = Ticket.query.get_or_404(ticket_id)
        
        if user.role != 'admin' and ticket.user_id != int(current_user_id) and ticket.assigned_to != int(current_user_id):
            return jsonify({'error': 'Unauthorized'}), 403

        messages = ChatMessage.query.filter_by(ticket_id=ticket_id).order_by(ChatMessage.timestamp).all()
        
        return jsonify([{
            'id': msg.id,
            'sender_id': msg.sender_id,
            'message': msg.message,
            'timestamp': msg.timestamp.isoformat(),
            'is_system': msg.is_system
        } for msg in messages]), 200
    except Exception as e:
        logger.error(f"Error fetching chat messages: {str(e)}")
        return jsonify({'error': str(e)}), 500
@app.route('/api/chats/<ticket_id>', methods=['GET'])
@jwt_required()
def get_chat_messages(ticket_id):
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        ticket = Ticket.query.get_or_404(ticket_id)
        
        if user.role != 'admin' and ticket.user_id != int(current_user_id) and ticket.assigned_to != int(current_user_id):
            return jsonify({'error': 'Unauthorized'}), 403

        messages = ChatMessage.query.filter_by(ticket_id=ticket_id).order_by(ChatMessage.timestamp).all()
        
        return jsonify([{
            'id': msg.id,
            'sender_id': msg.sender_id,
            'message': msg.message,
            'timestamp': msg.timestamp.isoformat(),
            'is_system': msg.is_system
        } for msg in messages]), 200
    except Exception as e:
        logger.error(f"Error fetching chat messages: {str(e)}")
        return jsonify({'error': str(e)}), 500



@app.route('/api/chats/<ticket_id>/last', methods=['GET'])
@jwt_required()
def get_last_chat_message(ticket_id):
    try:
        message = ChatMessage.query.filter_by(ticket_id=ticket_id)\
                      .order_by(ChatMessage.timestamp.desc())\
                      .first()
        if message:
            return jsonify({
                'id': message.id,
                'content': message.message,
                'created_at': message.timestamp.isoformat()
            }), 200
        return jsonify({'message': 'No messages found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
    try:
        message = ChatMessage.query.filter_by(ticket_id=ticket_id)\
                      .order_by(ChatMessage.timestamp.desc())\
                      .first()
        if message:
            return jsonify({
                'id': message.id,
                'content': message.message,
                'created_at': message.timestamp.isoformat()
            }), 200
        return jsonify({'message': 'No messages found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404

        ticket = Ticket.query.get(ticket_id)
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404

        return jsonify({'message': 'Ticket marked as read'}), 200
    except Exception as e:
        logger.error(f"Error marking ticket as read: {str(e)}")
        return jsonify({'error': str(e)}), 500
@app.route('/api/tickets/<ticket_id>/read', methods=['PUT'])
@jwt_required()
def mark_ticket_as_read(ticket_id):
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404

        ticket = Ticket.query.get(ticket_id)
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404

        UnreadMessage.query.filter_by(ticket_id=ticket_id, user_id=current_user_id).delete()
        db.session.commit()

        return jsonify({'message': 'Ticket marked as read'}), 200
    except Exception as e:
        logger.error(f"Error marking ticket as read: {str(e)}")
        return jsonify({'error': str(e)}), 500
    


    try:
        return jsonify(0), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/validate', methods=['GET'])
@jwt_required()
def validate_token():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        if not user:
            logger.error(f"User not found for ID: {current_user_id}")
            return jsonify({'valid': False, 'error': 'User not found'}), 404

        return jsonify({
            'valid': True,
            'user': {
                'id': user.id,
                'firstName': user.first_name,
                'lastName': user.last_name,
                'email': user.email,
                'role': user.role
            }
        }), 200
    except Exception as e:
        logger.error(f"Token validation error: {str(e)}")
        return jsonify({'valid': False, 'error': 'Invalid token'}), 401
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'valid': False, 'error': 'User not found'}), 404

        return jsonify({
            'valid': True,
            'user': {
                'id': user.id,
                'firstName': user.first_name,
                'lastName': user.last_name,
                'email': user.email,
                'role': user.role
            }
        }), 200
    except Exception as e:
        logger.error(f"Token validation error: {str(E)}")
        return jsonify({'valid': False, 'error': 'Invalid token'}), 401
    
@app.route('/api/tickets/<ticket_id>/unread', methods=['GET'])
@jwt_required()
def get_unread_count(ticket_id):
    try:
        current_user_id = get_jwt_identity()
        count = UnreadMessage.query.filter_by(ticket_id=ticket_id, user_id=current_user_id).count()
        return jsonify(count), 200
    except Exception as e:
        logger.error(f"Error fetching unread count: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
    
# Background task for 24-hour inactivity check
def check_inactive_tickets():
    with app.app_context():
        threshold = datetime.now(IST) - timedelta(hours=24)
        tickets = Ticket.query.filter(
            Ticket.status == 'assigned',
            (Ticket.last_message_at < threshold) | (Ticket.last_message_at.is_(None))
        ).all()

        for ticket in tickets:
            ticket.status = 'closed'
            ticket.closure_reason = 'Closed due to 24-hour inactivity'
            ticket.last_message_at = datetime.now(IST)
            system_message = ChatMessage(
                ticket_id=ticket.id,
                sender_id=None,
                message="Ticket closed due to 24-hour inactivity",
                timestamp=datetime.now(IST),
                is_system=True
            )
            db.session.add(system_message)
            db.session.commit()
            socketio.emit('chat_inactive', {
                'ticket_id': ticket.id,
                'reason': ticket.closure_reason
            }, room=str(ticket.id))

def start_inactivity_checker():
    while True:
        check_inactive_tickets()
        eventlet.sleep(3600)  # Check every hour

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    threading.Thread(target=start_inactivity_checker, daemon=True).start()
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)




