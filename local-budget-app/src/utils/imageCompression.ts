/**
 * Client-Side Image Compression Utility
 * Preserves horizontal sharpness for tall supermarket receipts (like Lidl/Aldi)
 * by capping width (default 1400px) and allowing tall heights (up to 4000px)
 * instead of crushing tall receipts down to unreadable narrow strips.
 */

export async function compressImageToDataUrl(
  source: File | Blob | string,
  maxWidth = 1400,
  quality = 0.82,
  maxHeight = 4000
): Promise<string> {
  const dataUrl =
    typeof source === 'string' ? source : await blobToDataUrl(source);

  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        let { width, height } = img;

        // First cap width so horizontal text remains crisp
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        // Only cap height if the image is extraordinarily tall
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Failed to decode image for compression'));
    img.src = dataUrl;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Unable to read file as Data URL'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

export function extractBase64Payload(dataUrl: string): {
  base64: string;
  mimeType: string;
} {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return { base64: dataUrl, mimeType: 'image/jpeg' };
  }
  return { mimeType: match[1], base64: match[2] };
}
