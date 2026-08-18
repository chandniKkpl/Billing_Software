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

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: messages,
      config: {
        systemInstruction: systemInstruction + "\n\nCRITICAL RULE: You MUST always provide a brief conversational response in text, even when you are making a tool call. Never return ONLY a tool call. For example, if you call navigate_to('billing'), you must also output text like 'Main billing page par ja raha hu.'",
        tools: tools,
        temperature: 0.2
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
