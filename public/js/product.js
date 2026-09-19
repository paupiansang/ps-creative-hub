const $ = s => document.querySelector(s);

async function api(u, o = {}) {
  const r = await fetch(u, o);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(d.error || "Request failed");
  return d;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>'"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[c]));
}

function buildVisual(p) {
  const poster = p.thumbnail ? ` poster="${esc(p.thumbnail)}"` : "";

  // Uploaded preview video or Preview video URL
  if (p.preview) {
    return `
      <div class="detail-video-wrap" style="
        width:100%;
        border-radius:18px;
        overflow:hidden;
        background:#08091A;
        box-shadow:0 12px 35px rgba(0,0,0,.16);
      ">
        <video
          src="${esc(p.preview)}"
          ${poster}
          controls
          autoplay
          muted
          loop
          playsinline
          preload="metadata"
          style="
            display:block;
            width:100%;
            height:auto;
            max-height:560px;
            object-fit:contain;
            background:#08091A;
          "
        >
          Your browser does not support video playback.
        </video>
      </div>
    `;
  }

  // Thumbnail fallback when no preview video exists
  if (p.thumbnail) {
    return `
      <div class="detail-image-wrap" style="
        width:100%;
        border-radius:18px;
        overflow:hidden;
        background:#08091A;
        box-shadow:0 12px 35px rgba(0,0,0,.16);
      ">
        <img
          src="${esc(p.thumbnail)}"
          alt="${esc(p.title)}"
          style="
            display:block;
            width:100%;
            height:auto;
            max-height:560px;
            object-fit:contain;
          "
        >
      </div>
    `;
  }

  return `<div class="thumb-mark">PS</div>`;
}

async function run() {
  const slug = new URLSearchParams(location.search).get("slug");

  if (!slug) {
    throw Error("Product not specified.");
  }

  const { product: p } =
    await api("/api/products/" + encodeURIComponent(slug));

  const premium = p.type === "premium";

  const visual = buildVisual(p);

  const previewNote = p.preview
    ? `
      <p class="muted" style="margin-top:12px">
        Preview video available
      </p>
    `
    : "";

  $("#product").innerHTML = `
    <div class="detail-visual">
      ${visual}
      ${previewNote}
    </div>

    <div class="detail-copy">
      <div class="eyebrow">
        ${esc(p.category)} · ${esc(p.software || "ASSET")}
      </div>

      <h1>${esc(p.title)}</h1>

      <p>
        ${esc(p.description || "Creative asset by PS.")}
      </p>

      <div class="detail-meta">
        <span class="tag ${premium ? "premium" : ""}">
          ${premium ? "Premium" : "Free"}
        </span>

        <span class="pill">
          ${esc(p.version || "Latest")}
        </span>

        <span class="pill">
          ${Number(p.download_count || 0)} downloads
        </span>
      </div>

      <div class="detail-price">
        ${premium ? "Premium Membership" : "Free"}
      </div>

      <button id="action" class="primary-btn large">
        ${premium ? "Get Premium Access" : "Download free"}
      </button>

      <p class="muted" style="margin-top:18px">
        ${
          premium
            ? "Premium access is 30,000 MMK for 1 year (365 days)."
            : "No purchase required. The download starts immediately when a file is available."
        }
      </p>
    </div>
  `;

  $("#action").addEventListener("click", () => {
    if (premium) {
      location.href =
        "/premium.html?product=" +
        encodeURIComponent(p.slug);
    } else {
      download(p.id);
    }
  });
}

async function download(id) {
  const r = await fetch(
    "/api/products/" + id + "/download",
    { redirect: "manual" }
  );

  if (r.ok) {
    window.location.href =
      "/api/products/" + id + "/download";
    return;
  }

  const d = await r.json().catch(() => ({}));

  if (
    r.status === 403 &&
    d.error?.includes("Purchase")
  ) {
    return alert("Purchase required.");
  }

  return alert(
    d.error || "Download unavailable."
  );
}

async function buy(id) {
  try {
    const d = await api(
      "/api/checkout/" + id,
      { method: "POST" }
    );

    if (d.alreadyPurchased) {
      return location.href = "/library.html";
    }

    if (d.testCheckout) {
      return location.href = d.url;
    }

    location.href = d.url;

  } catch (e) {
    if (
      e.message.includes("Login required") ||
      e.message.includes("Session")
    ) {
      return location.href = "/?login=1";
    }

    alert(e.message);
  }
}

run().catch(e => {
  $("#product").innerHTML = `
    <div class="empty-state">
      <h3>${esc(e.message)}</h3>
      <a class="primary-btn" href="/">
        Back to Creative Hub
      </a>
    </div>
  `;
});