import { CreateBucketCommand, HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";

// Tạo bucket private theo S3_BUCKET nếu chưa có. Chạy một lần cho mỗi môi trường.
async function main() {
  const { S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
  if (!S3_ENDPOINT || !S3_REGION || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) throw new Error("Thiếu biến S3_* trong .env.local.");
  if (S3_BUCKET === "mgst-images") throw new Error("mgst-images là bucket production của mgst-app, mgi-bank không được dùng.");
  const s3 = new S3Client({ region: S3_REGION, endpoint: S3_ENDPOINT, forcePathStyle: true, credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY } });
  try {
    await s3.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
    console.log(`Bucket ${S3_BUCKET} đã có.`);
    return;
  } catch (e) {
    if ((e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 404) throw e;
  }
  await s3.send(new CreateBucketCommand({ Bucket: S3_BUCKET }));
  await s3.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
  console.log(`Đã tạo bucket ${S3_BUCKET}.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
