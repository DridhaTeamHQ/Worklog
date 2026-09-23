import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { getServerUrl, tokenStore } from '../api/client';

export interface AttachedFile {
  name: string;
  url: string;
  type: 'image' | 'file';
  size?: string;
}

export async function uploadToCloud(uri: string, name: string, mimeType?: string): Promise<string> {
  const cleanName = name || `upload_${Date.now()}.jpg`;
  const cleanType = mimeType || 'image/jpeg';
  const serverBase = getServerUrl();
  const token = await tokenStore.get();

  // 1. Direct upload to local Worklog backend
  try {
    const formData = new FormData();
    formData.append('file', {
      uri,
      name: cleanName,
      type: cleanType,
    } as any);

    const res = await fetch(`${serverBase}/chat/upload`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.data?.url) {
        const fileUrl = json.data.url;
        return fileUrl.startsWith('/') ? `${serverBase.replace(/\/api\/?$/, '')}${fileUrl}` : fileUrl;
      }
    }
  } catch (err) {
    console.warn('Backend upload failed on mobile:', err);
  }

  // 2. Fetch blob fallback
  try {
    const fileRes = await fetch(uri);
    const blob = await fileRes.blob();
    const res = await fetch(`${serverBase}/chat/upload`, {
      method: 'POST',
      headers: {
        'x-filename': encodeURIComponent(cleanName),
        'content-type': cleanType,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: blob,
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.data?.url) {
        const fileUrl = json.data.url;
        return fileUrl.startsWith('/') ? `${serverBase.replace(/\/api\/?$/, '')}${fileUrl}` : fileUrl;
      }
    }
  } catch (blobErr) {
    console.warn('Blob upload failed:', blobErr);
  }

  return uri;
}

export async function pickPhotoFromGallery(): Promise<AttachedFile | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Permission to access photo gallery is needed.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.7,
  });
  if (!result.canceled && result.assets && result.assets.length > 0) {
    const asset = result.assets[0];
    const name = asset.fileName || `photo_${Date.now()}.jpg`;
    const url = await uploadToCloud(asset.uri, name, asset.mimeType || 'image/jpeg');
    return {
      name,
      url,
      type: 'image',
      size: asset.fileSize ? `${(asset.fileSize / (1024 * 1024)).toFixed(1)} MB` : undefined,
    };
  }
  return null;
}

export async function takePhotoWithCamera(): Promise<AttachedFile | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Permission to use camera is needed.');
  }
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: false,
    quality: 0.7,
  });
  if (!result.canceled && result.assets && result.assets.length > 0) {
    const asset = result.assets[0];
    const name = asset.fileName || `camera_${Date.now()}.jpg`;
    const url = await uploadToCloud(asset.uri, name, asset.mimeType || 'image/jpeg');
    return {
      name,
      url,
      type: 'image',
      size: asset.fileSize ? `${(asset.fileSize / (1024 * 1024)).toFixed(1)} MB` : undefined,
    };
  }
  return null;
}

export async function pickDocumentFile(): Promise<AttachedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    type: '*/*',
  });
  if (!result.canceled && result.assets && result.assets.length > 0) {
    const asset = result.assets[0];
    const name = asset.name || `document_${Date.now()}`;
    const sizeStr = asset.size ? `${(asset.size / (1024 * 1024)).toFixed(1)} MB` : undefined;
    const url = await uploadToCloud(asset.uri, name, asset.mimeType);
    const isImage = (asset.mimeType && asset.mimeType.startsWith('image/')) ||
      /\.(jpe?g|png|gif|webp|bmp)$/i.test(name);
    return {
      name,
      url,
      type: isImage ? 'image' : 'file',
      size: sizeStr,
    };
  }
  return null;
}

const ATTACHMENT_SECTION_HEADER = '\n\n--- Attachments ---';

export function serializeAttachments(description: string, attachments: AttachedFile[]): string {
  const trimmed = description.trim();
  if (!attachments || attachments.length === 0) return trimmed;
  const lines = attachments.map(
    att => `📎 [${att.name}](${att.url})${att.size ? ` (${att.size})` : ''} <!--type:${att.type}-->`
  );
  return `${trimmed}${ATTACHMENT_SECTION_HEADER}\n${lines.join('\n')}`;
}

export function extractAttachments(text?: string | null): { cleanDescription: string; attachments: AttachedFile[] } {
  if (!text) return { cleanDescription: '', attachments: [] };
  const parts = text.split(ATTACHMENT_SECTION_HEADER);
  const cleanDescription = parts[0].trim();
  const attachments: AttachedFile[] = [];

  if (parts.length > 1) {
    const attachmentLines = parts.slice(1).join(ATTACHMENT_SECTION_HEADER).split('\n');
    const linkRegex = /📎\s*\[(.*?)\]\((.*?)\)(?:\s*\((.*?)\))?(?:\s*<!--type:(image|file)-->)?/;
    for (const line of attachmentLines) {
      const match = line.match(linkRegex);
      if (match) {
        const name = match[1];
        const url = match[2];
        const size = match[3] || undefined;
        let type: 'image' | 'file' = (match[4] as 'image' | 'file') || 'file';
        if (!match[4]) {
          type = /\.(jpe?g|png|gif|webp|bmp)(\?.*)?$/i.test(url) || /\.(jpe?g|png|gif|webp|bmp)$/i.test(name)
            ? 'image'
            : 'file';
        }
        attachments.push({ name, url, type, size });
      }
    }
  }

  return { cleanDescription, attachments };
}
