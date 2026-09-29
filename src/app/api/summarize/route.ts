import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { transcript } = await request.json();
    
    const prompt = `Extract the patient details from the following conversation transcript.
    Return ONLY a raw JSON object (no markdown formatting, no code blocks) with these exact keys:
    "patientName" (string), "age" (number), "mainProblem" (string), "symptoms" (string), "duration" (string).
    If a value is unknown, use "Not provided".
    
    Transcript:
    ${transcript}`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'qwen/qwen3.8-27b',
      temperature: 0.1
    });

    let result = chatCompletion.choices[0]?.message?.content || '{}';
    // Clean up potential markdown formatting if LLaMA ignores instructions
    result = result.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const extractedData = JSON.parse(result);

    return NextResponse.json({ success: true, data: extractedData });
  } catch (error) {
    console.error('Summary Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to extract info' }, { status: 500 });
  }
}
