import { getGenerativeModel } from 'firebase/ai';
import { ai } from '../../firebase';

const ASSISTANT_MODEL = 'gemini-1.5-flash';

function getGeminiApiKey() {
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_GEMINI_API_KEY) {
    return process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  }
  if (typeof import.meta !== 'undefined' && import.meta.env?.NEXT_PUBLIC_GEMINI_API_KEY) {
    return import.meta.env.NEXT_PUBLIC_GEMINI_API_KEY;
  }
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) {
    return import.meta.env.VITE_GEMINI_API_KEY;
  }
  return '';
}

export function isAiConfigError(error) {
  const message = String(error?.message || error?.code || error || '');
  return (
    message.includes('api-not-enabled')
    || message.includes('API_KEY_SERVICE_BLOCKED')
    || message.includes('firebasevertexai.googleapis.com')
    || message.includes('generativelanguage.googleapis.com')
    || message.includes('AI/api-not-enabled')
  );
}

export function getAiSetupMessage() {
  return (
    'WinTogether AI is not configured yet. Enable Firebase AI Logic for project '
    + 'wt-billing-software at https://console.firebase.google.com/project/wt-billing-software/ailogic '
    + 'and click Get started (choose Gemini Developer API). '
    + 'Alternatively, add NEXT_PUBLIC_GEMINI_API_KEY from https://aistudio.google.com/apikey to .env.local.'
  );
}

async function generateWithFirebaseAi(prompt) {
  const model = getGenerativeModel(ai, { model: ASSISTANT_MODEL });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function generateWithGeminiRest(prompt, apiKey) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${ASSISTANT_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  const payload = await response.json();
  if (!response.ok) {
    const apiMessage = payload?.error?.message || `Gemini REST request failed (${response.status})`;
    throw new Error(apiMessage);
  }

  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
  if (!text) {
    throw new Error('Gemini REST returned an empty response');
  }
  return text;
}

export async function generateAssistantText(prompt) {
  try {
    return await generateWithFirebaseAi(prompt);
  } catch (firebaseError) {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      throw firebaseError;
    }

    console.warn('Firebase AI unavailable, using Gemini REST fallback', firebaseError);
    return generateWithGeminiRest(prompt, apiKey);
  }
}

export async function verifyAssistantAi(prompt = 'Reply with exactly: OK') {
  const text = await generateAssistantText(prompt);
  return {
    ok: Boolean(text?.trim()),
    text: text?.trim() || '',
    backend: getGeminiApiKey() ? 'firebase-or-gemini-rest-fallback' : 'firebase-ai-logic',
  };
}
