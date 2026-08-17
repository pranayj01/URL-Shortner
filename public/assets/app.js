const PAGE_SIZE = 10;

const form = document.getElementById("shorten-form");
const formError = document.getElementById("form-error");
const result = document.getElementById("result");
const shortUrlEl = document.getElementById("short-url");
const copyBtn = document.getElementById("copy-btn");
const submitBtn = document.getElementById("submit-btn");
const qrImg = document.getElementById("qr-img");
const anonTip = document.getElementById("anon-tip");
const shortenHint = document.getElementById("shorten-hint");

const statsError = document.getElementById("stats-error");
const statsResult = document.getElementById("stats-result");
const statsDetail = document.getElementById("stats-detail");
const chartsEl = document.getElementById("charts");
const insightsPanel = document.getElementById("insights-panel");
const orgError = document.getElementById("org-error");

const authForm = document.getElementById("auth-form");
const authDialog = document.getElementById("auth-dialog");
const authError = document.getElementById("auth-error");
const authStatus = document.getElementById("auth-status");
const loginBtn = document.getElementById("login-btn");
const registerBtn = document.getElementById("register-btn");
const authCancel = document.getElementById("auth-cancel");
const refreshMineBtn = document.getElementById("refresh-mine");
const mineBody = document.getElementById("mine-body");
const mineEmpty = document.getElementById("mine-empty");
const mineSearch = document.getElementById("mine-search");
const mineSort = document.getElementById("mine-sort");
const mineFolder = document.getElementById("mine-folder");
const mineTag = document.getElementById("mine-tag");
const minePager = document.getElementById("mine-pager");
const minePrev = document.getElementById("mine-prev");
const mineNext = document.getElementById("mine-next");
const minePageLabel = document.getElementById("mine-page-label");
const editDialog = document.getElementById("edit-dialog");
const editForm = document.getElementById("edit-form");
const editError = document.getElementById("edit-error");
const webhookForm = document.getElementById("webhook-form");
const webhookList = document.getElementById("webhook-list");
const webhookError = document.getElementById("webhook-error");

let currentUser = null;
let minePage = 1;
let mineTotal = 0;
let selectedCode = null;
let searchTimer = 0;
let foldersCache = [];
let tagsCache = [];

function showError(el, message) {
  el.hidden = !message;
  el.textContent = message || "";
}

