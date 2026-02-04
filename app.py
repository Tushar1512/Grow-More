from flask import Flask, render_template, request, jsonify
import requests
import socket
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)

# --- DEEPSEEK CONFIG ---
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"

def call_deepseek(prompt, system_prompt="You are Veda, a helpful AI engineering assistant."):
    if not DEEPSEEK_API_KEY:
        return "⚠️ WORNING :- CONTACT TO ADMIN"
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
    }
    
    data = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        "stream": False
    }

    try:
        response = requests.post(DEEPSEEK_URL, headers=headers, json=data)
        response.raise_for_status()
        return response.json()['choices'][0]['message']['content']
    except Exception as e:
        print(f"❌ DeepSeek Connection Error: {e}")
        return f"AI is currently offline. Error: {str(e)}"

@app.route('/')
def index():
    return render_template('index.html', 
                         fb_api_key=os.getenv('FIREBASE_API_KEY'),
                         fb_auth_domain=os.getenv('FIREBASE_AUTH_DOMAIN'),
                         fb_project_id=os.getenv('FIREBASE_PROJECT_ID'),
                         fb_app_id=os.getenv('FIREBASE_APP_ID'))


@app.route('/ask_ai', methods=['POST'])
def ask_ai():
    try:
        data = request.json
        user_query = data.get('query')

        if not user_query:
            return jsonify({'reply': "Please ask something!"})

        reply = call_deepseek(user_query)
        return jsonify({'reply': reply})

    except Exception as e:
        print(f"Server Error: {e}")
        return jsonify({'reply': f"Error: {str(e)}"})

@app.route('/generate_idea', methods=['POST'])
def generate_idea():
    try:
        prompt = "Generate a unique, creative, and practical engineering project idea (e.g., related to robotics, IoT, automation, or software) in one short sentence. Format: **Title**: Description."
        reply = call_deepseek(prompt)
        return jsonify({'reply': reply})
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
    # Pass through HTTP errors
    if isinstance(e,  Exception): 
        # For API routes, we might want JSON, but user asked for specific text for "full website"
        # We will return the text as requested for 500s/Crashes
        pass
    print(f"Server Error: {e}")
    return "note: please connect admin", 500

if __name__ == '__main__':
    local_ip = get_local_ip()
    print("------------------------------------------------")
    print(f"🚀 OPEN THIS LINK ON YOUR PHONE/LAPTOP: http://{local_ip}:5000")
    print("------------------------------------------------")

    # host='0.0.0.0' is what allows external access
    app.run(debug=True, host='0.0.0.0', port=5000)
