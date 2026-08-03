import { client } from "@kaneo/libs";

/**
 * Three steps, mirroring the task image flow: ask the API to sign an upload,
 * PUT the bytes straight to object storage, then tell the API to point the
 * profile at it. The browser never sends the file through the API.
 */
export async function createAvatarUpload({
  contentType,
  size,
}: {
  contentType: string;
  size: number;
}) {
  const response = await client["user-avatar"]["upload-url"].$post({
    json: { contentType, size },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export async function finalizeAvatarUpload(key: string) {
  const response = await client["user-avatar"].finalize.$post({
    json: { key },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export async function deleteAvatar() {
  const response = await client["user-avatar"].$delete();

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}
