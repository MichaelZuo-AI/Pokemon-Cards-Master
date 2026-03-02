import type { Metadata, Viewport } from 'next';
import { SessionProvider } from 'next-auth/react';
import { BASE_PATH } from '@/lib/paths';
import './globals.css';

export const metadata: Metadata = {
  title: '宝可梦卡牌大师',
  description: '拍照识别宝可梦卡牌，中文语音朗读卡牌信息',
  manifest: `${BASE_PATH}/manifest.webmanifest`,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '卡牌大师',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1a1a2e',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-950 text-white min-h-screen">
        <SessionProvider basePath={`${BASE_PATH}/api/auth`}>
        {children}
        </SessionProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register(${JSON.stringify(`${BASE_PATH}/sw.js`)}).catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
