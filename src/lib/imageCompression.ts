export const MAX_AVATAR_BYTES = 100 * 1024; // 100KB (102,400 bytes)

export interface CompressedImageResult {
  blob: Blob;
  dataUrl: string;
  byteSize: number;
  width: number;
  height: number;
  mimeType: string;
}

export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function estimateDataUrlBytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return dataUrl.length;
  const base64 = dataUrl.slice(commaIdx + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('이미지 파일을 읽을 수 없습니다. 올바른 이미지 파일인지 확인해 주세요.'));
    };
    img.src = objectUrl;
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

export async function compressImageUnder100KB(
  file: File,
  maxBytes: number = MAX_AVATAR_BYTES,
): Promise<CompressedImageResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일(JPG, PNG, WEBP, GIF 등)만 업로드할 수 있습니다.');
  }

  const img = await loadImageFromFile(file);
  const srcWidth = img.naturalWidth || img.width || 512;
  const srcHeight = img.naturalHeight || img.height || 512;

  const dimensionSteps = [512, 400, 320, 256, 192, 144, 112];
  const qualitySteps = [0.85, 0.75, 0.65, 0.55, 0.45, 0.35];

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('브라우저에서 이미지 압축(Canvas)을 처리할 수 없습니다.');
  }

  const targetBinaryLimit = Math.min(maxBytes, Math.floor(maxBytes * 0.72));

  let bestDataUrl = '';
  let bestWidth = srcWidth;
  let bestHeight = srcHeight;
  let bestMime = 'image/jpeg';

  for (const maxDim of dimensionSteps) {
    const scale = Math.min(1, maxDim / Math.max(srcWidth, srcHeight));
    const targetW = Math.max(1, Math.round(srcWidth * scale));
    const targetH = Math.max(1, Math.round(srcHeight * scale));

    canvas.width = targetW;
    canvas.height = targetH;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    for (const quality of qualitySteps) {
      let candidateUrl = canvas.toDataURL('image/webp', quality);
      let candidateMime = 'image/webp';
      if (!candidateUrl.startsWith('data:image/webp')) {
        candidateUrl = canvas.toDataURL('image/jpeg', quality);
        candidateMime = 'image/jpeg';
      }

      const binBytes = estimateDataUrlBytes(candidateUrl);
      bestDataUrl = candidateUrl;
      bestWidth = targetW;
      bestHeight = targetH;
      bestMime = candidateMime;

      if (binBytes <= targetBinaryLimit) {
        const blob = dataUrlToBlob(candidateUrl);
        return {
          blob,
          dataUrl: candidateUrl,
          byteSize: blob.size,
          width: targetW,
          height: targetH,
          mimeType: candidateMime,
        };
      }
    }
  }

  const finalBlob = dataUrlToBlob(bestDataUrl);
  if (finalBlob.size > maxBytes) {
    throw new Error('이미지를 100KB 이하로 압축하지 못했습니다. 다른 이미지를 선택해 주세요.');
  }

  return {
    blob: finalBlob,
    dataUrl: bestDataUrl,
    byteSize: finalBlob.size,
    width: bestWidth,
    height: bestHeight,
    mimeType: bestMime,
  };
}
