import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

export interface AttachedFile {
  name: string;
  url: string;
  type: 'image' | 'file';
  size?: string;
}

export async function uploadToCloud(uri: string, name: string, mimeType?: string): Promise<string> {
  const cleanName = name || `upload_${Date.now()}.jpg`;
  const cleanType = mimeType || 'image/jpeg';

  // 1. Fetch file as Blob & File (compliant with modern React Native / Expo fetch)
  try {
    const fileRes = await fetch(uri);
    const blob = await fileRes.blob();
    const fileObj = typeof File !== 'undefined'
      ? new File([blob], cleanName, { type: cleanType })
      : blob;

    const formData = new FormData();
    formData.append('file', fileObj as any);

    const res = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: formData,
    });
    const json = await res.json();
    if (json?.status === 'success' && json?.data?.url) {
      return json.data.url.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/');
    }
  } catch (e) {
    console.warn('Fetch blob upload error:', e);
  }

  // 2. XMLHttpRequest upload fallback
  try {
    const uploadWithXhr = (): Promise<string> => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://tmpfiles.org/api/v1/upload');
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const json = JSON.parse(xhr.responseText);
              if (json?.status === 'success' && json?.data?.url) {
                resolve(json.data.url.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/'));
                return;
              }
            } catch {}
          }
          reject(new Error(`XHR failed: ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error('XHR network error'));

        const data = new FormData();
        data.append('file', {
          uri,
          name: cleanName,
          type: cleanType,
        } as any);
        xhr.send(data);
      });
    };
    const xhrUrl = await uploadWithXhr();
    if (xhrUrl) return xhrUrl;
  } catch (xhrErr) {
    console.warn('XHR upload error:', xhrErr);
  }

  // 3. Catbox upload fallback
  try {
    const fileRes = await fetch(uri);
    const blob = await fileRes.blob();
    const fileObj = typeof File !== 'undefined'
      ? new File([blob], cleanName, { type: cleanType })
      : blob;

    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('fileToUpload', fileObj as any);

    const res = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: formData,
    });
    if (res.ok) {
      const text = (await res.text()).trim();
      if (text.startsWith('http')) return text;
    }
  } catch (cbErr) {
    console.warn('Catbox fallback error:', cbErr);
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
