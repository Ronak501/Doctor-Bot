import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const SYSTEM_PROMPT = `You are Doctor-Bot, a friendly AI medical assistant. 
Your ONLY job is to ask the patient questions to collect EXACTLY these 5 pieces of information:
1. Full Name
2. Age
3. Main Problem (Why they are visiting)
4. Detailed Symptoms
5. Duration (How long they've had the problem)

CRITICAL RULES:
- NEVER ask more than ONE question at a time. Wait for the patient's answer.
- DO NOT skip any of the 5 items. If they give you their name, you MUST ask for their age next.
- ONLY when you are 100% sure you have collected ALL 5 pieces of information, you MUST reply with exactly this sentence: "Thank you! I have gathered all the necessary information. Please click 'Submit to Doctor' below to send this to the clinic."`;

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();
    
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ success: false, error: 'Invalid messages array' }, { status: 400 });
    }

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
      ],
      model: 'qwen/qwen3.8-27b',
    });

    const reply = chatCompletion.choices[0]?.message?.content || 'I am having trouble understanding, could you repeat that?';

    return NextResponse.json({ success: true, reply });
  } catch (error) {
    console.error('Groq Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate response' }, { status: 500 });
  }
}
