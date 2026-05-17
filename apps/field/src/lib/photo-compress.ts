'use client';

export async function compressImage(file: File, maxLongEdge = 1600, qualityStart = 0.82, targetBytes = 200 * 1024): Promise<File> {
  if (file.size <= targetBytes) return file;
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = URL.createObjectURL(file);
  });
  const scale = Math.min(1, maxLongEdge / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  let q = qualityStart;
  let blob: Blob | null = null;
  for (let i = 0; i < 5; i += 1) {
    blob = await new Promise<Blob | null>((r) => canvas.toBlob((b) => r(b), 'image/jpeg', q));
    if (!blob) break;
    if (blob.size <= targetBytes) break;
    q -= 0.12;
    if (q < 0.4) break;
  }
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
}
