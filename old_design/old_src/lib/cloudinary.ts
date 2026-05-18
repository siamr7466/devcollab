// @ts-ignore
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dtqpop5di';
// @ts-ignore
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'my_preset';

export const isCloudinaryConfigured = !!(CLOUD_NAME && UPLOAD_PRESET);

if (!isCloudinaryConfigured) {
  console.warn('Cloudinary credentials missing. Image uploads will not work.');
}

export async function uploadToCloudinary(file: File | Blob, type: 'image' | 'video' | 'raw' = 'image'): Promise<string> {
  if (!isCloudinaryConfigured) {
    throw new Error('Cloudinary config missing');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error('Upload failed');
  }

  const data = await response.json();
  return data.secure_url;
}
