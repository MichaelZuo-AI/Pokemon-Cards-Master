import { NextRequest, NextResponse } from 'next/server';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const VOICE = 'zh-CN-XiaoxiaoNeural';
const FORMAT = OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3;
const MAX_TEXT_LENGTH = 2000;
const STREAM_TIMEOUT_MS = 8000;

export async function POST(request: NextRequest) {
  const appSource = request.headers.get('X-App-Source');
  if (appSource !== 'pokemon-cards-master') {
    return NextResponse.json({ error: '未授权的请求' }, { status: 401 });
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
    const tts = new MsEdgeTTS();
    await tts.setMetadata(VOICE, FORMAT);

    const { audioStream } = tts.toStream(text);
    const chunks: Buffer[] = [];

    const streamPromise = new Promise<void>((resolve, reject) => {
      audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
      audioStream.on('end', () => resolve());
      audioStream.on('error', (err: Error) => reject(err));
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('TTS stream timeout')), STREAM_TIMEOUT_MS);
    });

    await Promise.race([streamPromise, timeoutPromise]);

    const audioBuffer = Buffer.concat(chunks);

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Edge TTS error:', error);
    return NextResponse.json({ error: 'TTS生成失败' }, { status: 500 });
  }
}
