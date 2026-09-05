const VAPID_KEY = "vapid";

function b64url(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function concatBytes(...arrays) {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

async function getVapidKeys(env) {
  let data = await env.PHILOS_PUSH.get(VAPID_KEY, "json");
  if (data && data.publicKey && data.privateKeyJwk) return data;
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  const privJwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
  data = { publicKey: b64url(pubRaw), privateKeyJwk: privJwk };
  await env.PHILOS_PUSH.put(VAPID_KEY, JSON.stringify(data));
  return data;
}

async function importPrivKey(jwk) {
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function makeJwt(privKey, audience, publicKey) {
  const enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(enc.encode(JSON.stringify({ aud: audience, exp: now + 12 * 3600, sub: "mailto:philos@example.com" })));
  const data = enc.encode(header + "." + payload);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privKey, data));
  return header + "." + payload + "." + b64url(sig);
}

async function sendToSubscription(subscription, message, vapid, privKey) {
  const endpoint = subscription.endpoint;
  const audience = new URL(endpoint).origin;
  const jwt = await makeJwt(privKey, audience, vapid.publicKey);
  const subP256dh = b64urlToBytes(subscription.keys.p256dh);
  const subAuth = b64urlToBytes(subscription.keys.auth);
  const localKp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const localPub = new Uint8Array(await crypto.subtle.exportKey("raw", localKp.publicKey));
  const remotePub = await crypto.subtle.importKey("raw", subP256dh, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const sharedSecret = await crypto.subtle.deriveBits({ name: "ECDH", public: remotePub }, localKp.privateKey, 256);
  const ikm = await crypto.subtle.importKey("raw", sharedSecret, { name: "HKDF" }, false, ["deriveKey", "deriveBits"]);
  const infoPrefix = new TextEncoder().encode("WebPush: info");
  const keyInfo = concatBytes(infoPrefix, new Uint8Array([0]), subP256dh, localPub);
  const nonceInfo = concatBytes(infoPrefix, new Uint8Array([1]), subP256dh, localPub);
  const cek = await crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: subAuth, info: keyInfo }, ikm, { name: "AES-GCM", length: 128 }, false, ["encrypt"]);
  const nonce = new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: subAuth, info: nonceInfo }, ikm, 96));
  const plaintextBytes = new TextEncoder().encode(message);
  const padded = new Uint8Array(plaintextBytes.length + 1);
  padded.set(plaintextBytes, 0);
  padded[padded.length - 1] = 0x02;
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, cek, padded));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const rs = new Uint8Array([0, 0, 0x10, 0]);
  const idlen = new Uint8Array([65]);
  const body = concatBytes(salt, rs, idlen, localPub, ciphertext);
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "86400",
      "Authorization": "vapid t=" + jwt + ", k=" + vapid.publicKey,
    },
    body: body,
  });
  return resp.status;
}

