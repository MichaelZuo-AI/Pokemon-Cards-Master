import { NextRequest, NextResponse } from 'next/server';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const VOICE = 'zh-CN-XiaoxiaoNeural';
const FORMAT = OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3;

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

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(VOICE, FORMAT);

    const readable = tts.toStream(text);
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      readable.on('data', (chunk: Buffer) => chunks.push(chunk));
      readable.on('end', () => resolve());
      readable.on('error', (err: Error) => reject(err));
    });

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
