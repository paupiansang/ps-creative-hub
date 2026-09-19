const $ = s => document.querySelector(s);

let products = [];
let editingId = null;

async function api(u, o = {}) {
  const r = await fetch(u, o);
  const d = await r.json().catch(() => ({}));

  if (!r.ok) {
    throw Error(d.error || "Request failed");
  }

  return d;
}

const esc = s =>
  String(s ?? "").replace(/[&<>'"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[c]));

function fileStatus(p) {
  return p.file_path
    ? `<span class="status-ok">Download file ready</span>`
    : `<span class="status-warn">No download file</span>`;
}

function renderItems() {
  $("#productCount").textContent =
    products.filter(p => p.active).length;

  $("#adminProducts").innerHTML =
    products.map(p => `
      <div class="admin-item">
        <div class="admin-item-main">
          <strong>${esc(p.title)}</strong>

          <small>
            ${esc(p.type)}
            ·
            ${p.type === "free" ? "Free" : "Membership"}
            ·
            ${p.active ? "Live" : "Archived"}
          </small>

          <div class="admin-status">
            ${fileStatus(p)}

            ${
              p.thumbnail
                ? `<span class="status-ok">Thumbnail</span>`
                : ""
            }

            ${
              p.preview
                ? `<span class="status-ok">Preview</span>`
                : ""
            }
          </div>
        </div>

        <div class="admin-item-actions">
          ${
            p.active
              ? `
                <button
                  class="ghost-btn small"
                  onclick="editProduct(${p.id})"
                >
                  Edit
                </button>

                <button
                  class="danger-btn"
                  onclick="removeProduct(${p.id})"
                >
                  Archive
                </button>
              `
              : `
                <button
                  class="ghost-btn small"
                  onclick="restoreProduct(${p.id})"
                >
                  Restore
                </button>
              `
          }
        </div>
      </div>
    `).join("") ||
    '<p class="muted">No products yet.</p>';
}

function setMode(edit = false) {
  $("#formTitle").textContent =
    edit ? "Edit product" : "Add product";

  $("#formMode").textContent =
    edit ? "Editing" : "New";

  $("#editingHint").hidden = !edit;
  $("#cancelEdit").hidden = !edit;
  $("#editChecks").hidden = !edit;
  $("#existingFiles").hidden = !edit;

  $("#submitBtn").textContent =
    edit
      ? "Save changes ↗"
      : "Publish product ↗";

  $("#assetFileLabel").textContent =
    edit
      ? "Replace downloadable file (optional)"
      : "Choose downloadable file";
}

function resetForm() {
  editingId = null;

  $("#productForm").reset();

  setMode(false);

  $("#adminMsg").textContent = "";
  $("#existingFiles").innerHTML = "";
}

function fillForm(p) {
  editingId = p.id;

  setMode(true);

  const f = $("#productForm");

  [
    "title",
    "slug",
    "software",
    "version",
    "thumbnail",
    "preview",
    "description"
  ].forEach(k => {
    if (f.elements[k]) {
      f.elements[k].value = p[k] || "";
    }
  });

  f.elements.category.value =
    p.category || "After Effects";

  f.elements.type.value =
    p.type || "free";

  // No individual product pricing.
  // Premium is membership-only.
  if (f.elements.price) {
    f.elements.price.value = 0;
  }

  $("#existingFiles").hidden = false;

  $("#existingFiles").innerHTML = `
    <strong>Current files</strong>

    <div>
      Download:
      ${p.file_name ? esc(p.file_name) : "Not uploaded"}
    </div>

    <div>
      Thumbnail:
      ${p.thumbnail ? esc(p.thumbnail) : "Not uploaded"}
    </div>

    <div>
      Preview video:
      ${p.preview ? esc(p.preview) : "Not uploaded"}
    </div>
  `;

  $("#adminMsg").textContent = "";

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

window.editProduct = id => {
  const p = products.find(x => x.id === id);

  if (p) {
    fillForm(p);
  }
};

window.removeProduct = async id => {
  if (!confirm("Archive this product?")) {
    return;
  }

  try {
    await api(
      "/api/admin/products/" + id,
      { method: "DELETE" }
    );

    await load();
  } catch (err) {
    $("#adminMsg").textContent = err.message;
  }
};

window.restoreProduct = async id => {
  try {
    await api(
      "/api/admin/products/" + id + "/restore",
      { method: "POST" }
    );

    await load();
  } catch (err) {
    $("#adminMsg").textContent = err.message;
  }
};

async function loadPayments() {
  const d = await api("/api/admin/payments");

  const pending =
    d.payments.filter(
      x => x.status === "pending"
    );

  $("#pendingPaymentCount").textContent =
    `${pending.length} pending`;

  $("#adminPayments").innerHTML =
    d.payments.map(p => {
      const amount =
        (Number(p.amount_cents || 0) / 100)
          .toLocaleString();

      return `
        <article class="payment-request ${esc(p.status)}">

          <div class="payment-main">

            <div class="payment-top">
              <strong>
                ${esc(p.name || "User")}
              </strong>

              <span
                class="payment-status ${esc(p.status)}"
              >
                ${esc(p.status)}
              </span>
            </div>

            <small>
              ${esc(p.email)}
              ·
              ${p.plan_months === 12
                ? "1 year"
                : p.plan_months + " months"}
              ·
              <b>${amount} MMK</b>
            </small>

            <div class="payment-tx">
              Transaction ID:
              <strong>
                ${esc(p.transaction_id)}
              </strong>
            </div>

            <a
              class="proof-link"
              href="${esc(p.screenshot_url)}"
              target="_blank"
              rel="noopener"
            >
              View payment screenshot ↗
            </a>

          </div>

          ${
            p.status === "pending"
              ? `
                <div class="payment-actions">

                  <button
                    class="primary-btn small"
                    onclick="approvePayment(${p.id})"
                  >
                    Approve
                  </button>

                  <button
                    class="danger-btn"
                    onclick="rejectPayment(${p.id})"
                  >
                    Reject
                  </button>

                </div>
              `
              : ""
          }

        </article>
      `;
    }).join("") ||
    '<p class="muted">No payment requests yet.</p>';
}

window.approvePayment = async id => {
  if (
    !confirm(
      "Approve this payment and activate Premium access?"
    )
  ) {
    return;
  }

  try {
    await api(
      "/api/admin/payments/" + id + "/approve",
      { method: "POST" }
    );

    await loadPayments();
    await load();
  } catch (e) {
    alert(e.message);
  }
};

window.rejectPayment = async id => {
  const note =
    prompt("Optional reason for rejection:") ?? "";

  try {
    await api(
      "/api/admin/payments/" + id + "/reject",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ note })
      }
    );

    await loadPayments();
    await load();
  } catch (e) {
    alert(e.message);
  }
};

