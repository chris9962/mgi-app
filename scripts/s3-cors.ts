import { GetBucketCorsCommand, PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";

// Điện thoại của học sinh tải ảnh thẳng lên S3 bằng presigned PUT: bucket phải cho tên miền học sinh gọi PUT.
async function main() {
  const { S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, STUDENT_ORIGIN } = process.env;
  if (!S3_ENDPOINT || !S3_REGION || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) throw new Error("Thiếu biến S3_* trong .env.local.");
  if (S3_BUCKET === "mgst-images") throw new Error("mgst-images là bucket production của mgst-app, mgi-bank không được dùng.");
  if (!STUDENT_ORIGIN) throw new Error("Thiếu STUDENT_ORIGIN, ví dụ http://bank.localhost:3100.");
  const origins = STUDENT_ORIGIN.split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean);
  const s3 = new S3Client({ region: S3_REGION, endpoint: S3_ENDPOINT, forcePathStyle: true, credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY } });
  await s3.send(
    new PutBucketCorsCommand({
      Bucket: S3_BUCKET,
      CORSConfiguration: { CORSRules: [{ AllowedOrigins: origins, AllowedMethods: ["PUT", "GET"], AllowedHeaders: ["*"], ExposeHeaders: ["ETag"], MaxAgeSeconds: 3600 }] },
    }),
  );
  const { CORSRules } = await s3.send(new GetBucketCorsCommand({ Bucket: S3_BUCKET }));
  console.log(`Bucket ${S3_BUCKET} nhận PUT từ: ${CORSRules?.flatMap((r) => r.AllowedOrigins ?? []).join(", ")}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
