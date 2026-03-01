import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, createPartFromBase64 } from '@google/genai';

const VISION_MODEL = 'gemma-3-27b-it';

const SYSTEM_PROMPT = `你是一个宝可梦卡牌识别专家，同时也是宝可梦百科全书。用户会发送一张宝可梦卡牌的照片，请识别卡牌并返回以下JSON格式的信息（所有文字用简体中文）：

{
  "nameCn": "中文名称",
  "nameEn": "English Name",
  "nameJp": "日文名称",
  "introduction": "用2-3句话介绍这只宝可梦，包括它的特征、能力、在宝可梦世界中的地位等，像给小朋友讲故事一样生动有趣",
  "types": ["属性1"],
  "hp": "HP数值（纯数字，如120）",
  "stage": "阶段（基础/一阶/二阶/V/VMAX/VSTAR/ex/GX等）",
  "attacks": [
    {
      "name": "技能名称",
      "damage": "伤害值",
      "energyCost": "所需能量描述",
      "description": "技能效果描述"
    }
  ],
  "weakness": "弱点属性（如：火×2）",
  "resistance": "抵抗属性（没有则写无）",
  "retreatCost": "撤退费用（如：2个无色能量）",
  "rarity": "稀有度（如：普通/非普通/稀有/超稀有/闪卡等）",
  "setName": "系列名称",
  "cardNumber": "卡牌编号",
  "flavorText": "卡牌描述文字（翻译成中文）",
  "ttsSummary": "像一个热情的宝可梦训练师在跟小朋友聊天一样，口语化地介绍这张卡牌。用'哇'、'超厉害'、'你知道吗'这样的口语词让语气更活泼。提到名称、属性、HP、最强的技能。大约80-120字，要有感情，像讲故事一样有起伏。"
}

重要规则：
- 每个字段都必须填写，不能留空字符串！
- 如果卡牌上看不清某个信息，请根据你对宝可梦的知识来补充。你是宝可梦专家，你知道每只宝可梦的属性、弱点、进化阶段等信息。
- introduction 必须写得生动有趣，像在给小朋友讲这只宝可梦的故事
- ttsSummary 是给语音朗读用的，必须非常口语化，像真人在兴奋地聊天。不要用书面语，不要列举数据。要像："哇，你看这张超梦！它可是超能力属性的传说宝可梦哦！有120的血量呢，而且它的精神破坏技能超厉害，一下就能打出150的伤害！这张卡还是超稀有的呢！"
- HP必须是具体数字，不能为空
- 只返回JSON，不要其他文字`;

// Max base64 image size: ~5MB
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function extractJSON(text: string): string {
  // Try to extract JSON from markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Try to find raw JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];

  return text;
}

function sanitizeCardInfo(raw: Record<string, unknown>) {
  return {
    nameCn: typeof raw.nameCn === 'string' ? raw.nameCn : '未知',
    nameEn: typeof raw.nameEn === 'string' ? raw.nameEn : 'Unknown',
    nameJp: typeof raw.nameJp === 'string' ? raw.nameJp : '',
    introduction: typeof raw.introduction === 'string' ? raw.introduction : '',
    types: Array.isArray(raw.types) ? raw.types.filter((t: unknown) => typeof t === 'string') : [],
    hp: typeof raw.hp === 'string' ? raw.hp : '0',
    stage: typeof raw.stage === 'string' ? raw.stage : '',
    attacks: Array.isArray(raw.attacks)
      ? raw.attacks.map((a: Record<string, unknown>) => ({
          name: typeof a?.name === 'string' ? a.name : '',
          damage: typeof a?.damage === 'string' ? a.damage : '',
          energyCost: typeof a?.energyCost === 'string' ? a.energyCost : '',
          description: typeof a?.description === 'string' ? a.description : '',
        }))
      : [],
    weakness: typeof raw.weakness === 'string' ? raw.weakness : '',
    resistance: typeof raw.resistance === 'string' ? raw.resistance : '',
    retreatCost: typeof raw.retreatCost === 'string' ? raw.retreatCost : '',
    rarity: typeof raw.rarity === 'string' ? raw.rarity : '',
    setName: typeof raw.setName === 'string' ? raw.setName : '',
    cardNumber: typeof raw.cardNumber === 'string' ? raw.cardNumber : '',
    flavorText: typeof raw.flavorText === 'string' ? raw.flavorText : '',
    ttsSummary: typeof raw.ttsSummary === 'string' ? raw.ttsSummary : '',
  };
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

  if (image.length > MAX_IMAGE_SIZE) {
    return NextResponse.json(
      { error: '图片太大，请压缩后重试' },
      { status: 413 },
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const imagePart = createPartFromBase64(image, 'image/jpeg');

    const response = await ai.models.generateContent({
      model: VISION_MODEL,
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
    const raw = JSON.parse(jsonStr);
    const cardInfo = sanitizeCardInfo(raw);

    return NextResponse.json({ cardInfo });
  } catch (error) {
    console.error('Gemini API error:', error);
    return NextResponse.json(
      { error: '识别失败，请重试' },
      { status: 500 },
    );
  }
}
