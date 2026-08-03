import { useState, useCallback, useRef } from 'react';

interface UseImageUploadOptions {
  maxSizeMB?: number;        // 最大文件大小（MB），默认 10
  accept?: string;           // 接受的文件类型，默认 'image/*'
  multiple?: boolean;        // 是否允许多选，默认 false
  onUpload?: (files: File[]) => void; // 上传回调
}

interface UseImageUploadReturn {
  uploadedImage: string | null;           // 单图模式：base64 图片
  uploadedImages: string[];               // 多图模式：base64 图片数组
  files: File[] | null;                   // 原始 File 对象
  isDragging: boolean;                    // 是否正在拖拽
  error: string | null;                   // 错误信息
  handleDrop: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  processFile: (file: File) => void;      // 手动处理文件
  clear: () => void;                      // 清除已上传的图片
  setError: (error: string | null) => void;
}

/**
 * 图片上传统一 Hook
 * 
 * 功能：
 * - 支持拖拽上传
 * - 支持点击选择
 * - 支持多图上传
 * - 文件大小验证
 * - 文件类型验证
 * - 自动转 base64
 * 
 * @example
 * ```tsx
 * function RemoveBackground() {
 *   const {
 *     uploadedImage,
 *     isDragging,
 *     error,
 *     handleDrop,
 *     handleDragOver,
 *     handleDragLeave,
 *     handleFileSelect,
 *     clear,
 *   } = useImageUpload({ maxSizeMB: 5 });
 * 
 *   return (
 *     <div
 *       onDrop={handleDrop}
 *       onDragOver={handleDragOver}
 *       onDragLeave={handleDragLeave}
 *       className={cn('upload-area', isDragging && 'dragging')}
 *     >
 *       <input
 *         type="file"
 *         accept="image/*"
 *         onChange={handleFileSelect}
 *       />
 *       {uploadedImage && <img src={uploadedImage} alt="已上传" />}
 *       {error && <div className="error">{error}</div>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useImageUpload(options: UseImageUploadOptions = {}): UseImageUploadReturn {
  const {
    maxSizeMB = 10,
    accept = 'image/*',
    multiple = false,
    onUpload,
  } = options;

  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [files, setFiles] = useState<File[] | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /**
   * 验证并处理单个文件
   */
  const processFile = useCallback((file: File) => {
    // 文件类型验证
    if (!file.type.startsWith('image/')) {
      setError('请上传图片文件');
      return;
    }

    // 文件大小验证
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setError(`文件大小不能超过 ${maxSizeMB}MB`);
      return;
    }

    // 转换为 base64
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      
      if (multiple) {
        setUploadedImages((prev) => [...prev, result]);
        setFiles((prev) => (prev ? [...prev, file] : [file]));
      } else {
        setUploadedImage(result);
        setFiles([file]);
      }
      
      setError(null);
      onUpload?.(multiple ? [file] : [file]);
    };
    reader.onerror = () => {
      setError('文件读取失败，请重试');
    };
    reader.readAsDataURL(file);
  }, [maxSizeMB, multiple, onUpload]);

  /**
   * 处理文件选择（多图）
   */
  const processMultipleFiles = useCallback((selectedFiles: File[]) => {
    const validFiles = selectedFiles.filter(file => {
      if (!file.type.startsWith('image/')) {
        setError('请上传图片文件');
        return false;
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(`文件大小不能超过 ${maxSizeMB}MB`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    const readers = validFiles.map(file => {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers)
      .then((results) => {
        if (multiple) {
          setUploadedImages((prev) => [...prev, ...results]);
          setFiles((prev) => (prev ? [...prev, ...validFiles] : validFiles));
        } else {
          setUploadedImage(results[0]);
          setFiles([validFiles[0]]);
        }
        setError(null);
        onUpload?.(validFiles);
      })
      .catch(() => {
        setError('文件读取失败，请重试');
      });
  }, [maxSizeMB, multiple, onUpload]);

  /**
   * 处理拖拽放下
   */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length === 0) return;

    if (multiple) {
      processMultipleFiles(droppedFiles);
    } else {
      processFile(droppedFiles[0]);
    }
  }, [multiple, processFile, processMultipleFiles]);

  /**
   * 处理拖拽经过
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  /**
   * 处理拖拽离开
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  /**
   * 处理文件选择器
   */
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    if (multiple) {
      processMultipleFiles(selectedFiles);
    } else {
      processFile(selectedFiles[0]);
    }

    // 重置 input，允许重复选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [multiple, processFile, processMultipleFiles]);

  /**
   * 清除已上传的图片
   */
  const clear = useCallback(() => {
    setUploadedImage(null);
    setUploadedImages([]);
    setFiles(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return {
    uploadedImage,
    uploadedImages,
    files,
    isDragging,
    error,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handleFileSelect,
    processFile,
    clear,
    setError,
  };
}
