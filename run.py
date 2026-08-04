from app import create_app
import socket
import os

app = create_app()

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

if __name__ == '__main__':
    local_ip = get_local_ip()
    port = int(os.getenv('FLASK_PORT', 5000))
    print("------------------------------------------------")
    print(f"🚀 OPEN THIS LINK ON YOUR PHONE/LAPTOP: http://{local_ip}:{port}")
    print("------------------------------------------------")
    app.run(debug=True, host='0.0.0.0', port=port)