function errorMessage(data, fallback = "Request failed") {
  if (!data || typeof data !== "object") return fallback;
  return data.message || data.error?.message || data.error || fallback;
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(path, {
    credentials: "include",
    ...options,
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(errorMessage(data));
    err.status = res.status;
    throw err;
  }
  return data;
}

async function authRequest(path, body) {
  return api(path, { method: "POST", body: JSON.stringify(body) });
}

function statusLabel(item) {
  if (item.disabled) return "Disabled";
  if (item.hasPassword) return "Locked";
  if (item.expiresAt && new Date(item.expiresAt) < new Date()) return "Expired";
  return "Active";
}

function setOwnerOnlyVisible(visible) {
  document.querySelectorAll(".owner-only").forEach((el) => {
    el.hidden = !visible;
  });
  if (!visible) {
    document.getElementById("linkPassword").value = "";
    document.getElementById("linkDisabled").checked = false;
  }
}

function fillSelect(select, items, { allLabel, valueKey = "id", labelKey = "name", allValue = "" } = {}) {
  const current = select.value;
  select.innerHTML = "";
  if (allLabel) {
    const opt = document.createElement("option");
    opt.value = allValue;
    opt.textContent = allLabel;
    select.appendChild(opt);
  }
  for (const item of items) {
    const opt = document.createElement("option");
    opt.value = item[valueKey];
    opt.textContent = item[labelKey];
    select.appendChild(opt);
  }
  if ([...select.options].some((o) => o.value === current)) {
    select.value = current;
  }
}

async function loadOrgMeta() {
  if (!currentUser) return;
  const [foldersRes, tagsRes] = await Promise.all([
    api("/api/folders"),
    api("/api/tags"),
  ]);
  foldersCache = foldersRes.folders || [];
  tagsCache = tagsRes.tags || [];
  fillSelect(document.getElementById("linkFolder"), foldersCache, {
    allLabel: "No folder",
    allValue: "",
  });
  fillSelect(mineFolder, foldersCache, { allLabel: "All folders", allValue: "" });
  fillSelect(mineTag, tagsCache, {
    allLabel: "All tags",
    allValue: "",
    valueKey: "name",
  });
  fillSelect(document.getElementById("edit-folder"), foldersCache, {
    allLabel: "No folder",
    allValue: "",
  });
}

async function loadWebhooks() {
  if (!currentUser) return;
  const data = await api("/api/webhooks");
  webhookList.innerHTML = "";
  for (const hook of data.webhooks || []) {
    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <strong>${hook.url}</strong>
        <div class="hint">${(hook.events || []).join(", ")} · ${hook.enabled ? "on" : "off"}</div>
      </div>
      <button type="button" class="ghost danger" data-id="${hook.id}">Delete</button>
    `;
    li.querySelector("button").addEventListener("click", async () => {
      await api(`/api/webhooks/${hook.id}`, { method: "DELETE" });
      await loadWebhooks();
    });
    webhookList.appendChild(li);
  }
}

function clearLocalAuthState() {
  currentUser = null;
  mineBody.innerHTML = "";
  mineEmpty.hidden = false;
  minePager.hidden = true;
  statsDetail.hidden = true;
  insightsPanel.hidden = true;
  webhookList.innerHTML = "";
  showError(statsError, "");
  setOwnerOnlyVisible(false);
  if (shortenHint) {
    shortenHint.textContent = "Paste a long URL. Log in to save links and see analytics.";
  }
}

function openAuthDialog() {
  showError(authError, "");
  authDialog.showModal();
  document.getElementById("authEmail").focus();
}

function renderAuthStatus() {
  if (currentUser) {
    authStatus.innerHTML = `
      <span class="auth-email">${currentUser.email}</span>
      <button type="button" id="logout-btn" class="ghost">Log out</button>
    `;
    insightsPanel.hidden = false;
    setOwnerOnlyVisible(true);
    if (shortenHint) {
        shortenHint.textContent = "Logged-in links are saved to Your links."
    }
    document.getElementById("logout-btn").addEventListener("click", async () => {
      try {
        await authRequest("/api/auth/sign-out", {});
      } catch {
        // ignore
      }
      clearLocalAuthState();
      renderAuthStatus();
    });
  } else {
    authStatus.innerHTML = `<button type="button" id="open-login-btn" class="ghost">Log in</button>`;
    insightsPanel.hidden = true;
    setOwnerOnlyVisible(false);
    document.getElementById("open-login-btn").addEventListener("click", openAuthDialog);
  }
}

async function refreshSession() {
  try {
    const data = await api("/api/auth/get-session");
    currentUser = data?.user || null;
  } catch {
    currentUser = null;
  }
  renderAuthStatus();
  if (currentUser) {
    await loadOrgMeta();
    await loadMyLinks();
    await loadWebhooks();
  }
}

async function loadMyLinks() {
  if (!currentUser) return;
  const [sort, order] = (mineSort.value || "createdAt:desc").split(":");
  const params = new URLSearchParams({
    q: mineSearch.value.trim(),
    sort,
    order,
    page: String(minePage),
    limit: String(PAGE_SIZE),
  });
  if (mineFolder.value) params.set("folderId", mineFolder.value);
  if (mineTag.value) params.set("tag", mineTag.value);
  try {
    const data = await api(`/api/urls/mine?${params}`);
    mineTotal = data.total || 0;
    mineBody.innerHTML = "";
    if (!data.urls?.length) {
      mineEmpty.hidden = false;
      minePager.hidden = true;
      return;
    }
    mineEmpty.hidden = true;
    for (const item of data.urls) {
      const meta = [
        item.folder?.name,
        ...(item.tags || []).map((t) => t.name),
      ]
        .filter(Boolean)
        .join(" · ");
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <a href="${item.shortUrl}" target="_blank" rel="noopener">${item.shortCode}</a>
          ${meta ? `<div class="hint">${meta}</div>` : ""}
        </td>
        <td class="dest">${item.originalUrl}</td>
        <td>${item.clickCount}</td>
        <td><span class="badge">${statusLabel(item)}</span></td>
        <td class="row-actions">
          <button type="button" class="ghost use-code" data-code="${item.shortCode}">Stats</button>
        </td>
      `;
      mineBody.appendChild(tr);
    }
    mineBody.querySelectorAll(".use-code").forEach((btn) => {
      btn.addEventListener("click", () => loadStats(btn.dataset.code));
    });
    const pages = Math.max(1, Math.ceil(mineTotal / PAGE_SIZE));
    minePager.hidden = pages <= 1;
    minePageLabel.textContent = `Page ${minePage} of ${pages}`;
    minePrev.disabled = minePage <= 1;
    mineNext.disabled = minePage >= pages;
  } catch (err) {
    mineEmpty.hidden = false;
    mineEmpty.textContent = err.message;
  }
}

