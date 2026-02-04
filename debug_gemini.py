
import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

key = os.getenv('GOOGLE_API_KEY')
print(f"Key loaded: {bool(key)}")
if key:
    print(f"Key start: {key[:5]}...")

try:
    genai.configure(api_key=key)
    print("\nListing available models...")
    found_flash = False
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"- {m.name}")
            if 'flash' in m.name:
                found_flash = True

    print("\nAttempting generation with 'gemini-1.5-flash'...")
    model = genai.GenerativeModel('gemini-1.5-flash')
    response = model.generate_content("Hello, are you working?")
    print(f"SUCCESS! Reply: {response.text}")

except Exception as e:
    print(f"\n❌ FAILED: {e}")
