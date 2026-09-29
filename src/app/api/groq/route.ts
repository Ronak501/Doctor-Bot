import { NextResponse } from 'next';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { patientData } = await request.json();
    
    if (!patientData || !patientData.mainProblem) {
      return NextResponse.json({ success: false, error: 'Missing patient data' }, { status: 400 });
    }

    const prompt = `You are a helpful medical assistant bot. A patient has provided the following details so far:
    Main Problem: ${patientData.mainProblem}
    Symptoms: ${patientData.symptoms || 'None provided yet'}
    
    Based on this, ask ONE relevant follow-up question to better understand their condition for the doctor. Keep it short, empathetic, and simple to understand. Do not provide a diagnosis.`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama3-8b-8192',
    });

    const question = chatCompletion.choices[0]?.message?.content || 'Can you tell me more about how you are feeling?';

    return NextResponse.json({ success: true, question });
  } catch (error) {
    console.error('Groq Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate question' }, { status: 500 });
  }
}
