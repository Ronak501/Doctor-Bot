import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();
    
    if (!text) {
      return NextResponse.json({ success: false, error: 'Missing text' }, { status: 400 });
    }

    const response = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': process.env.SERVAM_API_KEY || ''
      },
      body: JSON.stringify({
        inputs: [text],
        target_language_code: 'en-IN',
        speaker: 'meera',
        pitch: 0,
        pace: 1.0,
        loudness: 1.5,
        speech_sample_rate: 8000,
        enable_preprocessing: true
      })
    });

    const textData = await response.text();
    let data;
    try {
      data = JSON.parse(textData);
    } catch (e) {
      throw new Error(`Sarvam API Error: ${response.status} ${response.statusText} - ${textData}`);
    }
    
    if (!response.ok) {
      throw new Error(`Sarvam Rejected: ${JSON.stringify(data)}`);
    }

    return NextResponse.json({ success: true, audioBase64: data.audios[0] });
  } catch (error: any) {
    console.error('Sarvam TTS Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
