from flask import Blueprint, request, jsonify, current_app
import google.generativeai as genai
import os

main_bp = Blueprint('main', __name__)

# --- CONFIGURATION ---
API_KEY = os.getenv("GEMINI_API_KEY")

if API_KEY:
    genai.configure(api_key=API_KEY)

# --- AUTO-DETECT MODEL FUNCTION ---
def get_working_model():
    if not API_KEY:
        print("⚠️ GEMINI_API_KEY not found in environment variables.")
        return None

    print("------------------------------------------------")
    print("🔄 Contacting Google to find a working model...")
    try:
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                if 'gemini' in m.name:
                    print(f"✅ FOUND MODEL: {m.name}")
                    return genai.GenerativeModel(m.name)
    except Exception as e:
        print(f"❌ Error listing models: {e}")

    print("⚠️ Could not find a specific Gemini model. Trying default 'gemini-pro'.")
    return genai.GenerativeModel('gemini-pro')


# Initialize the model automatically
active_model = get_working_model()


@main_bp.route('/')
def home():
    return current_app.send_static_file('index.html')


@main_bp.route('/api/config')
def get_config():
    firebase_config = {
        "apiKey": os.getenv("FIREBASE_API_KEY"),
        "authDomain": os.getenv("FIREBASE_AUTH_DOMAIN"),
        "projectId": os.getenv("FIREBASE_PROJECT_ID"),
        "appId": os.getenv("FIREBASE_APP_ID")
    }
    return jsonify(firebase_config)


@main_bp.route('/ask_ai', methods=['POST'])
def ask_ai():
    global active_model
    try:
        data = request.json
        user_query = data.get('query')

        if not user_query:
            return jsonify({'reply': "Please ask something!"})

        if not active_model:
            active_model = get_working_model()
            if not active_model:
                return jsonify({'reply': "AI Model not configured. Please check GEMINI_API_KEY."})

        response = active_model.generate_content(user_query)
        return jsonify({'reply': response.text})

    except Exception as e:
        print(f"Server Error: {e}")
        return jsonify({'reply': "I am currently offline. (Error: API Key or Network Issue)"})