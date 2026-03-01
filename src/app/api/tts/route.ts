import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const VOICE_NAME = 'cmn-CN-Standard-A';
const LANGUAGE_CODE = 'cmn-CN';
const MAX_TEXT_LENGTH = 2000;
const TIMEOUT_MS = 8000;

export async function POST(request: NextRequest) {
  const appSource = request.headers.get('X-App-Source');
  if (appSource !== 'pokemon-cards-master') {
    return NextResponse.json({ error: '未授权的请求' }, { status: 401 });
  }

  const apiKey = process.env.GOOGLE_CLOUD_TTS_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_CLOUD_TTS_API_KEY is not configured');
    return NextResponse.json({ error: 'TTS服务未配置' }, { status: 500 });
  }

  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  const { text } = body;
  if (!text) {
    return NextResponse.json({ error: '请提供朗读文本' }, { status: 400 });
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: '文本过长' }, { status: 413 });
  }

  try {
    // Google TTS has a sentence length limit. Insert line breaks after Chinese
    // commas to split long sentences, then escape XML special chars for SSML.
    const sanitized = text.replace(/([，、])/g, '$1\n');
    const escaped = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
    const ssml = `<speak>${escaped}</speak>`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { ssml },
          voice: { languageCode: LANGUAGE_CODE, name: VOICE_NAME },
          audioConfig: { audioEncoding: 'MP3' },
        }),
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Google Cloud TTS error:', response.status, errorBody);
      return NextResponse.json({ error: 'TTS生成失败' }, { status: 500 });
    }

    const data = await response.json();
    if (!data.audioContent) {
      console.error('Google Cloud TTS error: empty audioContent');
      return NextResponse.json({ error: 'TTS生成失败' }, { status: 500 });
    }
    const binaryStr = atob(data.audioContent);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    return new NextResponse(bytes, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': bytes.length.toString(),
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Google Cloud TTS error:', error);
    return NextResponse.json({ error: 'TTS生成失败' }, { status: 500 });
  }
}
