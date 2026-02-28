const MAX_DIMENSION = 1024;
const THUMBNAIL_SIZE = 200;
const JPEG_QUALITY = 0.85;
const THUMBNAIL_QUALITY = 0.7;

function resizeWithCanvas(
  img: HTMLImageElement,
  maxSize: number,
  quality: number,
): string {
  let { width, height } = img;

  if (width > maxSize || height > maxSize) {
    const ratio = Math.min(maxSize / width, maxSize / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  ctx.drawImage(img, 0, 0, width, height);
  const dataURL = canvas.toDataURL('image/jpeg', quality);

  // Release canvas memory (important on mobile Safari)
  canvas.width = 0;
  canvas.height = 0;

  return dataURL;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function resizeImage(file: File): Promise<string> {
  const dataURL = await fileToDataURL(file);
  const img = await loadImage(dataURL);
  return resizeWithCanvas(img, MAX_DIMENSION, JPEG_QUALITY);
}

export async function createThumbnail(file: File): Promise<string> {
  const dataURL = await fileToDataURL(file);
  const img = await loadImage(dataURL);
  return resizeWithCanvas(img, THUMBNAIL_SIZE, THUMBNAIL_QUALITY);
}

export function stripDataURIPrefix(dataURI: string): string {
  return dataURI.replace(/^data:image\/\w+;base64,/, '');
}