async function load() {
  const s =
    await api("/api/admin/stats");

  $("#stats").innerHTML = [
    ["Users", s.users],
    ["Products", s.products],
    ["Purchases", s.purchases],
    ["Downloads", s.downloads]
  ]
    .map(
      x => `
        <div class="stat">
          <span>${x[0]}</span>
          <b>${x[1]}</b>
        </div>
      `
    )
    .join("");

  await loadPayments();

  const d =
    await api("/api/admin/products");

  products = d.products;

  renderItems();
}

$("#cancelEdit").addEventListener(
  "click",
  resetForm
);

$("#productForm").addEventListener(
  "submit",
  async e => {
    e.preventDefault();

    const msg = $("#adminMsg");

    msg.textContent =
      editingId
        ? "Saving changes…"
        : "Publishing…";

    try {
      const fd = new FormData(e.target);

      // Membership-only:
      // never send an individual product price.
      fd.set("price", "0");

      const url = editingId
        ? "/api/admin/products/" + editingId
        : "/api/admin/products";

      const method =
        editingId ? "PATCH" : "POST";

      await api(url, {
        method,
        body: fd
      });

      msg.textContent =
        editingId
          ? "Saved successfully."
          : "Published successfully.";

      await load();

      resetForm();

    } catch (err) {
      msg.textContent = err.message;
    }
  }
);

load().catch(e => {
  $(".admin-page").innerHTML = `
    <div class="empty-state">
      <h3>Admin login required</h3>

      <p class="muted">
        ${esc(e.message)}
      </p>

      <a
        class="primary-btn"
        href="/?login=1"
      >
        Login to Creative Hub
      </a>
    </div>
  `;
});