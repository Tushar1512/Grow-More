from flask import Flask, render_template, request, jsonify
import google.generativeai as genai
import socket
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv(override=True)

app = Flask(__name__)

# --- GEMINI CONFIG ---
API_KEY = os.getenv("GOOGLE_API_KEY")

if not API_KEY:
    print("⚠️ WARNING: Please connect admin.")
    # Try one more reload just in case
    load_dotenv(override=True)
    API_KEY = os.getenv("GOOGLE_API_KEY")

try:
    genai.configure(api_key=API_KEY)
except Exception as e:
    print(f"⚠️ Gemini Config Error: {e}")


# --- AUTO-DETECT MODEL FUNCTION ---
def get_working_model():
    print("------------------------------------------------")
    print("🔄 Contacting Google to find a working model...")
    try:
        # Check available models
        model_names = [m.name for m in genai.list_models()]
        
        # Priority list for Free Tier (Avoids 2.0-flash which has 0 limit for some)
        priorities = [
            'models/gemini-2.5-flash',
            'models/gemini-2.0-flash-lite-001',
            'models/gemini-flash-latest'
        ]
        
        for p in priorities:
            if p in model_names:
                print(f"✅ FOUND MODEL: {p}")
                return genai.GenerativeModel(p)

    except Exception as e:
        print(f"❌ Error listing models: {e}")

    print("⚠️ Could not find specific preferred model. Trying default 'gemini-2.5-flash'.")
    return genai.GenerativeModel('gemini-2.5-flash')


# Initialize the model automatically
active_model = get_working_model()

@app.route('/')
def index():
    return render_template('index.html', 
                         fb_api_key=os.getenv('FIREBASE_API_KEY'),
                         fb_auth_domain=os.getenv('FIREBASE_AUTH_DOMAIN'),
                         fb_project_id=os.getenv('FIREBASE_PROJECT_ID'),
                         fb_app_id=os.getenv('FIREBASE_APP_ID'))


@app.route('/ask_ai', methods=['POST'])
def ask_ai():
    global active_model
    try:
        data = request.json
        user_query = data.get('query')

        if not user_query:
            return jsonify({'reply': "Please ask something!"})

        if not active_model:
            active_model = get_working_model()

        response = active_model.generate_content(user_query)
        return jsonify({'reply': response.text})

    except Exception as e:
        print(f"Server Error: {e}")
        return jsonify({'reply': f"Error: {str(e)}"})

@app.route('/generate_idea', methods=['POST'])
def generate_idea():
    global active_model
    try:
        if not active_model:
            active_model = get_working_model()
            
        prompt = "Generate a unique, creative, and practical engineering project idea (e.g., related to robotics, IoT, automation, or software) in one short sentence. Format: **Title**: Description."
        response = active_model.generate_content(prompt)
        return jsonify({'reply': response.text})
    except Exception as e:
        print(f"Idea Generation Error: {e}")
        return jsonify({'reply': "Could not generate idea."})


# --- Function to find your Local IP ---
def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # doesn't even have to be reachable
        s.connect(('8.8.8.8', 80))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP



# --- GLOBAL ERROR HANDLER ---
@app.errorhandler(Exception)
def handle_exception(e):
    print(f"CRITICAL APP ERROR: {e}")
    # Return JSON so the frontend shows the real error instead of 'Offline'
    return jsonify({'reply': f"🔥 Critical Error: {str(e)}"}), 200

if __name__ == '__main__':
    local_ip = get_local_ip()
    print("------------------------------------------------")
    print(f"🚀 OPEN THIS LINK ON YOUR PHONE/LAPTOP: http://{local_ip}:5000")
    print("------------------------------------------------")

    # host='0.0.0.0' is what allows external access
    app.run(debug=True, host='0.0.0.0', port=5000)
