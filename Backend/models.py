# from flask_sqlalchemy import SQLAlchemy
# from datetime import datetime  # Import datetime here

# db = SQLAlchemy()

# class User(db.Model):
#     __tablename__ = 'users'
#     id = db.Column(db.Integer, primary_key=True)
#     first_name = db.Column(db.String(50), nullable=False)
#     last_name = db.Column(db.String(50), nullable=False)
#     dob = db.Column(db.Date, nullable=True)
#     email = db.Column(db.String(120), unique=True, nullable=False)
#     phone = db.Column(db.String(15), unique=True, nullable=False)
#     password = db.Column(db.String(255), nullable=False)
#     role = db.Column(db.String(20), nullable=False, default='user')

# class Ticket(db.Model):
#     __tablename__ = 'tickets'
#     id = db.Column(db.Integer, primary_key=True)
#     user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
#     category = db.Column(db.String(50), nullable=False)
#     urgency = db.Column(db.String(20), nullable=False)
#     description = db.Column(db.Text, nullable=False)
#     predefined_question = db.Column(db.String(255), nullable=True)
#     visibility = db.Column(db.String(20), nullable=False, default='all_members')
#     created_by = db.Column(db.Integer, nullable=False)
#     status = db.Column(db.String(20), nullable=False, default='open')
#     assigned_to = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
#     created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)  # Fixed: datetime is now defined

# class ChatMessage(db.Model):
#     __tablename__ = 'chat_messages'
#     id = db.Column(db.Integer, primary_key=True)
#     ticket_id = db.Column(db.Integer, db.ForeignKey('tickets.id'), nullable=False)
#     sender_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
#     message = db.Column(db.Text, nullable=False)
#     timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)  # Fixed: datetime is now defined