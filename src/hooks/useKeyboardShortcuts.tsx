import { useEffect, useCallback, useRef } from 'react';

interface Shortcut {
  key: string;                    // 按键（如 'Enter', 'Escape', 's'）
  modifiers?: ('ctrl' | 'alt' | 'shift' | 'meta')[]; // 修饰键
  handler: (e: KeyboardEvent) => void;
  description?: string;           // 快捷键描述
  preventDefault?: boolean;       // 是否阻止默认行为，默认 true
  stopPropagation?: boolean;      // 是否阻止事件冒泡，默认 false
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;              // 是否启用，默认 true
  ignoreInput?: boolean;          // 是否在输入框中禁用，默认 false
}

/**
 * 键盘快捷键 Hook
 * 
 * 功能：
 * - 支持组合键（Ctrl+S, Alt+Enter 等）
 * - 支持多个快捷键
 * - 输入框中可选禁用
 * - 自动清理监听器
 * 
 * @example
 * ```tsx
 * function Text2Image() {
 *   const [prompt, setPrompt] = useState('');
 *   const { isGenerating, handleGenerate } = useGeneration();
 * 
 *   useKeyboardShortcuts({
 *     shortcuts: [
 *       {
 *         key: 'Enter',
 *         modifiers: ['ctrl'],
 *         handler: () => {
 *           if (!isGenerating && prompt.trim()) {
 *             handleGenerate();
 *           }
 *         },
 *         description: '生成图片',
 *       },
 *       {
 *         key: 'Escape',
 *         handler: () => {
 *           setPrompt('');
 *         },
 *         description: '清空提示词',
 *       },
 *     ],
 *     ignoreInput: false, // 允许在输入框中使用
 *   });
 * 
 *   return (
 *     <div>
 *       <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} />
 *       <button onClick={handleGenerate}>
 *         生成 (Ctrl+Enter)
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useKeyboardShortcuts(
  options: {
    shortcuts: Shortcut[];
  } & UseKeyboardShortcutsOptions
) {
  const { shortcuts, enabled = true, ignoreInput = true } = options;
  const shortcutsRef = useRef(shortcuts);

  // 更新 shortcuts 引用
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 在输入框中时是否禁用
      if (ignoreInput) {
        const target = e.target as HTMLElement;
        const tagName = target.tagName.toLowerCase();
        const isInput =
          tagName === 'input' ||
          tagName === 'textarea' ||
          target.isContentEditable;

        if (isInput) return;
      }

      const pressedKey = e.key.toLowerCase();
      const pressedModifiers = {
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
        meta: e.metaKey,
      };

      for (const shortcut of shortcutsRef.current) {
        const keyMatches = shortcut.key.toLowerCase() === pressedKey;
        const modifiersMatch = !shortcut.modifiers || (
          shortcut.modifiers.every((mod) => pressedModifiers[mod]) &&
          shortcut.modifiers.length === 
            Object.values(pressedModifiers).filter(Boolean).length
        );

        if (keyMatches && modifiersMatch) {
          if (shortcut.preventDefault !== false) {
            e.preventDefault();
          }
          if (shortcut.stopPropagation) {
            e.stopPropagation();
          }
          shortcut.handler(e);
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, ignoreInput]);
}

/**
 * 获取快捷键描述文本
 */
export function getShortcutText(shortcut: Shortcut): string {
  const parts: string[] = [];

  if (shortcut.modifiers) {
    const modifierMap: Record<string, string> = {
      ctrl: 'Ctrl',
      alt: 'Alt',
      shift: 'Shift',
      meta: 'Cmd',
    };
    shortcut.modifiers.forEach((mod) => {
      parts.push(modifierMap[mod]);
    });
  }

  const keyMap: Record<string, string> = {
    enter: 'Enter',
    escape: 'Esc',
    backspace: 'Backspace',
    delete: 'Del',
    arrowup: '↑',
    arrowdown: '↓',
    arrowleft: '←',
    arrowright: '→',
    space: 'Space',
  };

  const key = shortcut.key.toLowerCase();
  parts.push(keyMap[key] || shortcut.key.toUpperCase());

  return parts.join('+');
}

/**
 * 快捷键提示组件
 */
export function ShortcutHint({ shortcut }: { shortcut: Shortcut }) {
  return (
    <span className="shortcut-hint">
      {shortcut.description && <span>{shortcut.description}: </span>}
      <kbd>{getShortcutText(shortcut)}</kbd>
      <style jsx>{`
        .shortcut-hint {
          font-size: 12px;
          color: #6b7280;
        }
        kbd {
          display: inline-block;
          padding: 2px 6px;
          font-size: 11px;
          font-family: monospace;
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          margin-left: 4px;
        }
      `}</style>
    </span>
  );
}
