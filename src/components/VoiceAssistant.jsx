"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2, Volume2 } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { useApp } from '../store/AppContext';
import { useRouter } from 'next/navigation';
import Receipt from './Receipt';

export default function VoiceAssistant() {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiText, setAiText] = useState('');
  const [isConversationActive, setIsConversationActive] = useState(false);
  const [activeReceiptSale, setActiveReceiptSale] = useState(null);
  const isConversationActiveRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const finalTranscriptRef = useRef('');
  const currentTranscriptRef = useRef('');
  const recognitionRef = useRef(null);
  const chatHistoryRef = useRef([]);
  
  const { state, addCustomer, updateCustomer, deleteCustomer, addProduct, updateProduct, deleteProduct, addEnquiry, updateEnquiry, deleteEnquiry, addAsset, updateAsset, deleteAsset, addWarehouse, updateWarehouse, deleteWarehouse, addLedgerTransaction, addVendor, updateVendor, deleteVendor, addAccount, updateAccount, deleteAccount, completeSale, dispatch } = useApp();
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
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        speakText("Please set NEXT_PUBLIC_GEMINI_API_KEY in .env.local to use me.");
        setIsProcessing(false);
        return;
      }

      const now = new Date();
      const todaysSales = (stateRef.current.sales || [])
        .filter(s => {
            if (!s.date) return false;
            const d = new Date(s.date);
            return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .reduce((total, sale) => total + sale.grandTotal, 0);

      const systemInstruction = `You are an Omnipotent Voice Assistant embedded in Cosmo Store billing software. 
      You speak Hindi (transliterated) and English. 
      You have FULL CONTROL over the application through your tools. You can execute multi-step workflows autonomously (e.g. searching a customer, adding products to cart, and generating a bill).
      
      Current App State Summary:
      - Total Sales today: ₹${todaysSales}
      - Products in inventory: ${(stateRef.current.products || []).map(p => `[ID: ${p.id}] ${p.name} - ₹${p.sellingPrice} (Stock: ${p.stock || 0})`).join(', ')}
      - Existing Customers: ${(stateRef.current.customers || []).map(c => `[ID: ${c.id}] ${c.name} - ${c.phone}`).join(', ')}
      - Cart Items: ${(stateRef.current.cart || []).length}
      
      CRITICAL RULES FOR AUTONOMOUS MODE:
      1. If the user asks for a complex task (e.g. "Rahul ka bill banao 2 Circle ka cash me"), you MUST execute multiple tools sequentially in a loop:
         a) Call 'manage_cart' to add 2 Circle products.
         b) Call 'generate_bill' with the customerId of Rahul and paymentMode Cash.
         c) Call 'navigate_to' to show the receipt.
      2. If you don't know an exact ID, look it up in the context provided above.
      3. For CREATE/ADD tools, always ask the user for missing MANDATORY info if not provided in their prompt.
      4. DO NOT make up data.
      5. ONLY speak the final text once all steps are completed.
      6. Always output a final text response describing what you did.`;

      let currentMessages = [...chatHistoryRef.current, { role: 'user', parts: [{ text }] }];
      const ai = new GoogleGenAI({ apiKey });

      const tools = [{
        functionDeclarations: [
          {
            name: "navigate_to",
            description: "Navigate to a specific page.",
            parameters: {
              type: "OBJECT",
              properties: {
                page: { type: "STRING", description: "e.g., 'billing', 'purchase', 'customers', 'inventory', 'warehouses', 'reports', 'settings', 'dashboard', 'enquiries', 'ledger', 'assets', 'import'" }
              },
              required: ["page"]
            }
          },
          {
            name: "manage_customer",
            description: "Add, update, or delete a customer.",
            parameters: {
              type: "OBJECT",
              properties: {
                action: { type: "STRING", description: "'add', 'update', or 'delete'" },
                id: { type: "STRING", description: "Required for update/delete" },
                name: { type: "STRING" },
                phone: { type: "STRING" },
                udhaarBalance: { type: "NUMBER" }
              },
              required: ["action"]
            }
          },
          {
            name: "manage_product",
            description: "Add, update, or delete a product.",
            parameters: {
              type: "OBJECT",
              properties: {
                action: { type: "STRING", description: "'add', 'update', or 'delete'" },
                id: { type: "STRING" },
                name: { type: "STRING" },
                sellingPrice: { type: "NUMBER" },
                stock: { type: "NUMBER" }
              },
              required: ["action"]
            }
          },
          {
            name: "manage_cart",
            description: "Add, update quantity, remove items, or clear the billing cart.",
            parameters: {
              type: "OBJECT",
              properties: {
                action: { type: "STRING", description: "'add', 'update', 'remove', 'clear'" },
                product_id: { type: "STRING", description: "Required unless action is 'clear'" },
                qty: { type: "NUMBER", description: "Quantity to add or update to" }
              },
              required: ["action"]
            }
          },
          {
            name: "generate_bill",
            description: "Checkout the current cart to create a sale/bill.",
            parameters: {
              type: "OBJECT",
              properties: {
                customerId: { type: "STRING", description: "ID of the customer (optional if cash sale)" },
                paymentMode: { type: "STRING", description: "'Cash', 'UPI', 'Card', or 'Debt'" },
                cashPaid: { type: "NUMBER", description: "Amount paid right now (optional)" }
              },
              required: ["paymentMode"]
            }
          },
          {
            name: "manage_enquiry",
            description: "Add, update, or delete an enquiry.",
            parameters: {
               type: "OBJECT",
               properties: {
                  action: { type: "STRING", description: "'add', 'update', 'delete'" },
                  id: { type: "STRING" },
                  name: { type: "STRING" },
                  itemOfInterest: { type: "STRING" }
               },
               required: ["action"]
            }
          },
          {
             name: "manage_asset",
             description: "Add, update, or delete an asset.",
             parameters: {
                type: "OBJECT",
                properties: {
                   action: { type: "STRING", description: "'add', 'update', 'delete'" },
                   id: { type: "STRING" },
                   name: { type: "STRING" },
                   value: { type: "NUMBER" },
                   type: { type: "STRING", description: "'Fixed' or 'Current'" }
                },
                required: ["action"]
             }
          },
          {
             name: "get_sales_summary",
             description: "Get today's sales summary.",
             parameters: { type: "OBJECT", properties: {} }
          }
        ]
      }];

      let keepProcessing = true;
      let loopCount = 0;
      let finalSpeechText = '';

      while (keepProcessing && loopCount < 7) {
        loopCount++;
        
        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: currentMessages,
          config: {
            systemInstruction: systemInstruction,
            tools: tools,
            temperature: 0.1
          }
        });

        const functionCalls = response.functionCalls || [];
        const text = response.text || "";

        if (functionCalls.length > 0) {
          // It made tool calls, append model's exact tool call request to history
          // We MUST use response.candidates[0].content.parts to preserve thought_signature
          currentMessages.push({
             role: 'model',
             parts: response.candidates[0].content.parts
          });

          // Execute tools locally
          let functionResponses = [];
          for (const call of functionCalls) {
             let result = { success: true };
             try {
                if (call.name === 'navigate_to') {
                   let page = call.args.page.toLowerCase();
                   if (page === 'dashboard' || page === 'home') page = '';
                   router.push(`/${page}`);
                   result.message = `Navigated to ${page || 'home'}`;
                }
                else if (call.name === 'manage_customer') {
                   if (call.args.action === 'add') {
                      await addCustomer({ name: call.args.name, phone: call.args.phone || '', udhaarBalance: call.args.udhaarBalance || 0 });
                      result.message = "Customer added successfully.";
                   } else if (call.args.action === 'update') {
                      await updateCustomer({ id: call.args.id, name: call.args.name, phone: call.args.phone, udhaarBalance: call.args.udhaarBalance });
                      result.message = "Customer updated.";
                   } else if (call.args.action === 'delete') {
                      await deleteCustomer(call.args.id);
                      result.message = "Customer deleted.";
                   }
                }
                else if (call.name === 'manage_product') {
                   if (call.args.action === 'add') {
                      await addProduct({ name: call.args.name, sellingPrice: call.args.sellingPrice || 0, stock: call.args.stock || 0, itemType: 'Product' });
                      result.message = "Product added.";
                   } else if (call.args.action === 'update') {
                      await updateProduct({ id: call.args.id, name: call.args.name, sellingPrice: call.args.sellingPrice, stock: call.args.stock });
                      result.message = "Product updated.";
                   } else if (call.args.action === 'delete') {
                      await deleteProduct(call.args.id);
                      result.message = "Product deleted.";
                   }
                }
                else if (call.name === 'manage_cart') {
                   if (call.args.action === 'clear') {
                      dispatch({ type: 'CLEAR_CART' });
                      result.message = "Cart cleared.";
                   } else {
                      const product = stateRef.current.products.find(p => p.id === String(call.args.product_id));
                      if (!product) {
                         result.success = false; result.message = "Product not found.";
                      } else {
                         if (call.args.action === 'add') {
                            const qty = call.args.qty || 1;
                            for(let i=0; i<qty; i++) dispatch({ type: 'ADD_TO_CART', payload: product });
                            result.message = `${qty} of ${product.name} added to cart.`;
                         } else if (call.args.action === 'remove') {
                            dispatch({ type: 'REMOVE_FROM_CART', payload: call.args.product_id });
                            result.message = "Product removed from cart.";
                         }
                      }
                   }
                }
                else if (call.name === 'generate_bill') {
                   if (stateRef.current.cart.length === 0) {
                      result.success = false; result.message = "Cart is empty.";
                   } else {
                      const grandTotal = stateRef.current.cart.reduce((sum, item) => sum + (item.sellingPrice * (item.qty||1)), 0);
                      const sale = {
                         id: Date.now().toString(),
                         date: new Date().toISOString(),
                         items: [...stateRef.current.cart],
                         customerId: call.args.customerId || null,
                         subtotal: grandTotal,
                         gst: 0,
                         discount: 0,
                         freight: 0,
                         billDiscount: { type: 'none', value: 0 },
                         grandTotal,
                         paymentMode: call.args.paymentMode,
                         cashPaid: call.args.cashPaid || (call.args.paymentMode === 'Debt' ? 0 : grandTotal)
                      };
                      await completeSale(sale);
                      setActiveReceiptSale(sale);
                      result.message = `Bill generated successfully for ₹${grandTotal}`;
                   }
                }
                else if (call.name === 'manage_enquiry') {
                   if (call.args.action === 'add') await addEnquiry({ name: call.args.name, itemOfInterest: call.args.itemOfInterest || '' });
                   else if (call.args.action === 'update') await updateEnquiry({ id: call.args.id, name: call.args.name, itemOfInterest: call.args.itemOfInterest });
                   else if (call.args.action === 'delete') await deleteEnquiry(call.args.id);
                   result.message = `Enquiry ${call.args.action}ed.`;
                }
                else if (call.name === 'manage_asset') {
                   if (call.args.action === 'add') await addAsset({ name: call.args.name, value: call.args.value || 0, type: call.args.type || 'Fixed' });
                   else if (call.args.action === 'update') await updateAsset({ id: call.args.id, name: call.args.name, value: call.args.value });
                   else if (call.args.action === 'delete') await deleteAsset(call.args.id);
                   result.message = `Asset ${call.args.action}ed.`;
                }
                else if (call.name === 'get_sales_summary') {
                   result.message = `Today's sales: ₹${todaysSales}`;
                }
                else {
                   result.success = false; result.message = "Tool not implemented.";
                }
             } catch (e) {
                result.success = false;
                result.message = e.message;
             }

             functionResponses.push({
                functionResponse: { name: call.name, response: result }
             });
          }

          // Feed function results back to Gemini
          currentMessages.push({ role: 'user', parts: functionResponses });
          
          if (text) finalSpeechText += text + " "; // Accumulate text if it spoke while calling tools
          
        } else {
          // No more tool calls, it just provided a text response
          if (text) finalSpeechText += text;
          currentMessages.push({ role: 'model', parts: [{ text }] });
          keepProcessing = false;
        }
      }

      if (!finalSpeechText.trim()) {
         finalSpeechText = "Thik hai, maine kar diya.";
      }

      speakText(finalSpeechText);
      chatHistoryRef.current = currentMessages;
      if (chatHistoryRef.current.length > 20) {
          chatHistoryRef.current = chatHistoryRef.current.slice(chatHistoryRef.current.length - 20);
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
            className="va-btn" 
            onClick={toggleListen}
            style={{ backgroundColor: isConversationActive ? '#ef4444' : '#3b82f6' }}
            title={isConversationActive ? "Stop Voice Assistant" : "Start Voice Assistant"}
          >
            {isConversationActive ? <MicOff size={24} /> : <Mic size={24} />}
          </button>
        </div>
      {activeReceiptSale && <Receipt sale={activeReceiptSale} onClose={() => setActiveReceiptSale(null)} />}
    </>
  );
}
