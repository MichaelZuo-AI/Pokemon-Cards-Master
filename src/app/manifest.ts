import type { MetadataRoute } from 'next';
import { BASE_PATH } from '@/lib/paths';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '宝可梦卡牌大师',
    short_name: '卡牌大师',
    description: '拍照识别宝可梦卡牌，中文语音朗读',
    start_url: BASE_PATH || '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#030712',
    theme_color: '#1a1a2e',
    icons: [
      {
        src: `${BASE_PATH}/icons/icon-192.png`,
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: `${BASE_PATH}/icons/icon-512.png`,
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
