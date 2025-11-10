from flask import Flask, render_template, request, jsonify
import openai
import os
import re
from datetime import datetime
from dotenv import load_dotenv
import asyncio
import threading
from functools import lru_cache
import time

load_dotenv()

app = Flask(__name__)
app.secret_key = 'your-secret-key-here'

# Configure OpenAI with timeout
openai.api_key = os.getenv('OPENAI_API_KEY')

# Pre-compiled regex patterns for faster text processing
EMOJI_CLEANER = re.compile(r'[^\w\s.,!?;:]')
NEWLINE_REPLACER = re.compile(r'\n')

# Enhanced Mock Database with faster access patterns
users_db = {
    "student123": {
        "name": "John Doe",
        "student_id": "MU2024001",
        "fee_balance": 12500,
        "current_semester": "Semester 2 2024",
        "program": "Computer Science",
        "can_register": False,
        "reported_semesters": [],
        "registered_units": [],
        "results": {
            "Semester 1 2024": {
                "GPA": 3.5, 
                "units": [
                    {"name": "Mathematics", "grade": "A", "marks": 85},
                    {"name": "Physics", "grade": "B+", "marks": 78},
                    {"name": "Programming", "grade": "A-", "marks": 82}
                ]
            },
            "Semester 2 2023": {
                "GPA": 3.2, 
                "units": [
                    {"name": "Calculus", "grade": "B", "marks": 72},
                    {"name": "Chemistry", "grade": "B-", "marks": 68},
                    {"name": "English", "grade": "A", "marks": 88}
                ]
            }
        },
        "fee_structure": {
            "tuition": 50000,
            "accommodation": 15000,
            "library": 2000,
            "medical": 1500,
            "total": 68500
        },
        "payments": [
            {"date": "2024-01-15", "amount": 30000, "description": "Semester 1 Payment"},
            {"date": "2024-01-20", "amount": 26000, "description": "Semester 1 Balance"}
        ]
    }
}

# Pre-defined response templates for common queries
RESPONSE_TEMPLATES = {
    'greeting': "👋 Hello {name}! I'm MachaAI, your university assistant. I can help you with results, fees, registration, and reporting. What would you like to do today?",
    'results_current_unavailable': "📊 Your {semester} results are not available yet.",
    'fee_balance': "💰 Your current fee balance is KES {balance:,}. Would you like a detailed statement?",
    'registration_eligible': "✅ You are eligible to register units. Your fee balance meets the requirement.",
    'registration_not_eligible': "❌ You cannot register units yet. Your balance is KES {balance:,}, but you need below KES 5,000.",
    'reporting_help': "✅ I can help you report for the semester or academic year. Please confirm if you want to proceed.",
    'units_help': "📚 I can show you your registered units or help you register new ones.",
    'fallback': "I'm here to help with university matters. What would you like to know?"
}

# Intent keywords for fast classification
INTENT_KEYWORDS = {
    'greeting': {'hi', 'hello', 'hey', 'good morning', 'good afternoon'},
    'results': {'result', 'grade', 'mark', 'performance', 'score'},
    'fees': {'fee', 'payment', 'balance', 'money', 'bill', 'tuition'},
    'registration': {'register', 'registration', 'enroll', 'enrollment'},
    'reporting': {'report', 'reporting', 'declare'},
    'units': {'unit', 'course', 'subject', 'class', 'module'}
}

