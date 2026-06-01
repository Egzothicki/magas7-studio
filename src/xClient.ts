import crypto from "node:crypto";
import fs from "node:fs/promises";

interface XCreds {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

export function readMagas7XCreds(): XCreds | null {
  const consumerKey = process.env.MAGAS7_X_CONSUMER_KEY ?? "";
  const consumerSecret = process.env.MAGAS7_X_CONSUMER_SECRET ?? "";
  const accessToken = process.env.MAGAS7_X_ACCESS_TOKEN ?? "";
  const accessTokenSecret = process.env.MAGAS7_X_ACCESS_TOKEN_SECRET ?? "";
  if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) return null;
  return { consumerKey, consumerSecret, accessToken, accessTokenSecret };
}

function oauthHeader(method: string, url: string, params: Record<string, string>, creds: XCreds): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
  };
  const all = { ...params, ...oauth };
  const paramStr = Object.entries(all)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  const base = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramStr)}`;
  const key = `${encodeURIComponent(creds.consumerSecret)}&${encodeURIComponent(creds.accessTokenSecret)}`;
  const sig = crypto.createHmac("sha1", key).update(base).digest("base64");
  return Object.entries({ ...oauth, oauth_signature: sig })
    .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
    .join(", ");
}

/**
 * Upload a video to X using the chunked v1.1 media upload endpoint.
 * Returns the media_id string for use in v2 /tweets.
 */
async function uploadVideoChunked(filePath: string, creds: XCreds, log: (msg: string) => void): Promise<string> {
  const buf = await fs.readFile(filePath);
  const totalBytes = buf.byteLength;

  // INIT
  const initUrl = "https://upload.twitter.com/1.1/media/upload.json";
  const initParams = {
    command: "INIT",
    total_bytes: String(totalBytes),
    media_type: "video/mp4",
    media_category: "tweet_video",
  };
  const initAuth = oauthHeader("POST", initUrl, initParams, creds);
  const initResp = await fetch(initUrl, {
    method: "POST",
    headers: { Authorization: `OAuth ${initAuth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(initParams),
    signal: AbortSignal.timeout(30_000),
  });
  if (!initResp.ok) throw new Error(`X INIT ${initResp.status}: ${(await initResp.text()).slice(0, 200)}`);
  const initJson = (await initResp.json()) as { media_id_string: string };
  const mediaId = initJson.media_id_string;
  log(`x: INIT media_id=${mediaId} bytes=${totalBytes}`);

  // APPEND in 4MB chunks
  const chunkSize = 4 * 1024 * 1024;
  let segmentIndex = 0;
  for (let offset = 0; offset < totalBytes; offset += chunkSize) {
    const chunk = buf.subarray(offset, Math.min(offset + chunkSize, totalBytes));
    // OAuth 1.0a: multipart/form-data body params must NOT be signed — pass empty params.
    const appendAuth = oauthHeader("POST", initUrl, {}, creds);

    const form = new FormData();
    form.append("command", "APPEND");
    form.append("media_id", mediaId);
    form.append("segment_index", String(segmentIndex));
    form.append("media", new Blob([chunk], { type: "application/octet-stream" }));

    const appendResp = await fetch(initUrl, {
      method: "POST",
      headers: { Authorization: `OAuth ${appendAuth}` },
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
    if (!appendResp.ok) throw new Error(`X APPEND seg=${segmentIndex} ${appendResp.status}: ${(await appendResp.text()).slice(0, 200)}`);
    segmentIndex += 1;
  }
  log(`x: APPEND complete, ${segmentIndex} segment(s)`);

  // FINALIZE
  const finalizeParams = { command: "FINALIZE", media_id: mediaId };
  const finalizeAuth = oauthHeader("POST", initUrl, finalizeParams, creds);
  const finalizeResp = await fetch(initUrl, {
    method: "POST",
    headers: { Authorization: `OAuth ${finalizeAuth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(finalizeParams),
    signal: AbortSignal.timeout(30_000),
  });
  if (!finalizeResp.ok) throw new Error(`X FINALIZE ${finalizeResp.status}: ${(await finalizeResp.text()).slice(0, 200)}`);
  const finalizeJson = (await finalizeResp.json()) as { processing_info?: { state: string; check_after_secs?: number } };

  // STATUS poll if needed
  let info = finalizeJson.processing_info;
  while (info && (info.state === "pending" || info.state === "in_progress")) {
    const wait = Math.min(8, info.check_after_secs ?? 3);
    await new Promise((r) => setTimeout(r, wait * 1000));
    const statusParams = { command: "STATUS", media_id: mediaId };
    const statusUrl = `${initUrl}?command=STATUS&media_id=${mediaId}`;
    const statusAuth = oauthHeader("GET", initUrl, statusParams, creds);
    const sResp = await fetch(statusUrl, { headers: { Authorization: `OAuth ${statusAuth}` } });
    if (!sResp.ok) throw new Error(`X STATUS ${sResp.status}`);
    const sJson = (await sResp.json()) as { processing_info?: { state: string; check_after_secs?: number } };
    info = sJson.processing_info;
    log(`x: STATUS ${info?.state ?? "ready"}`);
  }
  if (info && info.state === "failed") throw new Error(`X media processing failed`);

  return mediaId;
}

async function postTweet(text: string, mediaId: string, creds: XCreds): Promise<string> {
  const url = "https://api.twitter.com/2/tweets";
  const body = { text: text.slice(0, 280), media: { media_ids: [mediaId] } };
  const auth = oauthHeader("POST", url, {}, creds);
  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: `OAuth ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!resp.ok) throw new Error(`Tweet ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const json = (await resp.json()) as { data?: { id?: string } };
  return String(json?.data?.id ?? "");
}

export async function maybePostToX(opts: { mp4Path: string; caption: string; log: (msg: string) => void }): Promise<string | null> {
  const creds = readMagas7XCreds();
  if (!creds) {
    opts.log("x: MAGAS7_X_* creds not set — skipping auto-post (share-to-X buttons still work on /studio)");
    return null;
  }
  try {
    const mediaId = await uploadVideoChunked(opts.mp4Path, creds, opts.log);
    const tweetId = await postTweet(opts.caption, mediaId, creds);
    opts.log(`x: posted tweet=${tweetId}`);
    return tweetId;
  } catch (e) {
    opts.log(`x: post failed — ${String(e).slice(0, 300)}`);
    return null;
  }
}
