import { NextResponse } from 'next';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ success: false, error: 'Missing audio file' }, { status: 400 });
    }

    const sarvamFormData = new FormData();
    sarvamFormData.append('file', file);
    sarvamFormData.append('model', 'saaras:v1');

    const response = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: {
        'api-subscription-key': process.env.SERVAM_API_KEY || ''
      },
      body: sarvamFormData
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to transcribe speech');
    }

    return NextResponse.json({ success: true, text: data.transcript });
  } catch (error: any) {
    console.error('Sarvam STT Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
