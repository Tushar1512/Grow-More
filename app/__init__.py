from flask import Flask
from dotenv import load_dotenv
import os

load_dotenv()

def create_app():
    app = Flask(__name__, static_folder='../frontend', static_url_path='')
    
    # App configuration can go here
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-key-123')

    from .routes import main_bp
    app.register_blueprint(main_bp)

    return app
