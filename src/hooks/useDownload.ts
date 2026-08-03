export function useDownload(filename = 'dunhuang-ai') {
  const handleDownload = async (url: string, suffix = 'png') => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${filename}-${Date.now()}.${suffix}`;
      link.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank');
    }
  };
  return { handleDownload };
}
