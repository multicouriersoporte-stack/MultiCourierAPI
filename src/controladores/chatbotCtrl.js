// src/controladores/chatbotCtrl.js

import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid'; // npm install uuid

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // o la key de otro proveedor
  // Si usas Groq, OpenRouter, etc.:
  // baseURL: 'https://api.groq.com/openai/v1'
});

const sessions = new Map(); // En producción → Redis o MongoDB

export const chat = async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ message: 'Mensaje inválido' });
    }

    const currentSessionId = sessionId || uuidv4();

    const systemPrompt = `Eres el asistente virtual oficial de MultiCourier.
Ayudas a los usuarios con:
- Consultas sobre envíos y tarifas
- Seguimiento de paquetes
- Horarios de atención
- Servicios de mensajería y logística

Responde siempre en español, de forma amable, clara y concisa.
Si no sabes algo con certeza, indica que un agente humano puede ayudar.`;

    let history = sessions.get(currentSessionId) || [];

    // Limitar historial para no gastar tokens de más
    if (history.length > 16) {
      history = history.slice(-16);
    }

    history.push({ role: 'user', content: message.trim() });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // o el modelo del proveedor que elijas
      messages: [
        { role: 'system', content: systemPrompt },
        ...history
      ],
      temperature: 0.6,
      max_tokens: 600
    });

    const botReply = completion.choices[0]?.message?.content || 'No pude generar una respuesta.';

    history.push({ role: 'assistant', content: botReply });
    sessions.set(currentSessionId, history);

    res.json({
      message: botReply,
      sessionId: currentSessionId
    });

  } catch (error) {
    console.error('Error chatbot:', error);
    res.status(500).json({
      message: 'Lo siento, estoy teniendo problemas técnicos. Intenta más tarde.'
    });
  }
};