function sanitizeDeviceId(id) {
  return String(id || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
}

function clampNum(v, min, max, def) {
  const n = Number(v);
  if (!isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function randDelay(minMinutes, maxMinutes) {
  const min = Math.max(1, minMinutes);
  const max = Math.max(min, maxMinutes);
  return (min + Math.random() * (max - min)) * 60000;
}

function jsonResponse(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { "Content-Type": "application/json", ...cors } });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

async function handleScheduled(env) {
  const now = Date.now();
  const list = await env.PHILOS_PUSH.list({ prefix: "profile:" });
  const vapid = await getVapidKeys(env);
  const privKey = await importPrivKey(vapid.privateKeyJwk);
  for (const item of list.keys) {
    const deviceId = item.name.slice("profile:".length);
    let profile = await env.PHILOS_PUSH.get(item.name, "json");
    if (!profile || !profile.enabled) continue;
    if (!profile.nextPushAt || now < profile.nextPushAt) continue;

    const cards = Array.isArray(profile.cards) ? profile.cards.map(s => String(s).trim()).filter(Boolean) : [];
    const minMinutes = clampNum(profile.minMinutes, 1, 1440, 5);
    const maxMinutes = clampNum(profile.maxMinutes, 1, 1440, 120);

    if (cards.length === 0) {
      profile.nextPushAt = now + randDelay(minMinutes, maxMinutes);
      await env.PHILOS_PUSH.put(item.name, JSON.stringify(profile));
      continue;
    }

    const sub = await env.PHILOS_PUSH.get("sub:" + deviceId, "json");
    if (!sub) {
      profile.enabled = false;
      profile.nextPushAt = now + randDelay(minMinutes, maxMinutes);
      await env.PHILOS_PUSH.put(item.name, JSON.stringify(profile));
      continue;
    }

    const card = cards[Math.floor(Math.random() * cards.length)];
    const cloudId = "m_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
    const payload = JSON.stringify({ id: cloudId, text: card });

    try {
      const status = await sendToSubscription(sub, payload, vapid, privKey);
      if (status === 404 || status === 410) {
        await env.PHILOS_PUSH.delete("sub:" + deviceId);
        profile.enabled = false;
      }
    } catch (e) {}

    const t = new Date().toISOString();
    await env.PHILOS_PUSH.put("msg:" + deviceId + ":" + cloudId, JSON.stringify({ id: cloudId, text: card, time: t }));

    profile.nextPushAt = now + randDelay(minMinutes, maxMinutes);
    await env.PHILOS_PUSH.put(item.name, JSON.stringify(profile));
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    if (request.method === "GET" && url.pathname === "/vapid-public-key") {
      const vapid = await getVapidKeys(env);
      return jsonResponse({ publicKey: vapid.publicKey }, 200, corsHeaders);
    }

    if (request.method === "POST" && url.pathname === "/subscribe") {
      let body;
      try { body = await request.json(); } catch (e) { body = {}; }
      const deviceId = sanitizeDeviceId(body.deviceId);
      const subscription = body.subscription;
      if (!deviceId || !subscription || !subscription.endpoint) {
        return jsonResponse({ error: "bad request" }, 400, corsHeaders);
      }
      await env.PHILOS_PUSH.put("sub:" + deviceId, JSON.stringify(subscription));

      const cards = Array.isArray(body.cards) ? body.cards.map(s => String(s).trim()).filter(Boolean).slice(0, 500) : [];
      const minMinutes = clampNum(body.minMinutes, 1, 1440, 5);
      const maxMinutes = clampNum(body.maxMinutes, 1, 1440, 120);
      let profile = await env.PHILOS_PUSH.get("profile:" + deviceId, "json");
      if (!profile) profile = { nextPushAt: 0 };
      profile.cards = cards;
      profile.minMinutes = minMinutes;
      profile.maxMinutes = maxMinutes;
      profile.enabled = !!body.enabled;
      if (profile.enabled && !profile.nextPushAt) {
        profile.nextPushAt = Date.now() + randDelay(minMinutes, maxMinutes);
      }
      await env.PHILOS_PUSH.put("profile:" + deviceId, JSON.stringify(profile));
      return jsonResponse({ ok: true }, 200, corsHeaders);
    }

    if (request.method === "POST" && url.pathname === "/profile") {
      let body;
      try { body = await request.json(); } catch (e) { body = {}; }
      const deviceId = sanitizeDeviceId(body.deviceId);
      if (!deviceId) return jsonResponse({ error: "bad request" }, 400, corsHeaders);
      let profile = await env.PHILOS_PUSH.get("profile:" + deviceId, "json");
      if (!profile) profile = { nextPushAt: 0 };
      if (Array.isArray(body.cards)) {
        profile.cards = body.cards.map(s => String(s).trim()).filter(Boolean).slice(0, 500);
      }
      if (body.minMinutes != null) profile.minMinutes = clampNum(body.minMinutes, 1, 1440, 5);
      if (body.maxMinutes != null) profile.maxMinutes = clampNum(body.maxMinutes, 1, 1440, 120);
      if (body.enabled != null) profile.enabled = !!body.enabled;
      if (profile.enabled && !profile.nextPushAt) {
        profile.nextPushAt = Date.now() + randDelay(profile.minMinutes || 5, profile.maxMinutes || 120);
      }
      await env.PHILOS_PUSH.put("profile:" + deviceId, JSON.stringify(profile));
      return jsonResponse({ ok: true }, 200, corsHeaders);
    }

    if (request.method === "POST" && url.pathname === "/notify") {
      let message = "他给你发消息了";
      try { const b = await request.json(); if (b.message) message = String(b.message); } catch (e) {}
      const vapid = await getVapidKeys(env);
      const privKey = await importPrivKey(vapid.privateKeyJwk);
      const list = await env.PHILOS_PUSH.list({ prefix: "sub:" });
      let sent = 0, failed = 0;
      for (const item of list.keys) {
        const sub = await env.PHILOS_PUSH.get(item.name, "json");
        if (!sub) continue;
        try {
          const status = await sendToSubscription(sub, message, vapid, privKey);
          if (status >= 200 && status < 300) sent++;
          else if (status === 404 || status === 410) { await env.PHILOS_PUSH.delete(item.name); failed++; }
          else failed++;
        } catch (e) { failed++; }
      }
      return jsonResponse({ sent, failed }, 200, corsHeaders);
    }

    if (request.method === "GET" && url.pathname === "/messages") {
      const deviceId = sanitizeDeviceId(url.searchParams.get("deviceId") || "");
      if (!deviceId) return jsonResponse({ messages: [] }, 200, corsHeaders);
      const list = await env.PHILOS_PUSH.list({ prefix: "msg:" + deviceId + ":" });
      const messages = [];
      for (const item of list.keys) {
        const m = await env.PHILOS_PUSH.get(item.name, "json");
        if (m) messages.push(m);
        await env.PHILOS_PUSH.delete(item.name);
      }
      messages.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
      return jsonResponse({ messages }, 200, corsHeaders);
    }

    return new Response("Philos push service", { headers: corsHeaders });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(env));
  },
};
