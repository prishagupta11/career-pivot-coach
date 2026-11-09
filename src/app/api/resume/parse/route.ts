import { NextRequest, NextResponse } from 'next/server';
import { extractText } from 'unpdf';
import mammoth from 'mammoth';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'txt'];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No resume file provided.' }, { status: 400 });
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds the 5 MB limit. Please upload a smaller file.' },
        { status: 400 }
      );
    }

    const fileName = file.name || 'resume';
    const extension = fileName.split('.').pop()?.toLowerCase() || '';

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return NextResponse.json(
        { error: `Unsupported file type (.${extension}). Only PDF, DOCX, and TXT files are supported.` },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return NextResponse.json(
        { error: 'The uploaded file is empty. Please upload a file containing text.' },
        { status: 400 }
      );
    }

    let extractedText = '';

    if (extension === 'txt') {
      try {
        extractedText = buffer.toString('utf-8');
      } catch {
        return NextResponse.json(
          { error: 'Could not decode text file. Ensure it is encoded in valid UTF-8.' },
          { status: 400 }
        );
      }
    } else if (extension === 'docx') {
      try {
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value || '';
        if (result.messages && result.messages.length > 0) {
          console.log('Mammoth conversion messages:', result.messages);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Corrupt file';
        return NextResponse.json(
          { error: `Unable to read DOCX file. It may be corrupt or encrypted (${msg}).` },
          { status: 400 }
        );
      }
    } else if (extension === 'pdf') {
      try {
        const pdfData = await extractText(new Uint8Array(arrayBuffer), { mergePages: true });
        extractedText = typeof pdfData.text === 'string' ? pdfData.text : '';
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown PDF error';
        if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('encrypted')) {
          return NextResponse.json(
            { error: 'This PDF is password-protected. Please upload an unlocked PDF.' },
            { status: 400 }
          );
        }
        return NextResponse.json(
          { error: `Unable to parse PDF file. The file may be corrupt or invalid (${msg}).` },
          { status: 400 }
        );
      }
    }

    const cleanText = extractedText.trim();
    if (!cleanText) {
      return NextResponse.json(
        { 
          error: extension === 'pdf' 
            ? 'No readable text found in this PDF. It may be a scanned image-only PDF. Please provide a text-based PDF or paste your background directly.'
            : 'The uploaded file does not contain any readable text.' 
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      text: cleanText,
      fileName,
      fileSize: file.size
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unexpected server error';
    return NextResponse.json(
      { error: `An unexpected error occurred while parsing the resume: ${msg}` },
      { status: 500 }
    );
  }
}
