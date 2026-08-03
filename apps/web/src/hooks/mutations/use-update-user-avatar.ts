import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createAvatarUpload,
  deleteAvatar,
  finalizeAvatarUpload,
} from "@/fetchers/user/avatar";

export function useUploadUserAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const { uploadUrl, key, headers } = await createAvatarUpload({
        contentType: file.type,
        size: file.size,
      });

      const upload = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers,
      });

      if (!upload.ok) {
        throw new Error(`Upload failed (${upload.status})`);
      }

      return finalizeAvatarUpload(key);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["session"] }),
  });
}

export function useDeleteUserAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAvatar,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["session"] }),
  });
}
