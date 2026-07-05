/** Strips the data-URL prefix and returns the raw base64 payload. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.slice(dataUrl.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Plays base64-encoded audio and resolves when playback finishes. */
export function playBase64Audio(base64: string, mimeType: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(`data:${mimeType};base64,${base64}`);
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error("audio playback failed"));
    audio.play().catch(reject);
  });
}
