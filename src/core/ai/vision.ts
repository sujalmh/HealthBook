/**
 * CareCanvas AI Core — Vision & Multimodal Message Composition
 */

import type {
  AIProvider,
  AIMessageContentText,
  AIMessageContentImageUrl,
  AIResponsesInputText,
  AIResponsesInputImage,
} from './types.ts';

export function isDataUrl(value?: string): boolean {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith('data:');
}

export function isVisionSupportedImage(value?: string): boolean {
  if (!value || typeof value !== 'string') return false;
  return (
    value.startsWith('data:image/jpeg') ||
    value.startsWith('data:image/jpg') ||
    value.startsWith('data:image/png') ||
    value.startsWith('data:image/webp') ||
    value.startsWith('data:image/gif') ||
    value.startsWith('data:image/x-icon') ||
    value.startsWith('data:image/vnd.microsoft.icon')
  );
}

export function isImageDataUrl(value?: string): boolean {
  return isVisionSupportedImage(value);
}

export function buildChatMessages(
  systemPrompt: string,
  userText: string,
  imageDataUrl?: string
): Array<{ role: 'system' | 'user'; content: string | Array<AIMessageContentText | AIMessageContentImageUrl> }> {
  if (imageDataUrl && isVisionSupportedImage(imageDataUrl)) {
    return [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: userText || 'Extract clinical facts from this document.' },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ],
      },
    ];
  }

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userText },
  ];
}

export function buildResponsesInput(
  systemPrompt: string,
  userText: string,
  imageDataUrl?: string
): Array<{ role: 'system' | 'user'; content: Array<AIResponsesInputText | AIResponsesInputImage> }> {
  if (imageDataUrl && isVisionSupportedImage(imageDataUrl)) {
    return [
      { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
      {
        role: 'user',
        content: [
          { type: 'input_text', text: userText || 'Extract clinical facts from this document.' },
          { type: 'input_image', image_url: imageDataUrl },
        ],
      },
    ];
  }

  return [
    { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
    { role: 'user', content: [{ type: 'input_text', text: userText }] },
  ];
}

export function isMultimodalRequestBody(body: unknown, provider: AIProvider): boolean {
  try {
    const s = typeof body === 'string' ? body : JSON.stringify(body);
    if (provider === 'responses') {
      return s.includes('input_image') && s.includes('input_text');
    }
    return s.includes('image_url') && s.includes('text');
  } catch {
    return false;
  }
}
