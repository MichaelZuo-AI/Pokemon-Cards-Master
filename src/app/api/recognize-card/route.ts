import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, createPartFromBase64 } from '@google/genai';

const GEMINI_MODEL = 'gemini-2.5-flash';

const SYSTEM_PROMPT = `你是一个宝可梦卡牌识别专家。用户会发送一张宝可梦卡牌的照片，请识别卡牌并返回以下JSON格式的信息（所有文字用简体中文）：

{
  "nameCn": "中文名称",
  "nameEn": "English Name",
  "nameJp": "日文名称（如果可见）",
  "types": ["属性1"],
  "hp": "HP值",
  "stage": "阶段（基础/一阶/二阶/V/VMAX/ex等）",
  "attacks": [
    {
      "name": "技能名称",
      "damage": "伤害值",
      "energyCost": "所需能量",
      "description": "技能效果描述"
    }
  ],
  "weakness": "弱点属性",
  "resistance": "抵抗属性（没有则留空）",
  "retreatCost": "撤退费用数量",
  "rarity": "稀有度",
  "setName": "系列名称",
  "cardNumber": "卡牌编号",
  "flavorText": "卡牌描述文字（翻译成中文）",
  "ttsSummary": "用一段自然流畅的中文总结这张卡牌的关键信息，适合语音朗读。包括名称、属性、HP、主要技能及伤害、稀有度。大约50-80字。"
}

注意：
- 如果某些信息在卡牌上看不到，用合理的默认值或留空字符串
- ttsSummary 应该像在跟小朋友介绍卡牌一样，自然亲切
- 只返回JSON，不要其他文字`;

function extractJSON(text: string): string {
  // Try to extract JSON from markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Try to find raw JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];

  return text;
}

export async function POST(request: NextRequest) {
  // Verify app source header
  const appSource = request.headers.get('X-App-Source');
  if (appSource !== 'pokemon-cards-master') {
    return NextResponse.json(
      { error: '未授权的请求' },
      { status: 401 },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'API密钥未配置' },
      { status: 500 },
    );
  }

  let body: { image?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: '请求格式错误' },
      { status: 400 },
    );
  }

  const { image } = body;
  if (!image) {
    return NextResponse.json(
      { error: '请提供卡牌图片' },
      { status: 400 },
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const imagePart = createPartFromBase64(image, 'image/jpeg');

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            imagePart,
            { text: SYSTEM_PROMPT },
          ],
        },
      ],
    });

    const text = response.text ?? '';
    const jsonStr = extractJSON(text);
    const cardInfo = JSON.parse(jsonStr);

    return NextResponse.json({ cardInfo });
  } catch (error) {
    console.error('Gemini API error:', error);
    return NextResponse.json(
      { error: '识别失败，请重试' },
      { status: 500 },
    );
  }
}
