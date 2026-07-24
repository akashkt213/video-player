import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createWriteStream } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
});

function bucket() {
  const name = process.env.S3_BUCKET;
  if (!name) throw new Error("S3_BUCKET is not set");
  return name;
}

export async function createUploadUrl(key: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn: 900 });
}

export async function createDownloadUrl(key: string) {
  const command = new GetObjectCommand({
    Bucket: bucket(),
    Key: key,
  });
  return getSignedUrl(s3, command, { expiresIn: 900 });
}

export async function downloadObjectToFile(key: string, destPath: string) {
  const result = await s3.send(
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
    }),
  );

  if (!result.Body) {
    throw new Error(`S3 object has no body: ${key}`);
  }

  await pipeline(result.Body as Readable, createWriteStream(destPath));
}

function contentTypeFor(fileName: string) {
  if (fileName.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (fileName.endsWith(".ts")) return "video/mp2t";
  return "application/octet-stream";
}

export async function uploadDirectory(localDir: string, s3Prefix: string) {
  const files = await readdir(localDir);

  await Promise.all(
    files.map(async (fileName) => {
      const body = await readFile(path.join(localDir, fileName));
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket(),
          Key: `${s3Prefix}/${fileName}`,
          Body: body,
          ContentType: contentTypeFor(fileName),
        }),
      );
    }),
  );
}

export function publicObjectUrl(key: string) {
  const region = process.env.AWS_REGION ?? "us-east-1";
  return `https://${bucket()}.s3.${region}.amazonaws.com/${key}`;
}

export function hlsFileContentType(fileName: string) {
  return contentTypeFor(fileName);
}

export function masterKeyForVideo(videoId: string) {
  return `hls/${videoId}/master.m3u8`;
}

export function apiPlaybackUrl(videoId: string, baseUrl: string) {
  return `${baseUrl.replace(/\/$/, "")}/api/videos/${videoId}/hls/master.m3u8`;
}

export async function getHlsObject(videoId: string, fileName: string) {
  // Prevent path traversal
  if (
    !fileName ||
    fileName.includes("..") ||
    fileName.includes("/") ||
    fileName.includes("\\")
  ) {
    throw new Error("Invalid HLS file name");
  }

  const key = `hls/${videoId}/${fileName}`;
  const result = await s3.send(
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
    }),
  );

  if (!result.Body) {
    throw new Error(`S3 object has no body: ${key}`);
  }

  return {
    key,
    body: result.Body as Readable,
    contentType: result.ContentType ?? contentTypeFor(fileName),
    contentLength: result.ContentLength,
  };
}

export async function objectExists(key: string) {
  try {
    await s3.send(
      new HeadObjectCommand({
        Bucket: bucket(),
        Key: key,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export async function getPlaybackForVideo(videoId: string, baseUrl: string) {
  const masterKey = masterKeyForVideo(videoId);
  const exists = await objectExists(masterKey);
  if (!exists) {
    return null;
  }

  return {
    id: videoId,
    masterKey,
    playbackUrl: apiPlaybackUrl(videoId, baseUrl),
  };
}

export async function listProcessedVideos(baseUrl: string) {
  const result = await s3.send(
    new ListObjectsV2Command({
      Bucket: bucket(),
      Prefix: "hls/",
      Delimiter: "/",
    }),
  );

  const prefixes = result.CommonPrefixes ?? [];
  const videos = [];

  for (const prefix of prefixes) {
    const folder = prefix.Prefix; // e.g. hls/{id}/
    if (!folder) continue;
    const id = folder.replace(/^hls\//, "").replace(/\/$/, "");
    if (!id) continue;

    const playback = await getPlaybackForVideo(id, baseUrl);
    if (playback) videos.push(playback);
  }

  return videos;
}