class UniversityAssistant:
    def __init__(self):
        self._response_cache = {}
        self._user_cache = {}
    
    def _classify_intent_fast(self, user_input):
        """Ultra-fast intent classification using set operations"""
        input_words = set(user_input.lower().split())
        
        for intent, keywords in INTENT_KEYWORDS.items():
            if input_words & keywords:
                return intent
        return 'general'
    
    def process_query(self, user_input, user_id="student123"):
        """Optimized query processing with caching"""
        start_time = time.time()
        
        # Cache check
        cache_key = f"{user_id}:{user_input.lower()}"
        if cache_key in self._response_cache:
            return self._response_cache[cache_key]
        
        user_data = users_db.get(user_id, {})
        user_input_lower = user_input.lower()
        
        # Fast intent classification
        intent = self._classify_intent_fast(user_input_lower)
        
        # Process based on intent with direct template access
        if intent == 'greeting':
            response_text = RESPONSE_TEMPLATES['greeting'].format(name=user_data.get('name', 'Student'))
        elif intent == 'results':
            response_text = self._handle_results_fast(user_input_lower, user_data)
        elif intent == 'fees':
            response_text = RESPONSE_TEMPLATES['fee_balance'].format(balance=user_data.get('fee_balance', 0))
        elif intent == 'registration':
            balance = user_data.get('fee_balance', 0)
            if balance < 5000:
                response_text = RESPONSE_TEMPLATES['registration_eligible']
            else:
                response_text = RESPONSE_TEMPLATES['registration_not_eligible'].format(balance=balance)
        elif intent == 'reporting':
            response_text = RESPONSE_TEMPLATES['reporting_help']
        elif intent == 'units':
            response_text = RESPONSE_TEMPLATES['units_help']
        else:
            response_text = self._handle_ai_response_fast(user_input, user_data)
        
        # Remove audio generation since we don't need it
        result = {
            'text': response_text,
            'audio': None  # No audio for faster response
        }
        
        # Cache the result (limit cache size)
        if len(self._response_cache) > 100:
            self._response_cache.clear()
        self._response_cache[cache_key] = result
        
        print(f"Query processed in {time.time() - start_time:.3f}s")
        return result
    
    def _handle_results_fast(self, user_input, user_data):
        """Optimized results handler"""
        results = user_data.get('results', {})
        
        if 'current' in user_input:
            current_semester = user_data.get('current_semester', 'Current Semester')
            if current_semester in results:
                sem_results = results[current_semester]
                # Use list comprehension for faster string building
                results_details = "\n".join(
                    f"• {unit['name']}: {unit['grade']} ({unit['marks']}%)" 
                    for unit in sem_results['units']
                )
                return f"📊 Your {current_semester} results:\n{results_details}\nOverall GPA: {sem_results['GPA']}"
            else:
                return RESPONSE_TEMPLATES['results_current_unavailable'].format(semester=current_semester)
        else:
            return "I can help you check your results. Say 'current results' or 'previous results'."
    
    def _handle_ai_response_fast(self, user_input, user_data):
        """Optimized AI response with timeout"""
        try:
            # Use async or timeout to prevent hanging
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system", 
                        "content": "You are a helpful university assistant. Be concise and direct."
                    },
                    {
                        "role": "user", 
                        "content": user_input
                    }
                ],
                max_tokens=100,  # Reduced for faster response
                temperature=0.7,
                timeout=10  # Add timeout
            )
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            print(f"OpenAI error: {e}")
            return RESPONSE_TEMPLATES['fallback']

# Initialize assistant
assistant = UniversityAssistant()

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    start_time = time.time()
    
    try:
        data = request.get_json()
        user_message = data.get('message', '').strip()
        
        if not user_message:
            return jsonify({'error': 'Empty message'}), 400
        
        # Process the message (no audio for speed)
        result = assistant.process_query(user_message)
        
        response_time = time.time() - start_time
        print(f"Total request time: {response_time:.3f}s")
        
        return jsonify({
            'response': result['text'],
            'audio': result['audio'],  # Will be None
            'status': 'success',
            'response_time': f"{response_time:.3f}s"
        })
        
    except Exception as e:
        print(f"Chat endpoint error: {e}")
        return jsonify({
            'response': 'Sorry, I encountered an error. Please try again.',
            'audio': None,
            'status': 'error'
        }), 500

# Health check endpoint for monitoring
@app.route('/health')
def health():
    return jsonify({'status': 'healthy', 'timestamp': datetime.now().isoformat()})

if __name__ == '__main__':
    # Disable debug mode for production performance
    app.run(debug=False, host='0.0.0.0', port=5000)