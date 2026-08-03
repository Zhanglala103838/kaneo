import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import db from "../database";
import { userTable } from "../database/schema";
import {
  createUserAvatarUploadUrl,
  deleteS3Object,
  getPrivateObject,
  resolveUserAvatarKey,
  validateAvatarUploadInput,
} from "../storage/s3";
import { normalizeApiServerUrl } from "../utils/openapi-spec";

const httpErrorSchema = v.object({ message: v.string() });

const uploadUrlSchema = v.object({
  key: v.string(),
  uploadUrl: v.string(),
  headers: v.record(v.string(), v.string()),
});

const avatarSchema = v.object({ image: v.nullable(v.string()) });

/**
 * The avatar URL carries a version query so browsers refetch after a re-upload:
 * the object key is stable per user, so without it the old image stays cached.
 */
function buildAvatarUrl(baseUrl: string, userId: string) {
  return `${baseUrl}/user-avatar/${userId}?v=${Date.now()}`;
}

function storageError(error: unknown) {
  return new HTTPException(503, {
    message:
      error instanceof Error ? error.message : "Uploads are not configured",
  });
}

const userAvatar = new Hono<{ Variables: { userId: string } }>()
  .post(
    "/upload-url",
    describeRoute({
      operationId: "createUserAvatarUploadUrl",
      tags: ["User Avatar"],
      description: "Create a presigned upload URL for the caller's avatar",
      responses: {
        200: {
          description: "Presigned upload URL",
          content: {
            "application/json": { schema: resolver(uploadUrlSchema) },
          },
        },
        400: {
          description: "Validation error",
          content: {
            "application/json": { schema: resolver(httpErrorSchema) },
          },
        },
      },
    }),
    validator(
      "json",
      v.object({
        contentType: v.string(),
        size: v.number(),
      }),
    ),
    async (c) => {
      const userId = c.get("userId");
      const { contentType, size } = c.req.valid("json");

      try {
        validateAvatarUploadInput(contentType, size);
      } catch (error) {
        throw new HTTPException(400, {
          message:
            error instanceof Error ? error.message : "Invalid avatar upload",
        });
      }

      try {
        return c.json(await createUserAvatarUploadUrl(userId, contentType));
      } catch (error) {
        throw storageError(error);
      }
    },
  )
  .post(
    "/finalize",
    describeRoute({
      operationId: "finalizeUserAvatarUpload",
      tags: ["User Avatar"],
      description: "Point the caller's profile at the freshly uploaded avatar",
      responses: {
        200: {
          description: "Updated avatar URL",
          content: {
            "application/json": { schema: resolver(avatarSchema) },
          },
        },
      },
    }),
    validator("json", v.object({ key: v.string() })),
    async (c) => {
      const userId = c.get("userId");
      const { key } = c.req.valid("json");

      // The key is derived server-side from the session, so a client cannot
      // point its profile at another user's object by sending a forged key.
      let expectedKey: string;
      try {
        expectedKey = resolveUserAvatarKey(userId);
      } catch (error) {
        throw storageError(error);
      }

      if (key.trim() !== expectedKey) {
        throw new HTTPException(400, {
          message: "Avatar upload key does not match the current user.",
        });
      }

      const apiBaseUrl = normalizeApiServerUrl(
        process.env.KANEO_API_URL || new URL(c.req.url).origin,
      );
      const image = buildAvatarUrl(apiBaseUrl, userId);

      await db.update(userTable).set({ image }).where(eq(userTable.id, userId));

      return c.json({ image });
    },
  )
  .delete(
    "/",
    describeRoute({
      operationId: "deleteUserAvatar",
      tags: ["User Avatar"],
      description: "Remove the caller's avatar and fall back to initials",
      responses: {
        200: {
          description: "Avatar removed",
          content: {
            "application/json": { schema: resolver(avatarSchema) },
          },
        },
      },
    }),
    async (c) => {
      const userId = c.get("userId");

      try {
        await deleteS3Object(resolveUserAvatarKey(userId));
      } catch {
        // Already gone, or storage is unreachable — clearing the profile
        // reference is what actually makes the UI fall back to initials.
      }

      await db
        .update(userTable)
        .set({ image: null })
        .where(eq(userTable.id, userId));

      return c.json({ image: null });
    },
  )
  .get(
    "/:userId",
    describeRoute({
      operationId: "getUserAvatar",
      tags: ["User Avatar"],
      description: "Stream a user's avatar image",
      responses: {
        200: {
          description: "The avatar binary stream",
          content: {
            "image/*": { schema: { type: "string", format: "binary" } },
          },
        },
        404: {
          description: "No avatar set",
          content: {
            "application/json": { schema: resolver(httpErrorSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ userId: v.string() })),
    async (c) => {
      const { userId } = c.req.valid("param");

      const [user] = await db
        .select({ image: userTable.image })
        .from(userTable)
        .where(eq(userTable.id, userId))
        .limit(1);

      if (!user?.image) {
        throw new HTTPException(404, { message: "Avatar not found" });
      }

      let object: Awaited<ReturnType<typeof getPrivateObject>>;
      try {
        object = await getPrivateObject(resolveUserAvatarKey(userId));
      } catch {
        throw new HTTPException(404, { message: "Avatar not found" });
      }

      return new Response(object.body as BodyInit, {
        headers: {
          "Content-Type": object.contentType || "image/png",
          // Any signed-in teammate may see it, but it is never shared cache.
          "Cache-Control": "private, max-age=300",
          "Content-Security-Policy": "default-src 'none'; sandbox",
          "X-Content-Type-Options": "nosniff",
          ...(object.contentLength
            ? { "Content-Length": String(object.contentLength) }
            : {}),
        },
      });
    },
  );

export default userAvatar;
