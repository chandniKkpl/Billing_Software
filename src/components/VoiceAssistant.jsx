"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2, Volume2 } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { useApp } from '../store/AppContext';
import { useRouter } from 'next/navigation';

export default function VoiceAssistant() {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiText, setAiText] = useState('');
  const [isConversationActive, setIsConversationActive] = useState(false);
  const isConversationActiveRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const finalTranscriptRef = useRef('');
  const currentTranscriptRef = useRef('');
  const recognitionRef = useRef(null);
  const chatHistoryRef = useRef([]);
  
  const { state, addCustomer, addProduct, addEnquiry, dispatch } = useApp();
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const router = useRouter();

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'hi-IN'; // Set to Hindi/Indian accent by default

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event) => {
          let currentInterim = '';
          let currentFinal = '';
          
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              currentFinal += event.results[i][0].transcript;
            } else {
              currentInterim += event.results[i][0].transcript;
            }
          }
          
          const fullTranscript = finalTranscriptRef.current + currentFinal + currentInterim;
          setTranscript(fullTranscript);
          currentTranscriptRef.current = fullTranscript;

          // Reset silence timer on any speech detected
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
             // 2.5 seconds of silence means user has finished speaking their sentence
             const textToProcess = finalTranscriptRef.current + currentFinal;
             if (textToProcess.trim() && isConversationActiveRef.current) {
                recognition.stop(); // Temporarily stop to process
                processVoiceCommand(textToProcess);
                finalTranscriptRef.current = ''; // Reset for next turn
                currentTranscriptRef.current = ''; // Clear unprocessed
             }
          }, 2500);

          if (currentFinal) {
             finalTranscriptRef.current += currentFinal;
          }
        };

        recognition.onerror = (event) => {
          console.error("Speech Recognition Error:", event.error);
          if (event.error !== 'no-speech') {
            setIsListening(false);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
          // If conversation is still active and we are not processing, try to restart (e.g. if it stopped due to a glitch)
          // We don't restart immediately if it was stopped on purpose to process a command.
        };

        recognitionRef.current = recognition;
      } else {
        console.warn("Speech Recognition API is not supported in this browser.");
      }
    }
  }, []); // Note: leaving deps empty as we want to setup once

  const toggleListen = () => {
    if (!recognitionRef.current) return alert("Browser does not support voice recognition");
    
    if (isConversationActiveRef.current) {
      // Stop completely
      setIsConversationActive(false);
      isConversationActiveRef.current = false;
      clearTimeout(silenceTimerRef.current);
      recognitionRef.current.stop();
      setIsListening(false);
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      
      // Process whatever the user said right before clicking stop
      if (currentTranscriptRef.current.trim() && !isProcessing) {
        processVoiceCommand(currentTranscriptRef.current);
        currentTranscriptRef.current = '';
      }
    } else {
      // Start conversation mode
      setIsConversationActive(true);
      isConversationActiveRef.current = true;
      setTranscript('');
      setAiText('');
      finalTranscriptRef.current = '';
      currentTranscriptRef.current = '';
      try { recognitionRef.current.start(); } catch(e) {}
    }
  };

  const processVoiceCommand = async (text) => {
    if (!text.trim()) return;
    setIsProcessing(true);

    try {
      // Calculate today's sales for context (robust local time check)
      const now = new Date();
      const todaysSales = (stateRef.current.sales || [])
        .filter(s => {
            if (!s.date) return false;
            const d = new Date(s.date);
            return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .reduce((total, sale) => total + sale.grandTotal, 0);

      const systemInstruction = `You are an intelligent voice assistant embedded in Cosmo Store billing software. 
      You speak Hindi (transliterated or proper) and English. 
      Help the user manage their store. Current context:
      - Total Sales today: ₹${todaysSales}
      - Products in inventory: ${(stateRef.current.products || []).map(p => `[ID: ${p.id}] ${p.name} - ₹${p.sellingPrice} (Stock: ${p.stock || 0})`).join(', ')}
      - Existing Customers: ${(stateRef.current.customers || []).map(c => `[ID: ${c.id}] ${c.name} - ${c.phone}`).join(', ')}
      
      CRITICAL CONVERSATIONAL RULES:
      1. When adding a CUSTOMER: You MUST ask for their Name, Phone number, and Debt (Udhaar/Balance). DO NOT call 'add_customer' until the user has provided ALL these details.
      2. When adding a PRODUCT (Inventory): You MUST ask for the Product Name, Selling Price, and Stock Quantity. DO NOT call 'add_product' until the user has provided ALL these details.
      3. When ADDING TO CART: You MUST ask for the Product Name and Quantity. 
      4. Stock Check (CRITICAL): Before calling 'add_to_cart', check the available 'Stock' for that product. If the requested quantity is greater than the available stock, DO NOT call the tool. Instead, warn the user (e.g., "Stock me sirf 2 hai. Kya main sirf 2 hi add karu?").
      5. When adding an ENQUIRY: Ask for Name and what they are interested in. DO NOT call 'add_enquiry' without a Name.
      6. Duplicate Check (Customers): Before calling 'add_customer', check the Existing Customers list. If a customer with the same name exists, ask "Aman naam ka customer pehle se hai. Kya aap naya Aman add karna chahte hain?".
      7. Duplicate Check (Products): If the user wants to add an item to the cart (e.g. "test") and there are multiple products with the same name, ask them to clarify by price (e.g. "Kaunsa test add karu? ₹120 wala ya ₹10 wala?").
      8. VERY IMPORTANT for 'add_to_cart': Use the exact 'product_id' (e.g. "123456") from the inventory list provided above.
      
      Keep replies very brief, 1 or 2 sentences max, as it will be spoken out loud.`;

      const newMessages = [...chatHistoryRef.current, { role: 'user', parts: [{ text }] }];

      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        speakText("Please set NEXT_PUBLIC_GEMINI_API_KEY in .env.local to use me.");
        setIsProcessing(false);
        return;
      }

      const tools = [{
        functionDeclarations: [
          {
            name: "navigate_to",
            description: "Navigate to a specific page or section in the app.",
            parameters: {
              type: "OBJECT",
              properties: {
                page: {
                  type: "STRING",
                  description: "The page to navigate to. E.g., 'billing', 'purchase', 'customers', 'inventory', 'warehouses', 'reports', 'settings', 'dashboard', 'enquiries', 'ledger', 'assets', 'import'.",
                }
              },
              required: ["page"]
            }
          },
          {
            name: "add_customer",
            description: "Add a new customer to the database.",
            parameters: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING", description: "Customer's full name" },
                phone: { type: "STRING", description: "Customer's phone number" },
                address: { type: "STRING", description: "Customer's address" },
                udhaarBalance: { type: "NUMBER", description: "Customer's opening debt or balance" }
              },
              required: ["name"]
            }
          },
          {
            name: "add_product",
            description: "Add a new product to the inventory.",
            parameters: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING", description: "Name of the product" },
                sellingPrice: { type: "NUMBER", description: "Selling price of the product" },
                stock: { type: "NUMBER", description: "Initial stock quantity" }
              },
              required: ["name", "sellingPrice", "stock"]
            }
          },
          {
            name: "add_enquiry",
            description: "Add a new customer enquiry or lead.",
            parameters: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING", description: "Name of the person making the enquiry" },
                phone: { type: "STRING", description: "Phone number of the enquirer" },
                itemOfInterest: { type: "STRING", description: "What product or service they are interested in" },
                notes: { type: "STRING", description: "Any extra notes" }
              },
              required: ["name"]
            }
          },
          {
            name: "add_to_cart",
            description: "Add an item/product to the cart (for both billing and purchase entry) by its ID.",
            parameters: {
              type: "OBJECT",
              properties: {
                product_id: { type: "STRING", description: "The exact ID of the product to add to the cart." },
                qty: { type: "NUMBER", description: "The quantity to add. Defaults to 1 if not specified." }
              },
              required: ["product_id"]
            }
          },
          {
            name: "get_sales_summary",
            description: "Get the total sales for today.",
            parameters: {
               type: "OBJECT",
               properties: {
                  date: { type: "STRING", description: "Optional date in YYYY-MM-DD. Defaults to today." }
               }
            }
          }
        ]
      }];

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: newMessages,
        config: {
          systemInstruction: systemInstruction + "\n\nCRITICAL RULE: You MUST always provide a brief conversational response in text, even when you are making a tool call. Never return ONLY a tool call. For example, if you call navigate_to('billing'), you must also output text like 'Main billing page par ja raha hu.'",
          tools: tools,
          temperature: 0.2
        }
      });

      const data = {
        text: response.text || "",
        functionCalls: (response.functionCalls || []).map(call => ({
          name: call.name,
          args: call.args
        }))
      };

      // Handle function calls if any
      if (data.functionCalls && data.functionCalls.length > 0) {
        for (const call of data.functionCalls) {
          if (call.name === 'navigate_to') {
            let page = call.args.page.toLowerCase();
            if (page === 'dashboard' || page === 'home') page = '';
            router.push(`/${page}`);
            if (!data.text) data.text = `Thik hai, mai ${page || 'home'} page par ja raha hu.`;
          }
          if (call.name === 'add_customer') {
            await addCustomer({
               name: call.args.name,
               phone: call.args.phone || '',
               address: call.args.address || '',
               udhaarBalance: Number(call.args.udhaarBalance) || 0
            });
            // If the AI didn't provide text, provide a fallback
            if (!data.text) data.text = "Customer successfully add ho gaya hai.";
          }
          if (call.name === 'add_product') {
            await addProduct({
               name: call.args.name,
               sellingPrice: Number(call.args.sellingPrice) || 0,
               stock: Number(call.args.stock) || 0,
               itemType: 'Goods',
               category: 'Hardware',
               godown: 'main',
               gst: 18
            });
            if (!data.text) data.text = "Product inventory me add ho gaya hai.";
          }
          if (call.name === 'add_enquiry') {
            await addEnquiry({
               name: call.args.name,
               phone: call.args.phone || '',
               itemOfInterest: call.args.itemOfInterest || '',
               notes: call.args.notes || '',
               status: 'Open'
            });
            if (!data.text) data.text = "Enquiry successfully add ho gayi hai.";
          }
          if (call.name === 'add_to_cart') {
            const prodId = call.args.product_id;
            const qty = call.args.qty || 1;
            
            const product = (stateRef.current.products || []).find(p => String(p.id) === String(prodId));
            if (product) {
              for (let i = 0; i < qty; i++) {
                 dispatch({ type: 'ADD_TO_CART', payload: product });
              }
              if (!data.text) data.text = `Thik hai, maine ${product.name} ko cart me add kar diya hai.`;
            } else {
              if (!data.text) data.text = `Maaf kijiye, mujhe ye item (ID: ${prodId}) inventory me nahi mila.`;
            }
          }
          if (call.name === 'get_sales_summary') {
            if (!data.text) data.text = `Aaj ki total sale ${todaysSales} rupaye hui hai.`;
          }
        }
        
        // Generic fallback if text is still empty somehow after a tool call
        if (!data.text) data.text = "Thik hai, maine kar diya.";
      }

      if (data.text) {
        speakText(data.text);
        chatHistoryRef.current = [...newMessages, { role: 'model', parts: [{ text: data.text }] }];
        // Keep memory from getting too large (last 10 messages max)
        if (chatHistoryRef.current.length > 10) {
            chatHistoryRef.current = chatHistoryRef.current.slice(chatHistoryRef.current.length - 10);
        }
      } else {
        chatHistoryRef.current = newMessages;
      }
} catch (error) {
      console.error("Agent Error:", error);
      speakText("Network me koi problem hai.");
    } finally {
      setIsProcessing(false);
    }
  };

  const KATHA_API_KEY = 'AIzaSyB4haSplaBMoJ9Si1Azu-Pc7mFjIZIU1cc';

  const speakText = async (text) => {
    setAiText(text);
    setIsSpeaking(true);

    try {
      // 1. Try Premium Google Cloud TTS (like Katha app)
      const ttsUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${KATHA_API_KEY}`;
      const response = await fetch(ttsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: 'hi-IN', name: 'hi-IN-Wavenet-D' }, // Premium Indian Female Voice
          audioConfig: { audioEncoding: 'MP3' }
        })
      });

      if (!response.ok) throw new Error("Cloud TTS failed");
      const data = await response.json();
      
      const audio = new Audio("data:audio/mp3;base64," + data.audioContent);
      
      audio.onended = () => {
        setIsSpeaking(false);
        resumeListening();
      };
      
      audio.onerror = () => {
         fallbackBrowserTTS(text);
      };

      // Cancel old browser TTS if any was running
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }

      await audio.play();
    } catch (err) {
      console.warn("Premium TTS failed, falling back to browser TTS", err);
      fallbackBrowserTTS(text);
    }
  };

  const resumeListening = () => {
    if (isConversationActiveRef.current && recognitionRef.current) {
      try {
        setTranscript('');
        finalTranscriptRef.current = '';
        currentTranscriptRef.current = '';
        recognitionRef.current.start();
      } catch(e) {}
    }
  };

  const fallbackBrowserTTS = (text) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      
      setIsSpeaking(true);
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      let targetVoice = 
        voices.find(v => v.name.includes('Lekha') || v.name.includes('Veena')) ||
        voices.find(v => v.name.includes('Swara') || v.name.includes('Neerja')) ||
        voices.find(v => v.name.includes('Google हिन्दी') || v.name.includes('Google hi-IN')) ||
        voices.find(v => (v.lang === 'hi-IN' || v.lang === 'en-IN') && (v.name.includes('Female') || v.name.includes('Woman'))) ||
        voices.find(v => v.lang === 'hi-IN') ||
        voices.find(v => v.lang.includes('IN'));
        
      if (targetVoice) utterance.voice = targetVoice;
      utterance.pitch = 1.1; 
      
      utterance.onend = () => {
        setIsSpeaking(false);
        resumeListening();
      };
      utterance.onerror = (e) => {
        console.error("TTS Error", e);
        setIsSpeaking(false);
        resumeListening();
      };
      
      setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 50);
    } else {
      setIsSpeaking(false);
      resumeListening();
    }
  };

  return (
    <>
      <style>{`
        .va-container {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 12px;
        }
        .va-tooltip {
          background: #fff;
          padding: 12px 16px;
          border-radius: 16px;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
          border: 1px solid #f1f5f9;
          max-width: 250px;
          font-size: 0.875rem;
          font-weight: 500;
          animation: slideUp 0.3s ease;
        }
        .va-btn {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2);
          cursor: pointer;
          transition: transform 0.2s, background-color 0.2s;
        }
        .va-btn:hover { transform: scale(1.05); }
        .va-btn:active { transform: scale(0.95); }
        .va-status-text { display: flex; align-items: center; gap: 8px; }
        .va-transcript { margin-top: 8px; padding-top: 8px; border-top: 1px solid #f1f5f9; color: #475569; font-style: italic; }
        .spin { animation: spin 1s linear infinite; }
        .pulse-anim { animation: pulseAnim 1.5s infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes pulseAnim { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); } 70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
      `}</style>
      <div className="va-container">
        {(isConversationActive || isProcessing || isSpeaking || transcript) && (
          <div className="va-tooltip">
            {isListening && <span className="va-status-text pulse" style={{color: '#3b82f6'}}><Mic size={16}/> Sun raha hu...</span>}
            {isProcessing && <span className="va-status-text" style={{color: '#f59e0b'}}><Loader2 className="spin" size={16}/> Samajh raha hu...</span>}
            {isSpeaking && <span className="va-status-text" style={{color: '#10b981'}}><Volume2 size={16}/> Bol raha hu...</span>}
            
            {/* Show what user said */}
            {!isListening && !isProcessing && transcript && (
              <div className="va-transcript">
                  👤 "{transcript}"
              </div>
            )}
            
            {/* Show AI response */}
            {aiText && (
               <div className="va-transcript" style={{ color: '#0f172a', fontStyle: 'normal', fontWeight: '600', marginTop: '12px' }}>
                  🤖 {aiText}
               </div>
            )}
          </div>
        )}

        <button 
          className={`va-btn ${isConversationActive ? 'pulse-anim' : ''}`}
          style={{ backgroundColor: isConversationActive ? '#ef4444' : '#4f46e5' }}
          onClick={toggleListen}
        >
          {isConversationActive ? <MicOff size={24} /> : <Mic size={24} />}
        </button>
      </div>
    </>
  );
}
