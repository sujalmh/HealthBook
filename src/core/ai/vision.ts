/**
 * CareCanvas AI Core — Vision
 * Generic vision+text multimodal single response.
 * Handles image_url (chat) vs input_image (responses) generically via VITE_AI_PROVIDER.
 * Single fetch body contains both image+text when image present — not separate OCR then text.
 */

import type { AIConfig } from './types.ts';
import { isResponsesProvider } from './config.ts';

export function isImageDataUrl(value?: string): boolean {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith('data:image');
}

export function isPdfDataUrl(value?: string): boolean {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith('data:application/pdf');
}

export function isFileDataUrl(value?: string): boolean {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith('data:');
}

export function isVisionInput(value?: string): boolean {
  return isImageDataUrl(value) || isPdfDataUrl(value);
}

/**
 * Build chat provider content array for vision+text.
 * For chat use image_url for images, file for PDFs (many models support PDF directly via file_data).
 * Single response where model supports it — image/pdf + text in ONE fetch body.
 */
function extractBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return comma !== -1 ? dataUrl.slice(comma + 1) : dataUrl;
}

export function buildChatVisionContent(
  text: string,
  imageDataUrl?: string
): Array<{ type: string; text?: string; image_url?: { url: string }; file?: { filename: string; file_data: string } }> {
  if (imageDataUrl && isPdfDataUrl(imageDataUrl)) {
    return [
      { type: 'text', text: text || 'Extract clinical facts from this PDF document.' },
      { type: 'file', file: { filename: 'document.pdf', file_data: extractBase64(imageDataUrl) } } as any,
    ];
  }
  if (imageDataUrl && isImageDataUrl(imageDataUrl)) {
    // vision multimodal: image_url + text together
    return [
      { type: 'text', text: text || 'Extract clinical facts from this document image and text.' },
      { type: 'image_url', image_url: { url: imageDataUrl } },
    ];
  }
  // Generic file (video etc) — try file type
  if (imageDataUrl && isFileDataUrl(imageDataUrl)) {
    return [
      { type: 'text', text: text || 'Extract clinical facts from this document.' },
      { type: 'file', file: { filename: 'document', file_data: extractBase64(imageDataUrl) } } as any,
    ];
  }
  return [{ type: 'text', text }];
}

/**
 * Build responses provider input content for vision+text.
 * For responses use input_image for images, input_file for PDFs (many models support PDF directly).
 */
export function buildResponsesVisionContent(
  text: string,
  imageDataUrl?: string
): Array<{ type: string; text?: string; image_url?: string; filename?: string; file_data?: string }> {
  if (imageDataUrl && isPdfDataUrl(imageDataUrl)) {
    return [
      { type: 'input_text', text: text || 'Extract clinical facts from this PDF document.' },
      { type: 'input_file', filename: 'document.pdf', file_data: extractBase64(imageDataUrl) } as any,
    ];
  }
  if (imageDataUrl && isImageDataUrl(imageDataUrl)) {
    // vision multimodal: input_image + text together single request
    return [
      { type: 'input_text', text: text || 'Extract clinical facts from this document image and text.' },
      { type: 'input_image', image_url: imageDataUrl },
    ];
  }
  if (imageDataUrl && isFileDataUrl(imageDataUrl)) {
    return [
      { type: 'input_text', text: text || 'Extract clinical facts from this document.' },
      { type: 'input_file', filename: 'document', file_data: extractBase64(imageDataUrl) } as any,
    ];
  }
  return [{ type: 'input_text', text }];
}

/**
 * Generic builder that branches via provider.
 * Returns content array for the respective provider.
 */
export function buildVisionContent(
  provider: AIConfig['provider'],
  text: string,
  imageDataUrl?: string
): any[] {
  if (provider === 'responses') {
    return buildResponsesVisionContent(text, imageDataUrl);
  }
  return buildChatVisionContent(text, imageDataUrl);
}

/**
 * Determine if request should be treated as vision/file request.
 */
export function shouldUseVision(imageDataUrl?: string): boolean {
  return !!imageDataUrl && (isImageDataUrl(imageDataUrl) || isPdfDataUrl(imageDataUrl) || isFileDataUrl(imageDataUrl));
}

/**
 * Build message/input wrappers generically.
 */
export function buildChatMessages(
  systemPrompt: string,
  userText: string,
  imageDataUrl?: string
): Array<{ role: string; content: any }> {
  const userContent = buildChatVisionContent(userText, imageDataUrl);
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];
}

export function buildResponsesInput(
  systemPrompt: string,
  userText: string,
  imageDataUrl?: string
): any[] {
  const userContent = buildResponsesVisionContent(userText, imageDataUrl);
  return [
    { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
    { role: 'user', content: userContent },
  ];
}

/**
 * Validate that a single request contains both image/pdf/file and text together (multimodal).
 * Used for verification logging vision-multimodal.log single request image+text.
 */
export function isMultimodalRequestBody(body: any, provider: AIConfig['provider']): boolean {
  try {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const hasFileMarker = bodyStr.includes('image_url') || bodyStr.includes('input_image') || bodyStr.includes('input_file') || bodyStr.includes('file_data');
    const hasTextMarker = bodyStr.includes('text');
    if (provider === 'responses') {
      return (bodyStr.includes('input_image') || bodyStr.includes('input_file')) && bodyStr.includes('input_text');
    }
    return (bodyStr.includes('image_url') || bodyStr.includes('file')) && bodyStr.includes('text');
  } catch {
    return false;
  }
}
