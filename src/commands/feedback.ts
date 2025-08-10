export async function submitFeedback(message: string, contact?: string): Promise<{ ok: boolean; id: string }> {
  // Stub: in real implementation, POST to backend
  const id = `fb_${Date.now()}`;
  return { ok: !!message, id };
}