function barChart(title, rows) {
  if (!rows?.length) return "";
  const max = Math.max(...rows.map((r) => r.count), 1);
  const items = rows
    .map((row) => {
      const width = Math.round((row.count / max) * 100);
      return `<div class="bar-row">
        <span class="bar-label">${row.name}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
        <span class="bar-count">${row.count}</span>
      </div>`;
    })
    .join("");
  return `<section class="chart-block"><h4>${title}</h4>${items}</section>`;
}

function recentClicksTable(rows) {
  if (!rows?.length) {
    return `<section class="chart-block"><h4>Recent opens</h4><p class="hint">No clicks in this range yet.</p></section>`;
  }
  const body = rows
    .map(
      (row) => `<tr>
        <td>${new Date(row.clickedAt).toLocaleString()}</td>
        <td><code>${row.ipAddress}</code></td>
        <td>${row.country}</td>
        <td>${row.device}</td>
        <td>${row.browser}</td>
        <td>${row.referrer}</td>
      </tr>`
    )
    .join("");
  return `<section class="chart-block">
    <h4>Recent opens</h4>
    <div class="table-wrap">
      <table class="links-table clicks-table">
        <thead>
          <tr>
            <th>Opened at</th>
            <th>IP</th>
            <th>Country</th>
            <th>Device</th>
            <th>Browser</th>
            <th>Referrer</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  </section>`;
}

async function loadStats(code) {
  showError(statsError, "");
  selectedCode = code;
  try {
    const [data, analytics] = await Promise.all([
      api(`/api/urls/${encodeURIComponent(code)}`),
      api(`/api/urls/${encodeURIComponent(code)}/analytics`),
    ]);
    const tagNames = (data.tags || []).map((t) => t.name).join(", ") || "—";
    const rows = [
      ["Short URL", data.shortUrl],
      ["Original", data.originalUrl],
      ["Clicks", String(data.clickCount)],
      ["Status", statusLabel(data)],
      ["Folder", data.folder?.name || "—"],
      ["Tags", tagNames],
      ["OG title", data.ogTitle || "—"],
      ["Created", new Date(data.createdAt).toLocaleString()],
      ["Expires", data.expiresAt ? new Date(data.expiresAt).toLocaleString() : "Never"],
    ];
    statsResult.innerHTML = "";
    for (const [label, value] of rows) {
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = value;
      statsResult.append(dt, dd);
    }
    document.getElementById("stats-detail-title").textContent = data.shortCode;
    chartsEl.innerHTML =
      recentClicksTable(analytics.recentClicks) +
      barChart(
        "Clicks by day",
        analytics.timeseries.map((r) => ({ name: r.day, count: r.count }))
      ) +
      barChart("Countries", analytics.countries) +
      barChart("Devices", analytics.devices) +
      barChart("Browsers", analytics.browsers) +
      barChart("Referrers", analytics.referrers) +
      barChart("UTM sources", analytics.utmSources);
    statsDetail.hidden = false;
    statsDetail.dataset.originalUrl = data.originalUrl;
    statsDetail.dataset.expiresAt = data.expiresAt || "";
    statsDetail.dataset.disabled = data.disabled ? "1" : "";
    statsDetail.dataset.folderId = data.folderId || "";
    statsDetail.dataset.tags = (data.tags || []).map((t) => t.name).join(", ");
    statsDetail.dataset.ogTitle = data.ogTitle || "";
    statsDetail.dataset.ogDescription = data.ogDescription || "";
    statsDetail.dataset.ogImage = data.ogImage || "";
    statsDetail.dataset.shortCode = data.shortCode;
  } catch (err) {
    statsDetail.hidden = true;
    showError(statsError, err.message);
  }
}

function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function displayNameFromEmail(email) {
  return String(email || "").split("@")[0]?.slice(0, 64) || "User";
}

authCancel.addEventListener("click", () => authDialog.close());

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError(authError, "");
  loginBtn.disabled = true;
  try {
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    const data = await authRequest("/api/auth/sign-in/email", { email, password });
    currentUser = data.user;
    authDialog.close();
    renderAuthStatus();
    await loadOrgMeta();
    await loadMyLinks();
    await loadWebhooks();
  } catch (err) {
    showError(authError, err.message);
  } finally {
    loginBtn.disabled = false;
  }
});

