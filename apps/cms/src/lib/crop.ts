/**
 * Client-side square crop matching the drawer preview: the image is "object-fit: cover" in a square and then
 * scaled by `zoom` from the centre, so the visible region is a centred square of (min side / zoom) pixels.
 */
export async function cropSquare(file: Blob, zoom: number, outputSize = 1200): Promise<Blob> {
  const image = await loadImage(file);
  const side = Math.min(image.naturalWidth, image.naturalHeight) / Math.max(1, zoom);
  const sx = (image.naturalWidth - side) / 2;
  const sy = (image.naturalHeight - side) / 2;
  const size = Math.min(outputSize, Math.round(side));
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return file;
  context.drawImage(image, sx, sy, side, side, 0, 0, size, size);
  return new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? file), 'image/jpeg', 0.92);
  });
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read this image'));
    };
    image.src = url;
  });
}
