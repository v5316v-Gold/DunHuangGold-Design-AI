'use client';

/**
 * Model Viewer 脚本加载器
 *
 * 背景 (2026-08-03 修复):
 *   原 layout.tsx 直接在根布局用 <Script type="module"> 加载 model-viewer，
 *   但 Next 15 在预渲染 _not-found 等特殊路由时，HeadManagerContext 可能为 null，
 *   导致 <Script> 内部 useContext 崩溃（Cannot read properties of null (reading 'useContext')）。
 *
 * 修复: 改为客户端动态注入 <script type="module">，避免在服务端预渲染阶段触发。
 * 功能不变: 页面加载后在浏览器注入 model-viewer 脚本。
 */

import { useEffect } from 'react';

const MODEL_VIEWER_SRC =
  'https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js';

let injected = false;

export default function ModelViewerScript() {
  useEffect(() => {
    if (injected) return;
    injected = true;

    // 检查是否已存在
    if (document.querySelector('script[data-model-viewer]')) return;

    const script = document.createElement('script');
    script.type = 'module';
    script.src = MODEL_VIEWER_SRC;
    script.dataset.modelViewer = 'true';
    document.head.appendChild(script);
  }, []);

  return null;
}
