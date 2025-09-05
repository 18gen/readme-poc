import "server-only";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";

const region = process.env.AWS_REGION!;
export const s3 = new S3Client({
  region,
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID!, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! }
    : undefined
});

export async function putText(bucket: string, key: string, text: string, contentType="text/plain") {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: Buffer.from(text), ContentType: contentType }));
  return `s3://${bucket}/${key}`;
}

export async function putFile(bucket: string, key: string, body: Buffer, contentType?: string) {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
  return `s3://${bucket}/${key}`;
}

async function streamToString(stream: any): Promise<string> {
  if (typeof stream?.text === "function") return stream.text(); // node-fetch Body case
  const chunks: Buffer[] = [];
  for await (const chunk of stream as Readable) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

export async function getJSON<T=any>(bucket: string, key: string): Promise<T | null> {
  try {
    const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const txt = await streamToString(out.Body as any);
    return JSON.parse(txt);
  } catch {
    return null;
  }
}