registerBtn.addEventListener("click", async () => {
  showError(authError, "");
  registerBtn.disabled = true;
  try {
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    const data = await authRequest("/api/auth/sign-up/email", {
      email,
      password,
      name: displayNameFromEmail(email),
    });
    currentUser = data.user;
    authDialog.close();
    renderAuthStatus();
    await loadOrgMeta();
    await loadMyLinks();
    await loadWebhooks();
  } catch (err) {
    showError(authError, err.message);
  } finally {
    registerBtn.disabled = false;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError(formError, "");
  result.hidden = true;
  qrImg.hidden = true;
  if (anonTip) anonTip.hidden = true;

  submitBtn.disabled = true;
  const body = {
    originalUrl: document.getElementById("originalUrl").value.trim(),
  };
  const customAlias = document.getElementById("customAlias").value.trim();
  const expiresLocal = document.getElementById("expiresAt").value;
  if (customAlias) body.customAlias = customAlias;
  if (expiresLocal) body.expiresAt = new Date(expiresLocal).toISOString();

  const utmSource = document.getElementById("utmSource").value.trim();
  const utmMedium = document.getElementById("utmMedium").value.trim();
  const utmCampaign = document.getElementById("utmCampaign").value.trim();
  if (utmSource) body.utmSource = utmSource;
  if (utmMedium) body.utmMedium = utmMedium;
  if (utmCampaign) body.utmCampaign = utmCampaign;

  if (currentUser) {
    body.disabled = document.getElementById("linkDisabled").checked;
    const password = document.getElementById("linkPassword").value;
    if (password) body.password = password;
    const folderId = document.getElementById("linkFolder").value;
    if (folderId) body.folderId = folderId;
    const tags = document.getElementById("linkTags").value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length) body.tags = tags;
    const ogTitle = document.getElementById("ogTitle").value.trim();
    const ogDescription = document.getElementById("ogDescription").value.trim();
    const ogImage = document.getElementById("ogImage").value.trim();
    if (ogTitle) body.ogTitle = ogTitle;
    if (ogDescription) body.ogDescription = ogDescription;
    if (ogImage) body.ogImage = ogImage;
  }

  try {
    const data = await api("/api/shorten", {
      method: "POST",
      body: JSON.stringify(body),
    });
    shortUrlEl.href = data.shortUrl;
    shortUrlEl.textContent = data.shortUrl;
    qrImg.src = `/${encodeURIComponent(data.shortCode)}/qr.png`;
    qrImg.hidden = false;
    result.hidden = false;
    if (anonTip) anonTip.hidden = Boolean(currentUser);
    if (currentUser) {
      minePage = 1;
      await loadOrgMeta();
      await loadMyLinks();
    }
  } catch (err) {
    showError(formError, err.message);
  } finally {
    submitBtn.disabled = false;
  }
});

copyBtn.addEventListener("click", async () => {
  const text = shortUrlEl.textContent;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = "Copied";
    setTimeout(() => {
      copyBtn.textContent = "Copy";
    }, 1500);
  } catch {
    copyBtn.textContent = "Failed";
    setTimeout(() => {
      copyBtn.textContent = "Copy";
    }, 1500);
  }
});

document.getElementById("add-folder-btn").addEventListener("click", async () => {
  showError(orgError, "");
  try {
    await api("/api/folders", {
      method: "POST",
      body: JSON.stringify({ name: document.getElementById("new-folder").value }),
    });
    document.getElementById("new-folder").value = "";
    await loadOrgMeta();
  } catch (err) {
    showError(orgError, err.message);
  }
});

document.getElementById("add-tag-btn").addEventListener("click", async () => {
  showError(orgError, "");
  try {
    await api("/api/tags", {
      method: "POST",
      body: JSON.stringify({ name: document.getElementById("new-tag").value }),
    });
    document.getElementById("new-tag").value = "";
    await loadOrgMeta();
  } catch (err) {
    showError(orgError, err.message);
  }
});

webhookForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError(webhookError, "");
  const events = [];
  if (document.getElementById("webhook-created").checked) events.push("link.created");
  if (document.getElementById("webhook-clicked").checked) events.push("link.clicked");
  try {
    await api("/api/webhooks", {
      method: "POST",
      body: JSON.stringify({
        url: document.getElementById("webhook-url").value.trim(),
        secret: document.getElementById("webhook-secret").value.trim() || undefined,
        events,
      }),
    });
    webhookForm.reset();
    document.getElementById("webhook-created").checked = true;
    document.getElementById("webhook-clicked").checked = true;
    await loadWebhooks();
  } catch (err) {
    showError(webhookError, err.message);
  }
});

