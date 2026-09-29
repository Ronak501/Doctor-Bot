import { NextResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import Inquiry from '@/models/Inquiry';

export async function GET() {
  try {
    await dbConnect();
    const inquiries = await Inquiry.find({}).sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: inquiries });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch inquiries' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await dbConnect();
    const inquiry = await Inquiry.create(body);
    return NextResponse.json({ success: true, data: inquiry }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create inquiry' }, { status: 500 });
  }
}
