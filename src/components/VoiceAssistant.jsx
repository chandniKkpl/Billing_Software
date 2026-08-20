"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2, Volume2, X } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { useApp } from '../store/AppContext';
import { useRouter } from 'next/navigation';
import { showToast } from './Toast';
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
  const isSpeakingRef = useRef(false);
  const currentAudioRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const finalTranscriptRef = useRef('');
  const currentTranscriptRef = useRef('');
  const recognitionRef = useRef(null);
  const chatHistoryRef = useRef([]);
  
  const { state, addCustomer, updateCustomer, deleteCustomer, addProduct, updateProduct, deleteProduct, addEnquiry, updateEnquiry, deleteEnquiry, addAsset, updateAsset, deleteAsset, addWarehouse, updateWarehouse, deleteWarehouse, addLedgerTransaction, addVendor, updateVendor, deleteVendor, addAccount, updateAccount, deleteAccount, completeSale, completePurchase, dispatch } = useApp();
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
          if (!isSpeakingRef.current) {
            setIsListening(true);
          }
        };

        recognition.onresult = (event) => {
          // CRITICAL: If AI is currently speaking, do NOT capture audio
          if (isSpeakingRef.current) {
            return;
          }

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
             if (textToProcess.trim() && isConversationActiveRef.current && !isSpeakingRef.current) {
                try { recognition.stop(); } catch(e) {}
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
        };

        recognitionRef.current = recognition;
      } else {
        console.warn("Speech Recognition API is not supported in this browser.");
      }
    }
  }, []);

  const toggleListen = () => {
    if (!recognitionRef.current) return alert("Browser does not support voice recognition");
    
    if (isConversationActiveRef.current) {
      // Stop completely
      setIsConversationActive(false);
      isConversationActiveRef.current = false;
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      clearTimeout(silenceTimerRef.current);
      try { recognitionRef.current.stop(); } catch(e) {}
      setIsListening(false);

      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      
      // Process whatever the user said right before clicking stop (if not speaking)
      if (currentTranscriptRef.current.trim() && !isProcessing && !isSpeakingRef.current) {
        processVoiceCommand(currentTranscriptRef.current);
        currentTranscriptRef.current = '';
      }
    } else {
      // Start conversation mode
      setIsConversationActive(true);
      isConversationActiveRef.current = true;
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      setTranscript('');
      setAiText('');
      finalTranscriptRef.current = '';
      currentTranscriptRef.current = '';
      try { recognitionRef.current.start(); } catch(e) {}
    }
  };

  const cancelListening = () => {
    setIsConversationActive(false);
    isConversationActiveRef.current = false;
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    clearTimeout(silenceTimerRef.current);
    try { recognitionRef.current.stop(); } catch(e) {}
    setIsListening(false);

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    
    setTranscript('');
    setAiText('');
    finalTranscriptRef.current = '';
    currentTranscriptRef.current = '';
    setIsProcessing(false);
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
      const allSales = stateRef.current.sales || [];
      const todaysSalesArr = allSales.filter(s => {
          if (!s.date) return false;
          const d = new Date(s.date);
          return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
      
      const todaysSales = todaysSalesArr.reduce((total, sale) => total + sale.grandTotal, 0);
      const todaysBillsCount = todaysSalesArr.length;
      
      const todaysCashSales = todaysSalesArr.filter(s => s.paymentMode === 'Cash').reduce((sum, s) => sum + s.grandTotal, 0);
      const todaysUpiSales = todaysSalesArr.filter(s => s.paymentMode === 'UPI').reduce((sum, s) => sum + s.grandTotal, 0);
      const todaysGst = todaysSalesArr.reduce((sum, s) => sum + (Number(s.gst) || 0), 0);

      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yesterdaysSalesArr = allSales.filter(s => {
          if (!s.date) return false;
          const d = new Date(s.date);
          return d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear();
      });
      const yesterdaysSales = yesterdaysSalesArr.reduce((total, sale) => total + sale.grandTotal, 0);
      const yesterdaysBillsCount = yesterdaysSalesArr.length;

      const thisMonthSalesArr = allSales.filter(s => {
          if (!s.date) return false;
          const d = new Date(s.date);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
      const thisMonthSales = thisMonthSalesArr.reduce((total, sale) => total + sale.grandTotal, 0);
      const thisMonthCashSales = thisMonthSalesArr.filter(s => s.paymentMode === 'Cash').reduce((sum, s) => sum + s.grandTotal, 0);
      const thisMonthUpiSales = thisMonthSalesArr.filter(s => s.paymentMode === 'UPI').reduce((sum, s) => sum + s.grandTotal, 0);
      const thisMonthGst = thisMonthSalesArr.reduce((sum, s) => sum + (Number(s.gst) || 0), 0);
      
      const overallRevenue = allSales.reduce((total, sale) => total + sale.grandTotal, 0);
      const overallBillsCount = allSales.length;

      const allProducts = stateRef.current.products || [];
      const lowStockProducts = allProducts.filter(p => Number(p.stock) < 5);
      const allCustomers = stateRef.current.customers || [];
      const pendingUdhaarCustomers = allCustomers.filter(c => Number(c.udhaarBalance) > 0);
      const allWarehouses = stateRef.current.warehouses || [];

      const systemInstruction = `You are a highly intelligent, autonomous, "Jarvis-like" AI assistant for Cosmo Store billing and retail management software. 
You speak in friendly, natural Hindi / Hinglish.
You have FULL CAPABILITY to execute multiple tools, analyze data, and perform multi-step workflows automatically.
You must act proactive. If a user asks a question, answer it smartly using the data below. If they ask you to do a task, execute the tools, and if any information is missing, ASK them for it!

CURRENT BUSINESS SNAPSHOT (LIVE DATA):
- Today: Revenue ₹${todaysSales} | Cash ₹${todaysCashSales} | UPI ₹${todaysUpiSales} | GST ₹${todaysGst} | Bills ${todaysBillsCount}
- Yesterday: Revenue ₹${yesterdaysSales} | Bills ${yesterdaysBillsCount}
- This Month: Revenue ₹${thisMonthSales} | Cash ₹${thisMonthCashSales} | UPI ₹${thisMonthUpiSales} | GST ₹${thisMonthGst} | Bills ${thisMonthSalesArr.length}
- Overall Total Revenue: ₹${overallRevenue} | Total Bills: ${overallBillsCount}
- Low Stock Products (Stock < 5): ${lowStockProducts.length > 0 ? lowStockProducts.map(p => `${p.name} (Stock: ${p.stock})`).join(', ') : 'None, all good!'}
- Customers with Pending Udhaar (Debt): ${pendingUdhaarCustomers.length > 0 ? pendingUdhaarCustomers.map(c => `${c.name} (Owes: ₹${c.udhaarBalance})`).join(', ') : 'No pending udhaar!'}

Full Inventory Data: ${allProducts.map(p => `[ID: ${p.id}] ${p.name} - ₹${p.sellingPrice} (Stock: ${p.stock || 0})`).join(', ') || 'No products yet'}
Full Customer Data: ${allCustomers.map(c => `[ID: ${c.id}] ${c.name}${c.phone ? ` (${c.phone})` : ''} - Udhaar: ₹${c.udhaarBalance || 0}`).join(', ') || 'No customers yet'}
Full Warehouses Data: ${allWarehouses.map(w => `[ID: ${w.id}] ${w.name}`).join(', ') || 'No warehouses'}
Active Cart Items: ${(stateRef.current.cart || []).map(i => `${i.name} (x${i.qty || 1})`).join(', ') || 'Empty'}

CRITICAL MANDATORY INFORMATION & CONVERSATIONAL RULES:
1. COMPOUND COMMANDS (NAVIGATION + ACTIONS):
   - When a user asks to navigate to a page AND perform an action (e.g. "Customer page par jao aur Ayushi tester customer add karo" or "Inventory me jao aur Parle-G add karo"):
     * ALWAYS call 'navigate_to' immediately to go to that page.
     * Check if the user has provided ALL mandatory details for the requested action.

2. ADDING / MANAGING CUSTOMERS (MANDATORY FIELDS):
   - MANDATORY details required to add a customer: (1) Customer Name, (2) Mobile/Phone Number, and (3) Udhaar/Balance (or explicit 0 / zero balance).
   - If the user DID NOT provide mobile number or udhaar balance (e.g. they only said "Ayushi tester add karo" or "Customer page par jao aur Ayushi tester add karo"):
     * DO NOT call 'add_customer' or 'manage_customer' yet!
     * If they asked to navigate as well, execute 'navigate_to', and in your spoken response, ASK the user to provide the missing mobile number and udhaar balance:
       Example: "Thik hai, mai customers page par ja raha hu. Kripya Ayushi tester ka mobile number aur udhaar balance batayein."
   - When the user provides the mobile number and balance (either in the same turn or in the subsequent turn):
     * Call 'add_customer' (or 'manage_customer') with the customer's name, phone, and udhaarBalance.
     * Confirm to the user: "Customer [Name] successfully add ho gaya hai."

3. MANAGING PRODUCTS (MANDATORY FIELDS):
   - You can add, update, or delete products using 'manage_product'.
   - MANDATORY details required to add a product: (1) Product Name, (2) Selling Price, and (3) Stock Quantity.
   - User can OPTIONALLY provide: barcode, purchase price, and GST rate. If provided, accept them!
   - If the user DID NOT provide selling price or stock quantity (e.g. only said "Parle-G add karo"):
     * DO NOT call 'add_product' or 'manage_product' yet!
     * If they asked to navigate, execute 'navigate_to', and in your spoken response, ASK the user for the missing selling price and stock:
       Example: "Mai inventory page par ja raha hu. Parle-G ka selling price aur stock kitna hai?"
   - When all mandatory details are provided, call 'manage_product' with name, sellingPrice, stock, and any optional fields like barcode or gst.

4. MANAGING CART & BILLING:
   - When user asks to add items to cart, call 'manage_cart' with the product name or ID and quantity.
   - When user asks to create/generate a bill (e.g. "Rahul ka bill banao 2 Coke ka cash me"), add the items to cart, then call 'generate_bill', and navigate to billing or show receipt.

5. NAVIGATION:
   - When user asks to go to, open, or switch to any page (billing, customers, inventory, purchase, enquiries, reports, settings, ledger, warehouses, assets, import, dashboard), ALWAYS call 'navigate_to'.
   - IMPORTANT: ALWAYS call the 'navigate_to' tool when the user asks to go somewhere, EVEN IF you think they are already there or you just navigated there in the previous turn.
   - If user asks for any specific report like "Trial Balance", "Balance Sheet", "Profit and Loss", "Sales Report", or "Day Book", you MUST FIRST call the 'navigate_to' tool with page="Trial Balance" (or whatever report they asked for). Do NOT skip calling the tool! After calling the tool, say "Maine reports page open kar diya hai jahan aap ise dekh sakte hain".

6. PURCHASING ITEMS:
   - When user asks to purchase items, add items to purchase, or buy items (e.g. "Purchase 3 items of Parle G"), call 'generate_purchase' with the list of items, their quantities, and paymentMode (default 'Cash').

8. MANAGING WAREHOUSES & ASSETS:
   - When user asks to add, update, or delete a warehouse, call 'manage_warehouse'.
   - When user asks to manage fixed assets, call 'manage_asset'.

9. MANAGING ENQUIRIES:
   - When user asks to add, update, or delete a customer enquiry (or lead), call 'manage_enquiry'.
   - IMPORTANT: Enquiries are for recording customer interest in ANY item, including items NOT in the inventory. Do NOT check inventory when managing an enquiry!

9. SPOKEN OUTPUT:
   - Provide a concise (1-2 sentences), warm, natural Hindi/Hinglish response summarizing what you did and asking for missing details if any.`;

      let currentMessages = [...chatHistoryRef.current, { role: 'user', parts: [{ text }] }];
      const ai = new GoogleGenAI({ apiKey });

      const tools = [{
        functionDeclarations: [
          {
            name: "navigate_to",
            description: "Navigate to a specific page or section.",
            parameters: {
              type: "OBJECT",
              properties: {
                page: { type: "STRING", description: "e.g., 'billing', 'purchase', 'customers', 'inventory', 'warehouses', 'reports', 'settings', 'dashboard', 'enquiries', 'ledger', 'assets', 'import'" }
              },
              required: ["page"]
            }
          },
          {
            name: "add_customer",
            description: "Add a new customer to the database once Name, Phone number, and Udhaar balance are provided.",
            parameters: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING", description: "Customer full name" },
                phone: { type: "STRING", description: "Customer phone number (Required)" },
                address: { type: "STRING", description: "Customer address (optional)" },
                udhaarBalance: { type: "NUMBER", description: "Opening balance / debt (Required, 0 if none)" }
              },
              required: ["name", "phone", "udhaarBalance"]
            }
          },
          {
            name: "manage_customer",
            description: "Add, update, or delete a customer. For 'add', name, phone, and udhaarBalance must be provided.",
            parameters: {
              type: "OBJECT",
              properties: {
                action: { type: "STRING", description: "'add', 'update', or 'delete'" },
                id: { type: "STRING", description: "Required for update/delete" },
                name: { type: "STRING" },
                phone: { type: "STRING" },
                address: { type: "STRING" },
                udhaarBalance: { type: "NUMBER" }
              },
              required: ["action"]
            }
          },
          {
            name: "add_product",
            description: "Add a new product to inventory once Name, Selling Price, and Stock are provided. Optional: barcode, purchase price, gst.",
            parameters: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING", description: "Product name" },
                sellingPrice: { type: "NUMBER", description: "Selling price (Required)" },
                mrp: { type: "NUMBER", description: "Maximum Retail Price (optional)" },
                stock: { type: "NUMBER", description: "Initial stock quantity (Required)" },
                purchasePrice: { type: "NUMBER", description: "Purchase price" },
                gst: { type: "NUMBER", description: "GST rate" },
                barcode: { type: "STRING", description: "Barcode" }
              },
              required: ["name", "sellingPrice", "stock"]
            }
          },
          {
            name: "manage_product",
            description: "Add, update, or delete a product. For 'add', name, sellingPrice, and stock must be provided.",
            parameters: {
              type: "OBJECT",
              properties: {
                action: { type: "STRING", description: "'add', 'update', or 'delete'" },
                id: { type: "STRING" },
                name: { type: "STRING" },
                sellingPrice: { type: "NUMBER" },
                mrp: { type: "NUMBER" },
                stock: { type: "NUMBER" },
                purchasePrice: { type: "NUMBER" },
                gst: { type: "NUMBER" },
                barcode: { type: "STRING" }
              },
              required: ["action"]
            }
          },
          {
            name: "add_to_cart",
            description: "Add an item to the billing cart by product name or product ID.",
            parameters: {
              type: "OBJECT",
              properties: {
                product_id: { type: "STRING", description: "Product name or product ID" },
                qty: { type: "NUMBER", description: "Quantity to add (default 1)" }
              },
              required: ["product_id"]
            }
          },
          {
            name: "manage_cart",
            description: "Add, update quantity, remove items, or clear the billing cart.",
            parameters: {
              type: "OBJECT",
              properties: {
                action: { type: "STRING", description: "'add', 'update', 'remove', 'clear'" },
                product_id: { type: "STRING", description: "Product name or product ID" },
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
                customerId: { type: "STRING", description: "Customer name or customer ID (optional)" },
                paymentMode: { type: "STRING", description: "'Cash', 'UPI', 'Card', or 'Debt'" },
                cashPaid: { type: "NUMBER", description: "Amount paid right now (optional)" }
              },
              required: ["paymentMode"]
            }
          },
          {
            name: "generate_purchase",
            description: "Create a new purchase entry directly when the user wants to buy or add items to inventory. Must provide an array of items (each with product_id and qty), vendor details, and payment mode.",
            parameters: {
              type: "OBJECT",
              properties: {
                vendor: { type: "STRING", description: "Vendor name (optional, defaults to Walk-in)" },
                vendorBillNo: { type: "STRING", description: "Vendor Bill Number (optional)" },
                date: { type: "STRING", description: "Date of purchase (optional)" },
                discount: { type: "NUMBER", description: "Total discount amount (optional)" },
                paymentMode: { type: "STRING", description: "'Cash', 'Bank', 'UPI', 'Cheque', or 'Credit'/'Debt'" },
                cashPaid: { type: "NUMBER", description: "Amount paid right now (optional)" },
                items: {
                  type: "ARRAY",
                  description: "List of items to purchase",
                  items: {
                    type: "OBJECT",
                    properties: {
                      product_id: { type: "STRING", description: "Product name or product ID" },
                      qty: { type: "NUMBER", description: "Quantity to purchase" },
                      purchasePrice: { type: "NUMBER", description: "Purchase price per unit (optional)" },
                      mrp: { type: "NUMBER", description: "MRP (optional)" },
                      sellingPrice: { type: "NUMBER", description: "Selling price (optional)" },
                      gst: { type: "NUMBER", description: "GST rate (optional)" },
                      barcode: { type: "STRING", description: "Barcode (optional)" }
                    },
                    required: ["product_id", "qty"]
                  }
                }
              },
              required: ["items", "paymentMode"]
            }
          },
          {
            name: "manage_enquiry",
            description: "Add, update, or delete a customer enquiry or lead.",
            parameters: {
              type: "OBJECT",
              properties: {
                action: { type: "STRING", description: "'add', 'update', or 'delete' (default 'add')" },
                id: { type: "STRING", description: "ID of enquiry to update/delete (optional)" },
                name: { type: "STRING", description: "Name of enquirer" },
                phone: { type: "STRING", description: "Phone number (optional)" },
                itemOfInterest: { type: "STRING", description: "Product or item of interest (optional, does NOT need to be in inventory)" },
                notes: { type: "STRING", description: "Notes (optional)" }
              },
              required: ["action", "name"]
            }
          },
          {
             name: "add_ledger_transaction",
             description: "Add a ledger entry (Customer, Vendor, or Employee) with amount, type (Leni/Deni), and date.",
             parameters: {
                type: "OBJECT",
                properties: {
                   entityName: { type: "STRING", description: "Name of customer/vendor/employee" },
                   amount: { type: "NUMBER", description: "Amount in transaction" },
                   type: { type: "STRING", description: "'Leni' (Payment In) or 'Deni' (Payment Out)" },
                   date: { type: "STRING", description: "Date of transaction (optional)" },
                   paymentMode: { type: "STRING", description: "'Cash', 'Bank', 'UPI', 'Cheque' (optional)" },
                   notes: { type: "STRING", description: "Notes (optional)" }
                },
                required: ["entityName", "amount", "type"]
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
             name: "add_warehouse",
             description: "Add a new warehouse/godown.",
             parameters: {
                type: "OBJECT",
                properties: {
                   name: { type: "STRING", description: "Name of the warehouse" },
                   address: { type: "STRING", description: "Location or address (optional)" }
                },
                required: ["name"]
             }
          },
          {
             name: "manage_warehouse",
             description: "Update or delete a warehouse.",
             parameters: {
                type: "OBJECT",
                properties: {
                   action: { type: "STRING", description: "'update', 'delete'" },
                   id: { type: "STRING" },
                   name: { type: "STRING" },
                   address: { type: "STRING" }
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
      const actionSummaries = [];

      while (keepProcessing && loopCount < 5) {
        loopCount++;
        
        let response;
        try {
          response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: currentMessages,
            config: {
              systemInstruction: systemInstruction,
              tools: tools,
              temperature: 0.1
            }
          });
        } catch (apiErr) {
          console.error("Gemini API Error:", apiErr);
          // If conversation history is corrupt, clear it and retry with just the latest user message
          if (chatHistoryRef.current.length > 0) {
             console.log("Clearing conversation history and retrying...");
             chatHistoryRef.current = [];
             currentMessages = [{ role: 'user', parts: [{ text: text || 'hello' }] }];
             response = await ai.models.generateContent({
               model: 'gemini-2.5-flash',
               contents: currentMessages,
               config: {
                 systemInstruction: systemInstruction,
                 tools: tools,
                 temperature: 0.1
               }
             });
          } else {
             throw apiErr;
          }
        }

        const functionCalls = response.functionCalls || [];
        const responseText = response.text || "";

        if (functionCalls.length > 0) {
          // Record model turn
          if (response.candidates?.[0]?.content?.parts) {
            currentMessages.push({
               role: 'model',
               parts: response.candidates[0].content.parts
            });
          }

          // Execute tools locally
          const functionResponses = [];
          for (const call of functionCalls) {
             let result = { success: true };
             try {
                if (call.name === 'navigate_to') {
                   let page = (call.args.page || '').toLowerCase().trim();
                   let targetPage = `/${page}`;
                   if (page === 'dashboard' || page === 'home') targetPage = '/';
                   else if (page.includes('purchase')) targetPage = '/purchase';
                   else if (page.includes('bill')) targetPage = '/billing';
                   else if (page.includes('inventory')) targetPage = '/inventory';
                   else if (page.includes('customer')) targetPage = '/customers';
                   else if (page.includes('trial')) targetPage = '/reports?tab=Trial';
                   else if (page.includes('balance')) targetPage = '/reports?tab=Balance';
                   else if (page.includes('profit') || page.includes('sales')) targetPage = '/reports?tab=Sales';
                   else if (page.includes('report')) targetPage = '/reports';
                   else if (page.includes('enquir')) targetPage = '/enquiries';
                   else if (page.includes('ledger')) targetPage = '/ledger';
                   router.push(targetPage);
                   result.message = `Navigated to ${page || 'home'} page`;
                   actionSummaries.push(`mai ${page || 'home'} page par ja raha hu`);
                }
                else if (call.name === 'manage_customer' || call.name === 'add_customer') {
                   const action = call.args.action || 'add';
                   const name = (call.args.name || '').trim();
                   const phone = (call.args.phone || '').trim();
                   const address = (call.args.address || '').trim();
                   const udhaarBalance = Number(call.args.udhaarBalance) || 0;

                   let targetId = call.args.id;
                   if (!targetId && name && action !== 'add') {
                     const match = (stateRef.current.customers || []).find(c => c.name.toLowerCase() === name.toLowerCase());
                     if (match) targetId = match.id;
                   }

                   if (action === 'add' || call.name === 'add_customer') {
                      const custName = name || 'Naya Customer';
                      await addCustomer({ name: custName, phone, address, type: 'new', membershipTier: 'None', udhaarBalance });
                      showToast(`Customer "${custName}" added successfully!`, 'success');
                      result.message = `Customer "${custName}" added successfully.`;
                      actionSummaries.push(`customer "${custName}" add kar diya`);
                   } else if (action === 'update' && targetId) {
                      await updateCustomer({ id: targetId, name, phone, address, udhaarBalance });
                      showToast('Customer updated!', 'success');
                      result.message = "Customer updated.";
                      actionSummaries.push(`customer update kar diya`);
                   } else if (action === 'delete' && targetId) {
                      await deleteCustomer(targetId);
                      showToast('Customer deleted!', 'info');
                      result.message = "Customer deleted.";
                      actionSummaries.push(`customer delete kar diya`);
                   } else {
                      result.success = false;
                      result.message = `Customer not found for ${action}. Ask user to provide exact mobile number or full name.`;
                   }
                }
                else if (call.name === 'manage_product' || call.name === 'add_product') {
                   const action = call.args.action || 'add';
                   const name = (call.args.name || '').trim();
                   const sellingPrice = Number(call.args.sellingPrice) || 0;
                   const mrp = Number(call.args.mrp) || 0;
                   const stock = Number(call.args.stock) || 0;
                   const purchasePrice = Number(call.args.purchasePrice) || 0;
                   const gst = Number(call.args.gst) || 0;
                   const barcode = (call.args.barcode || '').trim();

                   let targetId = call.args.id;
                   if (!targetId && name && action !== 'add') {
                     const match = (stateRef.current.products || []).find(p => p.name.toLowerCase() === name.toLowerCase());
                     if (match) targetId = match.id;
                   }

                   if (action === 'add' || call.name === 'add_product') {
                      const prodName = name || 'Naya Product';
                      await addProduct({
                         name: prodName,
                         sellingPrice,
                         mrp,
                         purchasePrice,
                         stock,
                         barcode,
                         itemType: 'Goods',
                         category: 'General',
                         godown: 'main',
                         gst
                      });
                      showToast(`Product "${prodName}" added to inventory!`, 'success');
                      result.message = `Product "${prodName}" added to inventory.`;
                      actionSummaries.push(`product "${prodName}" inventory me add kar diya`);
                   } else if (action === 'update' && targetId) {
                      await updateProduct({ id: targetId, name, sellingPrice, mrp, stock, purchasePrice, gst, barcode });
                      showToast('Product updated!', 'success');
                      result.message = "Product updated.";
                      actionSummaries.push(`product update kar diya`);
                   } else if (action === 'delete' && targetId) {
                      await deleteProduct(targetId);
                      showToast('Product deleted!', 'info');
                      result.message = "Product deleted.";
                      actionSummaries.push(`product delete kar diya`);
                   } else {
                      result.success = false;
                      result.message = `Product not found for ${action}. Ask user to provide exact product name.`;
                   }
                }
                else if (call.name === 'manage_cart' || call.name === 'add_to_cart') {
                   const action = call.args.action || 'add';
                   if (action === 'clear') {
                      dispatch({ type: 'CLEAR_CART' });
                      showToast('Cart cleared', 'info');
                      result.message = "Cart cleared.";
                      actionSummaries.push(`cart clear kar diya`);
                   } else {
                      const searchKey = String(call.args.product_id || call.args.name || '').trim().toLowerCase();
                      const product = (stateRef.current.products || []).find(p => 
                        String(p.id).toLowerCase() === searchKey ||
                        p.name.toLowerCase() === searchKey ||
                        p.name.toLowerCase().includes(searchKey) ||
                        searchKey.includes(p.name.toLowerCase())
                      );
                      if (!product) {
                         result.success = false;
                         result.message = `Product "${call.args.product_id || call.args.name}" not found in inventory.`;
                         showToast(`Product "${call.args.product_id || call.args.name}" not found`, 'error');
                         actionSummaries.push(`product "${call.args.product_id || call.args.name}" inventory me nahi mila`);
                      } else {
                         const qty = Number(call.args.qty) || 1;
                         if (action === 'add' || call.name === 'add_to_cart') {
                            for(let i=0; i<qty; i++) dispatch({ type: 'ADD_TO_CART', payload: product });
                            showToast(`${product.name} (x${qty}) added to cart!`, 'success');
                            result.message = `${qty} of ${product.name} added to cart.`;
                            actionSummaries.push(`${product.name} (x${qty}) cart me add kar diya`);
                         } else if (action === 'remove') {
                            dispatch({ type: 'REMOVE_FROM_CART', payload: product.id });
                            showToast(`${product.name} removed from cart`, 'info');
                            result.message = `${product.name} removed from cart.`;
                            actionSummaries.push(`${product.name} cart se hata diya`);
                         }
                      }
                   }
                }
                else if (call.name === 'generate_bill') {
                   if (!stateRef.current.cart || stateRef.current.cart.length === 0) {
                      result.success = false;
                      result.message = "Cart is empty. Please add items to cart first.";
                      showToast("Cart is empty", 'error');
                   } else {
                      let customerId = call.args.customerId || null;
                      let customerFound = true;
                      
                      if (customerId) {
                        const custMatch = (stateRef.current.customers || []).find(c => 
                          String(c.id).toLowerCase() === String(customerId).toLowerCase() ||
                          c.name.toLowerCase() === String(customerId).toLowerCase() ||
                          c.name.toLowerCase().includes(String(customerId).toLowerCase())
                        );
                        if (custMatch) {
                           customerId = custMatch.id;
                        } else {
                           customerFound = false;
                        }
                      }
                      
                      if (!customerFound) {
                         result.success = false;
                         result.message = `Customer '${call.args.customerId}' not found. Ask user if they want to add a new customer and request their mobile number.`;
                         showToast(`Customer '${call.args.customerId}' not found`, 'error');
                         actionSummaries.push(`Customer '${call.args.customerId}' nahi mila`);
                      } else {
                         const grandTotal = stateRef.current.cart.reduce((sum, item) => sum + (Number(item.sellingPrice || 0) * (Number(item.qty) || 1)), 0);
                         const sale = {
                            id: Date.now().toString(),
                            date: new Date().toISOString(),
                            items: [...stateRef.current.cart],
                            customerId,
                            subtotal: grandTotal,
                            gst: 0,
                            discount: 0,
                            freight: 0,
                            billDiscount: { type: 'none', value: 0 },
                            grandTotal,
                            paymentMode: call.args.paymentMode || 'Cash',
                            cashPaid: call.args.cashPaid || (call.args.paymentMode === 'Debt' ? 0 : grandTotal)
                         };
                         await completeSale(sale);
                         setActiveReceiptSale(sale);
                         showToast(`Bill of ₹${grandTotal} generated successfully!`, 'success');
                         result.message = `Bill generated successfully for ₹${grandTotal}`;
                         actionSummaries.push(`₹${grandTotal} ka bill generate kar diya`);
                      }
                   }
                }
                else if (call.name === 'generate_purchase') {
                   const rawItems = call.args.items || [];
                   if (rawItems.length === 0) {
                      result.success = false;
                      result.message = "No items provided for purchase.";
                      showToast("Please provide items to purchase", "error");
                   } else {
                      const purchaseItems = [];
                      let grandTotal = 0;
                      let allFound = true;
                      
                      for (const item of rawItems) {
                         const searchKey = String(item.product_id).trim().toLowerCase();
                         const product = (stateRef.current.products || []).find(p => 
                           String(p.id).toLowerCase() === searchKey ||
                           p.name.toLowerCase() === searchKey ||
                           p.name.toLowerCase().includes(searchKey)
                         );
                         if (!product) {
                            allFound = false;
                            result.success = false;
                            result.message = `Product "${item.product_id}" not found.`;
                            showToast(`Product "${item.product_id}" not found`, 'error');
                            break;
                         }
                         const pPrice = Number(item.purchasePrice) || Number(product.purchasePrice) || 0;
                         const qty = Number(item.qty) || 1;
                         purchaseItems.push({ ...product, qty, purchasePrice: pPrice });
                         grandTotal += (pPrice * qty);
                      }
                      
                      if (allFound) {
                         let vendorId = call.args.vendor || null;
                         let vendorFound = true;
                         
                         if (vendorId) {
                           const vMatch = (stateRef.current.vendors || []).find(v => 
                             String(v.id).toLowerCase() === String(vendorId).toLowerCase() ||
                             v.name.toLowerCase() === String(vendorId).toLowerCase() ||
                             v.name.toLowerCase().includes(String(vendorId).toLowerCase())
                           );
                           if (vMatch) {
                             vendorId = vMatch.id;
                           } else {
                             vendorFound = false;
                           }
                         }

                         if (!vendorFound) {
                            result.success = false;
                            result.message = `Vendor '${call.args.vendor}' not found. Ask user if they want to add a new vendor and request their mobile number.`;
                            showToast(`Vendor '${call.args.vendor}' not found`, 'error');
                            actionSummaries.push(`Vendor '${call.args.vendor}' list me nahi mila`);
                         } else {
                            const discountAmt = Number(call.args.discount) || 0;
                            const purchase = {
                               id: Date.now().toString(),
                               date: call.args.date ? new Date(call.args.date).toISOString() : new Date().toISOString(),
                               vendorName: call.args.vendor || 'Walk-in Vendor',
                               vendorId: vendorId || 'walkin',
                               vendorBillNo: call.args.vendorBillNo || '',
                               items: purchaseItems,
                               subtotal: grandTotal,
                               gst: 0,
                               discount: discountAmt,
                               freight: 0,
                               labor: 0,
                               grandTotal: grandTotal - discountAmt,
                               paymentMode: call.args.paymentMode || 'Cash',
                               cashPaid: call.args.cashPaid || (call.args.paymentMode === 'Credit' || call.args.paymentMode === 'Debt' ? 0 : (grandTotal - discountAmt))
                            };
                            await completePurchase(purchase);
                            setActiveReceiptSale(purchase);
                            showToast(`Purchase of ₹${grandTotal} added!`, 'success');
                            result.message = `Purchase added successfully for ₹${grandTotal}`;
                            actionSummaries.push(`₹${grandTotal} ki purchase entry add kar di`);
                         }
                      }
                   }
                }
                else if (call.name === 'manage_enquiry' || call.name === 'add_enquiry') {
                   const action = call.args.action || 'add';
                   const name = (call.args.name || '').trim() || 'Enquiry';
                   const phone = (call.args.phone || '').trim();
                   const itemOfInterest = (call.args.itemOfInterest || '').trim();
                   const notes = (call.args.notes || '').trim();

                   let targetId = call.args.id;
                   if (!targetId && name && action !== 'add') {
                     const match = (stateRef.current.enquiries || []).find(e => e.name.toLowerCase() === name.toLowerCase());
                     if (match) targetId = match.id;
                   }

                   if (action === 'add' || call.name === 'add_enquiry') {
                      await addEnquiry({ name, phone, itemOfInterest, notes, status: 'Open' });
                      showToast(`Enquiry for "${name}" added!`, 'success');
                      result.message = `Enquiry for "${name}" added.`;
                      actionSummaries.push(`enquiry add kar di`);
                   } else if (action === 'update' && targetId) {
                      await updateEnquiry({ id: targetId, name, phone, itemOfInterest, notes });
                      showToast('Enquiry updated!', 'success');
                      result.message = "Enquiry updated.";
                      actionSummaries.push(`enquiry update kar di`);
                   } else if (action === 'delete' && targetId) {
                      await deleteEnquiry(targetId);
                      showToast('Enquiry deleted!', 'info');
                      result.message = "Enquiry deleted.";
                      actionSummaries.push(`enquiry delete kar di`);
                   } else {
                      result.success = false;
                      result.message = `Enquiry not found for ${action}. Ask user to provide exact enquiry name.`;
                   }
                }
                else if (call.name === 'add_ledger_transaction') {
                   const entityName = (call.args.entityName || '').trim();
                   const amount = Number(call.args.amount) || 0;
                   const type = (call.args.type || '').toLowerCase().includes('deni') || (call.args.type || '').toLowerCase().includes('out') ? 'Payment Out' : 'Payment In';
                   const date = call.args.date ? new Date(call.args.date).toISOString() : new Date().toISOString();
                   const paymentMode = call.args.paymentMode || 'Cash';
                   const notes = call.args.notes || '';
                   
                   await addLedgerTransaction({
                      entityId: entityName.toLowerCase(), // In real app, might resolve to exact ID
                      entityName,
                      entityType: 'Customer', // Defaulting, can be improved
                      date,
                      type,
                      amount,
                      paymentMode,
                      referenceNo: 'AI-GEN',
                      notes
                   });
                   showToast(`Ledger entry for ${entityName} added!`, 'success');
                   result.message = `Ledger entry added for ${entityName}`;
                   actionSummaries.push(`${entityName} ki ${type} entry ₹${amount} add kar di`);
                }
                else if (call.name === 'manage_asset') {
                   const action = call.args.action || 'add';
                   const name = (call.args.name || '').trim() || 'Asset';
                   const value = Number(call.args.value) || 0;
                   const type = call.args.type || 'Fixed';

                   let targetId = call.args.id;
                   if (!targetId && name && action !== 'add') {
                     const match = (stateRef.current.assets || []).find(a => a.name.toLowerCase() === name.toLowerCase());
                     if (match) targetId = match.id;
                   }

                   if (action === 'add') {
                      await addAsset({ name, value, type });
                      showToast(`Asset "${name}" added!`, 'success');
                      result.message = `Asset "${name}" added.`;
                      actionSummaries.push(`asset add kar diya`);
                   } else if (action === 'update' && targetId) {
                      await updateAsset({ id: targetId, name, value, type });
                      showToast('Asset updated!', 'success');
                      result.message = "Asset updated.";
                      actionSummaries.push(`asset update kar diya`);
                   } else if (action === 'delete' && targetId) {
                      await deleteAsset(targetId);
                      showToast('Asset deleted!', 'info');
                      result.message = "Asset deleted.";
                      actionSummaries.push(`asset delete kar diya`);
                   } else {
                      result.success = false;
                      result.message = `Asset not found for ${action}. Ask user to provide exact asset name.`;
                   }
                }
                else if (call.name === 'add_warehouse' || call.name === 'manage_warehouse') {
                   const action = call.args.action || 'add';
                   const name = (call.args.name || '').trim() || 'Warehouse';
                   const address = (call.args.address || '').trim();
                   
                   let targetId = call.args.id;
                   if (!targetId && name && action !== 'add') {
                     const match = (stateRef.current.warehouses || []).find(w => w.name.toLowerCase() === name.toLowerCase());
                     if (match) targetId = match.id;
                   }

                   if (action === 'add' || call.name === 'add_warehouse') {
                      await addWarehouse({ name, address });
                      showToast(`Warehouse "${name}" added!`, 'success');
                      result.message = `Warehouse "${name}" added.`;
                      actionSummaries.push(`warehouse "${name}" add kar diya`);
                   } else if (action === 'update' && targetId) {
                      await updateWarehouse({ id: targetId, name, address });
                      showToast('Warehouse updated!', 'success');
                      result.message = "Warehouse updated.";
                      actionSummaries.push(`warehouse update kar diya`);
                   } else if (action === 'delete' && targetId) {
                      await deleteWarehouse(targetId);
                      showToast('Warehouse deleted!', 'info');
                      result.message = "Warehouse deleted.";
                      actionSummaries.push(`warehouse delete kar diya`);
                   } else {
                      result.success = false;
                      result.message = `Warehouse ID not found for ${action}`;
                   }
                }
                else if (call.name === 'get_sales_summary') {
                   result.message = `Today's sales: ₹${todaysSales} (${todaysBillsCount} bills). Overall Revenue: ₹${overallRevenue} (${overallBillsCount} bills).`;
                   actionSummaries.push(`aaj ki total sale ₹${todaysSales} hai (${todaysBillsCount} bills)`);
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

          // Feed function results back to Gemini with proper 'function' role
          currentMessages.push({ role: 'function', parts: functionResponses });
          
          if (responseText) {
             finalSpeechText = responseText;
          }
          
        } else {
          // No more tool calls, it just provided a text response
          if (responseText) finalSpeechText = responseText;
          currentMessages.push({ role: 'model', parts: [{ text: responseText }] });
          keepProcessing = false;
        }
      }

      if (!finalSpeechText.trim()) {
         if (actionSummaries.length > 0) {
            finalSpeechText = "Thik hai, " + actionSummaries.join(" aur ") + ".";
         } else {
            finalSpeechText = "Thik hai, maine kar diya.";
         }
      }

      speakText(finalSpeechText.trim());
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
    isSpeakingRef.current = true;

    // CRITICAL: Stop speech recognition while AI is speaking
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }
    setIsListening(false);

    // Cancel any ongoing browser/cloud audio
    if (currentAudioRef.current) {
      try { currentAudioRef.current.pause(); } catch(e) {}
      currentAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

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
      currentAudioRef.current = audio;
      
      audio.onended = () => {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        currentAudioRef.current = null;
        resumeListening();
      };
      
      audio.onerror = () => {
        currentAudioRef.current = null;
        fallbackBrowserTTS(text);
      };

      await audio.play();
    } catch (err) {
      console.warn("Premium TTS failed, falling back to browser TTS", err);
      fallbackBrowserTTS(text);
    }
  };

  const resumeListening = () => {
    // Only resume if user still has conversation active and AI is NOT speaking
    if (!isSpeakingRef.current && isConversationActiveRef.current && recognitionRef.current) {
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
      isSpeakingRef.current = true;
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
        isSpeakingRef.current = false;
        resumeListening();
      };
      utterance.onerror = (e) => {
        console.error("TTS Error", e);
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        resumeListening();
      };
      
      setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 50);
    } else {
      setIsSpeaking(false);
      isSpeakingRef.current = false;
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
            {isListening && !isSpeaking && <span className="va-status-text pulse" style={{color: '#3b82f6'}}><Mic size={16}/> Sun raha hu...</span>}
            {isProcessing && <span className="va-status-text" style={{color: '#f59e0b'}}><Loader2 className="spin" size={16}/> Samajh raha hu...</span>}
            {isSpeaking && <span className="va-status-text" style={{color: '#10b981'}}><Volume2 size={16}/> Bol raha hu...</span>}
            
            {/* Show what user said */}
            {!isListening && !isProcessing && transcript && !isSpeaking && (
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
            
            {/* Cancel Button */}
            {(isListening || isProcessing || isSpeaking) && (
               <div style={{ marginTop: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '8px', display: 'flex', justifyContent: 'center' }}>
                 <button 
                   onClick={(e) => { e.stopPropagation(); cancelListening(); }} 
                   style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                 >
                   <X size={14} /> Cancel Request
                 </button>
               </div>
            )}
          </div>
        )}

          <button 
            className={`va-btn ${isSpeaking ? '' : (isConversationActive ? 'pulse-anim' : '')}`}
            onClick={toggleListen}
            style={{ 
              backgroundColor: isSpeaking ? '#10b981' : (isConversationActive ? '#ef4444' : '#4f46e5') 
            }}
            title={isSpeaking ? "AI bol raha hai" : (isConversationActive ? "Stop Voice Assistant" : "Start Voice Assistant")}
          >
            {isSpeaking ? <Volume2 size={24} /> : (isConversationActive ? <MicOff size={24} /> : <Mic size={24} />)}
          </button>
        </div>
      {activeReceiptSale && <Receipt sale={activeReceiptSale} onClose={() => setActiveReceiptSale(null)} />}
    </>
  );
}
