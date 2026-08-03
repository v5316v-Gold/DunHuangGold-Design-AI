import type { Metadata, Viewport } from 'next';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/providers/AuthProvider';
import { GenerationTaskProvider } from '@/hooks/useGenerationTaskManager';
import AppInitializer from '@/components/app/AppInitializer';
import ModelViewerScript from '@/components/app/ModelViewerScript';

import GlobalEffects from '@/components/ui/GlobalEffects';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '敦煌金AI设计平台',
    template: '%s | 敦煌金AI设计平台',
  },
  description:
    '敦煌金AI设计平台 - 集成多种AI设计工具的在线工作台，包含文案生图、3D建模、浮雕设计、视频生成等功能。传承敦煌美学，赋能现代设计。',
  keywords: [
    '敦煌金',
    'AI设计',
    '文案生图',
    '3D建模',
    '浮雕设计',
    '视频生成',
    'AI绘画',
    '智能设计',
    '设计工具',
  ],
  authors: [{ name: '敦煌金AI设计平台' }],
  generator: 'Dunhuang Gold AI',
  openGraph: {
    title: '敦煌金AI设计平台',
    description: '传承敦煌美学，赋能现代设计。集成多种AI设计工具的在线工作台。',
    locale: 'zh_CN',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#C8A45C',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN" className="dark">
      <body className="antialiased bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <ModelViewerScript />
        <GlobalEffects />
        <AuthProvider>
          <GenerationTaskProvider>
            <AppInitializer>{children}</AppInitializer>
            <Toaster />
          </GenerationTaskProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
