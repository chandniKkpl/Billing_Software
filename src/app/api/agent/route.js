import { GoogleGenAI } from '@google/genai';

export async function POST(req) {
  try {
    const { messages, systemInstruction } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    
    if (!apiKey) {
      return Response.json({ error: "Gemini API Key is missing. Please set GEMINI_API_KEY in .env.local" }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey });

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
                description: "The page to navigate to. E.g., 'billing', 'purchase', 'customers', 'inventory', 'reports', 'settings', 'dashboard'.",
              }
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
              name: { type: "STRING", description: "Customer's full name" },
              phone: { type: "STRING", description: "Customer's phone number (Required)" },
              address: { type: "STRING", description: "Customer's address" },
              udhaarBalance: { type: "NUMBER", description: "Customer's opening debt or balance (Required, 0 if none)" }
            },
            required: ["name", "phone", "udhaarBalance"]
          }
        },
        {
          name: "add_product",
          description: "Add a new product to the inventory once Name, Selling Price, and Stock are provided.",
          parameters: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING", description: "Name of the product" },
              sellingPrice: { type: "NUMBER", description: "Selling price of the product (Required)" },
              stock: { type: "NUMBER", description: "Initial stock quantity (Required)" }
            },
            required: ["name", "sellingPrice", "stock"]
          }
        },
        {
          name: "add_to_cart",
          description: "Add an item/product to the cart (for both billing and purchase entry) by its ID or name.",
          parameters: {
            type: "OBJECT",
            properties: {
              product_id: { type: "STRING", description: "The product name or ID to add to the cart." },
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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: messages,
      config: {
        systemInstruction: (systemInstruction || "") + "\n\nCRITICAL SCOPE & DOMAIN RESTRICTIONS:\n1. You are EXCLUSIVELY an assistant for Cosmo Store billing, retail, inventory, and customer management.\n2. If user asks ANY out-of-scope question (personal advice, dating/friendship/sex, general trivia, external web/google search, random math/homework), STRICTLY refuse politely: 'Kshama kijiye, main keval Cosmo Store ke billing, stock, customers aur sales se jude kaamo me madad kar sakta hu.'\n3. DO NOT call any tool for out-of-scope questions.\n\nCRITICAL CONVERSATIONAL & MANDATORY INFO RULE:\n1. When the user asks to navigate AND perform an action (e.g. go to customer page and add a customer), execute 'navigate_to' immediately.\n2. If mandatory details are missing (e.g. Customer requires Name, Phone number, and Udhaar balance; Product requires Name, Selling Price, and Stock), DO NOT call the add tool yet. Instead, in your conversational text response, ask the user to provide the missing details (e.g. 'Thik hai, mai customers page par ja raha hu. Kripya Ayushi tester ka mobile number aur udhaar balance batayein.').\n3. When the user provides the missing details, call the add tool and confirm.",
        tools: tools,
        temperature: 0.1
      }
    });

    // Check if the response contains function calls
    const functionCalls = response.functionCalls || [];
    const textResponse = response.text || "";

    return Response.json({
      text: textResponse,
      functionCalls: functionCalls.map(call => ({
        name: call.name,
        args: call.args
      })),
      rawResponse: response
    });

  } catch (error) {
    console.error("AI Agent Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
