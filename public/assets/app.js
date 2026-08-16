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
const minePager = document.getElementById("mine-pager");
const minePrev = document.getElementById("mine-prev");
const mineNext = document.getElementById("mine-next");
const minePageLabel = document.getElementById("mine-page-label");
const editDialog = document.getElementById("edit-dialog");
const editForm = document.getElementById("edit-form");
const editError = document.getElementById("edit-error");

let currentUser = null;
let minePage = 1;
let mineTotal = 0;
let selectedCode = null;
let searchTimer = 0;

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
  return api(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
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

function clearLocalAuthState() {
  currentUser = null;
  mineBody.innerHTML = "";
  mineEmpty.hidden = false;
  minePager.hidden = true;
  statsDetail.hidden = true;
  insightsPanel.hidden = true;
  showError(statsError, "");
  setOwnerOnlyVisible(false);
  if (shortenHint) {
    shortenHint.textContent =
      "Anyone can create a short link. Log in to save links to your account and view insights.";
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
      shortenHint.textContent =
        "Links you create while logged in appear under Your insights.";
    }
    document.getElementById("logout-btn").addEventListener("click", async () => {
      try {
        await authRequest("/api/auth/sign-out", {});
      } catch {
        // Session may already be gone.
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
  if (currentUser) await loadMyLinks();
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
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><a href="${item.shortUrl}" target="_blank" rel="noopener">${item.shortCode}</a></td>
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

async function loadStats(code) {
  showError(statsError, "");
  selectedCode = code;
  try {
    const [data, analytics] = await Promise.all([
      api(`/api/urls/${encodeURIComponent(code)}`),
      api(`/api/urls/${encodeURIComponent(code)}/analytics`),
    ]);
    const rows = [
      ["Short URL", data.shortUrl],
      ["Original", data.originalUrl],
      ["Clicks", String(data.clickCount)],
      ["Status", statusLabel(data)],
      ["Created", new Date(data.createdAt).toLocaleString()],
      [
        "Expires",
        data.expiresAt ? new Date(data.expiresAt).toLocaleString() : "Never",
      ],
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
    statsDetail.dataset.shortUrl = data.shortUrl;
    statsDetail.dataset.originalUrl = data.originalUrl;
    statsDetail.dataset.expiresAt = data.expiresAt || "";
    statsDetail.dataset.disabled = data.disabled ? "1" : "";
    statsDetail.dataset.hasPassword = data.hasPassword ? "1" : "";
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
  const local = String(email || "").split("@")[0] || "User";
  return local.slice(0, 64);
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
    await loadMyLinks();
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
    await loadMyLinks();
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
  const originalUrl = document.getElementById("originalUrl").value.trim();
  const customAlias = document.getElementById("customAlias").value.trim();
  const expiresLocal = document.getElementById("expiresAt").value;
  const password = document.getElementById("linkPassword").value;
  const disabled = document.getElementById("linkDisabled").checked;

  const body = { originalUrl };
  if (customAlias) body.customAlias = customAlias;
  if (expiresLocal) body.expiresAt = new Date(expiresLocal).toISOString();
  if (currentUser) {
    body.disabled = disabled;
    if (password) body.password = password;
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

refreshMineBtn.addEventListener("click", () => {
  if (!currentUser) return;
  loadMyLinks();
});

mineSearch.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    minePage = 1;
    loadMyLinks();
  }, 250);
});

mineSort.addEventListener("change", () => {
  minePage = 1;
  loadMyLinks();
});

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

document.getElementById("edit-link-btn").addEventListener("click", () => {
  if (!selectedCode) return;
  document.getElementById("edit-code").value = selectedCode;
  document.getElementById("edit-originalUrl").value =
    statsDetail.dataset.originalUrl || "";
  document.getElementById("edit-alias").value = selectedCode;
  document.getElementById("edit-expiresAt").value = toLocalInput(
    statsDetail.dataset.expiresAt
  );
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
    await api(`/api/urls/${encodeURIComponent(selectedCode)}`, {
      method: "DELETE",
    });
    statsDetail.hidden = true;
    selectedCode = null;
    await loadMyLinks();
  } catch (err) {
    showError(statsError, err.message);
  }
});

refreshSession();