refreshMineBtn.addEventListener("click", async () => {
  if (!currentUser) return;
  refreshMineBtn.disabled = true;
  const label = refreshMineBtn.textContent;
  refreshMineBtn.textContent = "Refreshing…";
  try {
    await loadOrgMeta();
    await loadMyLinks();
    if (selectedCode && !statsDetail.hidden) await loadStats(selectedCode);
  } finally {
    refreshMineBtn.disabled = false;
    refreshMineBtn.textContent = label || "Refresh";
  }
});

mineSearch.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    minePage = 1;
    loadMyLinks();
  }, 250);
});

for (const el of [mineSort, mineFolder, mineTag]) {
  el.addEventListener("change", () => {
    minePage = 1;
    loadMyLinks();
  });
}

minePrev.addEventListener("click", () => {
  if (minePage > 1) {
    minePage -= 1;
    loadMyLinks();
  }
});

mineNext.addEventListener("click", () => {
  minePage += 1;
  loadMyLinks();
});

document.getElementById("refresh-stats-btn").addEventListener("click", async () => {
  if (!selectedCode) return;
  const btn = document.getElementById("refresh-stats-btn");
  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = "Refreshing…";
  try {
    await loadStats(selectedCode);
  } finally {
    btn.disabled = false;
    btn.textContent = label || "Refresh stats";
  }
});

document.getElementById("edit-link-btn").addEventListener("click", () => {
  if (!selectedCode) return;
  document.getElementById("edit-code").value = selectedCode;
  document.getElementById("edit-originalUrl").value =
    statsDetail.dataset.originalUrl || "";
  document.getElementById("edit-alias").value = selectedCode;
  document.getElementById("edit-expiresAt").value = toLocalInput(
    statsDetail.dataset.expiresAt
  );
  document.getElementById("edit-folder").value = statsDetail.dataset.folderId || "";
  document.getElementById("edit-tags").value = statsDetail.dataset.tags || "";
  document.getElementById("edit-ogTitle").value = statsDetail.dataset.ogTitle || "";
  document.getElementById("edit-ogDescription").value =
    statsDetail.dataset.ogDescription || "";
  document.getElementById("edit-ogImage").value = statsDetail.dataset.ogImage || "";
  document.getElementById("edit-password").value = "";
  document.getElementById("edit-clear-password").checked = false;
  document.getElementById("edit-disabled").checked = Boolean(
    statsDetail.dataset.disabled
  );
  showError(editError, "");
  editDialog.showModal();
});

document.getElementById("edit-cancel").addEventListener("click", () => {
  editDialog.close();
});

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = document.getElementById("edit-code").value;
  const body = {
    originalUrl: document.getElementById("edit-originalUrl").value.trim(),
    customAlias: document.getElementById("edit-alias").value.trim(),
    disabled: document.getElementById("edit-disabled").checked,
    folderId: document.getElementById("edit-folder").value || null,
    tags: document.getElementById("edit-tags").value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    ogTitle: document.getElementById("edit-ogTitle").value.trim() || null,
    ogDescription: document.getElementById("edit-ogDescription").value.trim() || null,
    ogImage: document.getElementById("edit-ogImage").value.trim() || null,
  };
  const expiresLocal = document.getElementById("edit-expiresAt").value;
  body.expiresAt = expiresLocal ? new Date(expiresLocal).toISOString() : null;
  if (document.getElementById("edit-clear-password").checked) {
    body.clearPassword = true;
  } else if (document.getElementById("edit-password").value) {
    body.password = document.getElementById("edit-password").value;
  }
  showError(editError, "");
  try {
    const updated = await api(`/api/urls/${encodeURIComponent(code)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    editDialog.close();
    selectedCode = updated.shortCode;
    await loadOrgMeta();
    await loadMyLinks();
    await loadStats(updated.shortCode);
  } catch (err) {
    showError(editError, err.message);
  }
});

document.getElementById("delete-link-btn").addEventListener("click", async () => {
  if (!selectedCode) return;
  if (!confirm(`Delete ${selectedCode}? This cannot be undone.`)) return;
  try {
    await api(`/api/urls/${encodeURIComponent(selectedCode)}`, { method: "DELETE" });
    statsDetail.hidden = true;
    selectedCode = null;
    await loadMyLinks();
  } catch (err) {
    showError(statsError, err.message);
  }
});

refreshSession();
