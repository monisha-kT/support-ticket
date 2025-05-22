from flask import Blueprint
from flask_restx import Api, Resource, fields, Namespace
from werkzeug.security import generate_password_hash, check_password_hash
from models import User, db
from datetime import datetime
from http import HTTPStatus

auth_bp = Blueprint('auth', __name__)
api = Namespace('auth', description='Authentication operations')

# Define Swagger models
user_model = api.model("User", {
    "firstName": fields.String(required=True, description="First name of the user"),
    "lastName": fields.String(required=True, description="Last name of the user"),
    "dob": fields.Date(required=True, description="Date of birth (YYYY-MM-DD)"),
    "email": fields.String(required=True, description="Email address"),
    "phone": fields.String(required=True, description="Phone number (without country code)"),
    "password": fields.String(required=True, description="Password")
})

login_model = api.model("Login", {
    "email": fields.String(required=True, description="Email address"),
    "password": fields.String(required=True, description="Password"),
})

reset_model = api.model("ResetPassword", {
    "email": fields.String(required=True, description="Email address"),
})

@api.route("/signup")
class Signup(Resource):
    @api.expect(user_model)
    @api.response(201, "User successfully registered.")
    @api.response(400, "Bad request.")
    @api.response(409, "User already exists.")
    def post(self):
        """Register a new user"""
        data = api.payload
        
        # Check if user already exists
        if User.query.filter_by(email=data["email"]).first():
            return {"error": "Email already exists"}, HTTPStatus.CONFLICT
        if User.query.filter_by(phone=data["phone"]).first():
            return {"error": "Phone number already exists"}, HTTPStatus.CONFLICT

        # Hash password
        hashed_password = generate_password_hash(data["password"], method="pbkdf2:sha256")

        # Parse DOB
        try:
            dob = datetime.strptime(data["dob"], "%Y-%m-%d").date()
        except ValueError:
            return {"error": "Invalid date format. Use YYYY-MM-DD."}, HTTPStatus.BAD_REQUEST

        # Create new user with default role 'user'
        new_user = User(
            first_name=data["firstName"],
            last_name=data["lastName"],
            dob=dob,
            email=data["email"],
            phone=data["phone"],
            password=hashed_password,
            role="user"  # Always set as 'user'
        )

        try:
            db.session.add(new_user)
            db.session.commit()
            return {"message": "User successfully registered"}, HTTPStatus.CREATED
        except Exception as e:
            db.session.rollback()
            return {"error": str(e)}, HTTPStatus.INTERNAL_SERVER_ERROR

@api.route("/login")
class Login(Resource):
    @api.expect(login_model)
    @api.response(200, "Login successful.")
    @api.response(401, "Invalid credentials.")
    def post(self):
        """Login a user"""
        data = api.payload
        user = User.query.filter_by(email=data["email"]).first()

        if not user or not check_password_hash(user.password, data["password"]):
            return {"error": "Invalid email or password"}, HTTPStatus.UNAUTHORIZED

        return {
            "message": "Login successful",
            "user": {
                "email": user.email,
                "role": user.role,
                "firstName": user.first_name,
                "lastName": user.last_name
            }
        }, HTTPStatus.OK

    def options(self):
        return {}, 200

@api.route("/reset-password")
class ResetPassword(Resource):
    @api.expect(reset_model)
    @api.response(200, "Password reset email sent.")
    @api.response(404, "User not found.")
    def post(self):
        """Send password reset email"""
        data = api.payload
        user = User.query.filter_by(email=data["email"]).first()

        if not user:
            return {"error": "User not found"}, HTTPStatus.NOT_FOUND

        # Since the frontend uses Firebase's sendPasswordResetEmail, this is a placeholder
        return {"message": "Password reset email sent"}, HTTPStatus.OK
