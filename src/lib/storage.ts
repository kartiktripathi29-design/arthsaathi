import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "bank-statements";

export function hashBuffer(buf: Buffer | Uint8Array): string {
  return createHash("sha256").update(buf).digest("hex");
}

export async function uploadStatement(opts: {
  userId: string;
  statementId: string;
  filename: string;
  bytes: Buffer | Uint8Array;
  contentType?: string;
}): Promise<{ storagePath: string }> {
  const ext = opts.filename.split(".").pop() ?? "bin";
  const storagePath = `${opts.userId}/${opts.statementId}.${ext}`;
  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, opts.bytes, {
      contentType: opts.contentType ?? "application/octet-stream",
      upsert: false,
    });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return { storagePath };
}

export async function getStatementDownloadUrl(
  storagePath: string,
  expiresInSeconds = 300,
): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data) throw new Error(`Signed URL failed: ${error?.message}`);
  return data.signedUrl;
}
