document.addEventListener('DOMContentLoaded', function() {
    // Cache DOM elements
    const elements = {
        chatToggle: document.getElementById("chat-toggle"),
        chatWindow: document.getElementById("chat-window"),
        closeBtn: document.getElementById("close-btn"),
        sendBtn: document.getElementById("send-btn"),
        userInput: document.getElementById("user-input"),
        chatBody: document.getElementById("chat-body"),
        voiceRecord: document.getElementById("voice-record"),
        voiceStatus: document.getElementById("voice-status"),
        stopVoice: document.getElementById("stop-voice")
    };

    // Quick actions configuration
    const quickActions = [
        { text: "📊 Check Results", query: "current results" },
        { text: "💰 Fee Balance", query: "fee balance" },
        { text: "📝 Register Units", query: "register units" },
        { text: "✅ Report Semester", query: "report for semester" },
        { text: "🧾 Fee Statement", query: "detailed fee statement" },
        { text: "📚 My Units", query: "show my registered units" }
    ];

    // Speech Recognition setup
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let isListening = false;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = function() {
            isListening = true;
            elements.voiceRecord.classList.add('recording');
            elements.voiceStatus.classList.remove('hidden');
            elements.userInput.placeholder = "Speak now...";
        };

        recognition.onresult = function(event) {
            let finalTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }

            if (finalTranscript) {
                elements.userInput.value = finalTranscript;
                stopVoiceRecognition();
                // Auto-send after short delay
                setTimeout(sendMessage, 300);
            }
        };

        recognition.onerror = function(event) {
            stopVoiceRecognition();
            if (event.error === 'not-allowed') {
                addMessage('bot', '⚠️ Microphone access denied. Please allow microphone permissions.');
            }
        };

        recognition.onend = function() {
            if (isListening) {
                setTimeout(() => {
                    if (isListening && recognition) {
                        try {
                            recognition.start();
                        } catch (e) {
                            // Ignore restart errors
                        }
                    }
                }, 100);
            }
        };
    } else {
        elements.voiceRecord.style.display = 'none';
    }

    // Voice recording functions
    function startVoiceRecognition() {
        if (!recognition) return;
        
        try {
            elements.userInput.value = '';
            recognition.start();
        } catch (error) {
            addMessage('bot', '⚠️ Error starting voice recognition.');
        }
    }

    function stopVoiceRecognition() {
        if (recognition && isListening) {
            recognition.stop();
            isListening = false;
            elements.voiceRecord.classList.remove('recording');
            elements.voiceStatus.classList.add('hidden');
            elements.userInput.placeholder = "Type your message or use voice...";
        }
    }

    // Event listeners
    if (elements.voiceRecord && recognition) {
        elements.voiceRecord.addEventListener('click', function() {
            if (isListening) {
                stopVoiceRecognition();
            } else {
                startVoiceRecognition();
            }
        });
    }

    if (elements.stopVoice && recognition) {
        elements.stopVoice.addEventListener('click', stopVoiceRecognition);
    }

    if (elements.chatToggle && elements.chatWindow) {
        elements.chatToggle.addEventListener("click", function() {
            const wasHidden = elements.chatWindow.classList.contains('hidden');
            elements.chatWindow.classList.toggle("hidden");
            
            if (wasHidden) {
                clearChatHistory();
                addQuickActions();
                elements.userInput.focus();
            } else {
                stopVoiceRecognition();
            }
        });
    }

    if (elements.closeBtn && elements.chatWindow) {
        elements.closeBtn.addEventListener("click", function() {
            elements.chatWindow.classList.add("hidden");
            clearQuickActions();
            stopVoiceRecognition();
        });
    }

    if (elements.sendBtn) {
        elements.sendBtn.addEventListener("click", sendMessage);
    }
    
    if (elements.userInput) {
        elements.userInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") sendMessage();
        });
    }

    // Main message sending function
    async function sendMessage() {
        const text = elements.userInput.value.trim();
        if (!text) return;
        
        stopVoiceRecognition();
        addMessage("user", text);
        elements.userInput.value = "";
        setInputState(true);
        
        const typingIndicator = addTypingIndicator();
        
        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: text })
            });
            
            const data = await response.json();
            typingIndicator.remove();
            
            if (data.status === 'success') {
                addMessage("bot", data.response);
                // No audio playback - bot only types responses
                addContextualActions(data.response);
            } else {
                addMessage("bot", "Sorry, I encountered an error.");
            }
            
        } catch (error) {
            typingIndicator.remove();
            addMessage("bot", "⚠️ Network error. Please check your connection.");
        } finally {
            setInputState(false);
            elements.userInput.focus();
        }
    }

    // Utility functions
    function setInputState(disabled) {
        elements.userInput.disabled = disabled;
        elements.sendBtn.disabled = disabled;
        if (elements.voiceRecord) elements.voiceRecord.disabled = disabled;
    }

    function addMessage(sender, text) {
        if (!elements.chatBody) return;
        
        const msgDiv = document.createElement("div");
        msgDiv.classList.add(sender === "bot" ? "bot-message" : "user-message");
        msgDiv.textContent = text;
        
        elements.chatBody.appendChild(msgDiv);
        elements.chatBody.scrollTop = elements.chatBody.scrollHeight;
    }

    function addTypingIndicator() {
        if (!elements.chatBody) return { remove: () => {} };
        
        const typingDiv = document.createElement("div");
        typingDiv.classList.add("bot-message", "typing-indicator");
        typingDiv.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
        elements.chatBody.appendChild(typingDiv);
        elements.chatBody.scrollTop = elements.chatBody.scrollHeight;
        
        return {
            remove: () => typingDiv.remove()
        };
    }

    function addQuickActions() {
        if (!elements.chatBody) return;
        
        clearQuickActions();
        
        const actionsDiv = document.createElement("div");
        actionsDiv.classList.add("quick-actions");
        
        quickActions.forEach(action => {
            const button = document.createElement("button");
            button.textContent = action.text;
            button.classList.add("quick-action-btn");
            button.addEventListener("click", () => {
                elements.userInput.value = action.query;
                sendMessage();
            });
            actionsDiv.appendChild(button);
        });
        
        const initialMessage = elements.chatBody.querySelector('.bot-message');
        if (initialMessage) {
            initialMessage.after(actionsDiv);
        }
    }

    function clearQuickActions() {
        const existingActions = elements.chatBody.querySelectorAll('.quick-actions');
        existingActions.forEach(action => action.remove());
    }

    function addContextualActions(response) {
        if (!elements.chatBody) return;
        
        const lowerResponse = response.toLowerCase();
        const actionsDiv = document.createElement("div");
        actionsDiv.classList.add("quick-actions");
        
        if (lowerResponse.includes('result') && lowerResponse.includes('previous')) {
            ["Semester 1 2024", "Semester 2 2023"].forEach(semester => {
                const button = document.createElement("button");
                button.textContent = `View ${semester}`;
                button.classList.add("quick-action-btn");
                button.addEventListener("click", () => {
                    elements.userInput.value = `show ${semester.toLowerCase()} results`;
                    sendMessage();
                });
                actionsDiv.appendChild(button);
            });
        }
        
        if (actionsDiv.children.length > 0) {
            elements.chatBody.appendChild(actionsDiv);
        }
    }

    function clearChatHistory() {
        if (!elements.chatBody) return;
        
        const messages = elements.chatBody.querySelectorAll('.bot-message, .user-message');
        messages.forEach((message, index) => {
            if (index > 0) message.remove();
        });
        
        clearQuickActions();
    }

    // Initialize
    addQuickActions();
});