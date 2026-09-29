import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ success: false, error: 'Missing audio file' }, { status: 400 });
    }

    const sarvamFormData = new FormData();
    sarvamFormData.append('file', file);
    sarvamFormData.append('model', 'saarika:v2.5');
    sarvamFormData.append('language_code', 'en-IN');

    const response = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: {
        'api-subscription-key': process.env.SERVAM_API_KEY || ''
      },
      body: sarvamFormData
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

    return NextResponse.json({ success: true, text: data.transcript });
  } catch (error: any) {
    console.error('Sarvam STT Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
