const TOKEN_KEY = "shortlink_token";

const form = document.getElementById("shorten-form");
const formError = document.getElementById("form-error");
const result = document.getElementById("result");
const shortUrlEl = document.getElementById("short-url");
const copyBtn = document.getElementById("copy-btn");
const submitBtn = document.getElementById("submit-btn");

const statsForm = document.getElementById("stats-form");
const statsError = document.getElementById("stats-error");
const statsResult = document.getElementById("stats-result");

const authPanel = document.getElementById("auth-form");
const authPanel = document.getElementById("auth-panel");
const authError = document.getElementById("auth-error");
const authStatus = document.getElementById("auth-status");
const loginBtn = document.getElementById("login-btn");
const registerBtn = document.getElementById("register-btn");
const refreshMineBtn = document.getElementById("refresh-mine");
const mineList = document.getElementById("mine-list");
const mineEmpty = document.getElementById("mine-empty");

let currentUser = null;

function showError(el, message) {
  el.hidden = !message;
  el.textContent = message || "";
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(extra = {}) {
  const headers = { ...extra };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: authHeaders(options.headers || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || "Request failed");
    err.status = res.status;
    throw err;
  }
  return data;
}

function extractShortCode(input) {
  const value = (input || "").trim();
  if (!value) return "";

  try {
    if (value.includes("://") || value.startsWith("//")) {
      const url = new URL(value.startsWith("//") ? `https:${value}` : value);
      const parts = url.pathname.split("/").filter(Boolean);
      return parts[parts.length - 1] || "";
    }
  } catch {
    // Fall through.
  }

  const slashParts = value.split("/").filter(Boolean);
  if (slashParts.length > 1) return slashParts[slashParts.length - 1];
  return value;
}

function renderAuthStatus() {
  if (currentUser) {
    authPanel.innerHTML = `
      <span class="auth-email">${currentUser.email}</span>
      <button type="button" id="logout-btn" class="ghost">Log out</button>
    `;
    authPanel.hidden = true;
    document.getElementById("logout-btn").addEventListener("click", () => {
      setToken(null);
      currentUser = null;
      renderAuthStatus();
      mineList.innerHTML = "";
      mineEmpty.hidden = false;
      showError(statsError, "");
      statsResult.hidden = true;
    });
  } else {
    authStatus.innerHTML = `<span class="hint">Not logged in</span>`;
    authPanel.hidden = false;
  }
}

async function refreshSession() {
  const token = getToken();
  if (!token) {
    currentUser = null;
    renderAuthStatus();
    return;
  }
  try {
    const data = await api("/api/auth/me");
    currentUser = data.user;
  } catch {
    setToken(null);
    currentUser = null;
  }
  renderAuthStatus();
  if (currentUser) await loadMyLinks();
}

async function loadMyLinks() {
  if (!currentUser) return;
  try {
    const data = await api("/api/urls/mine");
    mineList.innerHTML = "";
    if (!data.urls?.length) {
      mineEmpty.hidden = false;
      return;
    }
    mineEmpty.hidden = true;
    for (const item of data.urls) {
      const li = document.createElement("li");
      li.innerHTML = `
        <a href="${item.shortUrl}" target="_blank" rel="noopener">${item.shortCode}</a>
        <span>${item.clickCount} clicks</span>
        <button type="button" class="ghost use-code" data-code="${item.shortCode}">Stats</button>
      `;
      mineList.appendChild(li);
    }
    mineList.querySelectorAll(".use-code").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.getElementById("statsCode").value = btn.dataset.code;
        statsForm.requestSubmit();
      });
    });
  } catch (err) {
    mineEmpty.hidden = false;
    mineEmpty.textContent = err.message;
  }
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError(authError, "");
  loginBtn.disabled = true;
  try {
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    const data = await api("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    currentUser = data.user;
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
    const data = await api("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    currentUser = data.user;
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

  if (!currentUser) {
    showError(formError, "Log in first to create a short link.");
    return;
  }

  submitBtn.disabled = true;
  const originalUrl = document.getElementById("originalUrl").value.trim();
  const customAlias = document.getElementById("customAlias").value.trim();
  const expiresLocal = document.getElementById("expiresAt").value;

  const body = { originalUrl };
  if (customAlias) body.customAlias = customAlias;
  if (expiresLocal) body.expiresAt = new Date(expiresLocal).toISOString();

  try {
    const data = await api("/api/shorten", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    shortUrlEl.href = data.shortUrl;
    shortUrlEl.textContent = data.shortUrl;
    result.hidden = false;
    await loadMyLinks();
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

statsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError(statsError, "");
  statsResult.hidden = true;
  statsResult.innerHTML = "";

  if (!currentUser) {
    showError(statsError, "Log in to view insights for your links.");
    return;
  }

  const code = extractShortCode(document.getElementById("statsCode").value);
  if (!code) {
    showError(statsError, "Enter a short code or paste your short link.");
    return;
  }

  try {
    const data = await api(`/api/urls/${encodeURIComponent(code)}`);
    const rows = [
      ["Short URL", data.shortUrl],
      ["Original", data.originalUrl],
      ["Clicks", String(data.clickCount)],
      ["Created", new Date(data.createdAt).toLocaleString()],
      [
        "Expires",
        data.expiresAt ? new Date(data.expiresAt).toLocaleString() : "Never",
      ],
    ];

    for (const [label, value] of rows) {
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = value;
      statsResult.append(dt, dd);
    }
    statsResult.hidden = false;
  } catch (err) {
    showError(statsError, err.message);
  }
});

refreshMineBtn.addEventListener("click", () => {
  if (!currentUser) {
    mineEmpty.hidden = false;
    mineEmpty.textContent = "Log in to see your links.";
    return;
  }
  loadMyLinks();
});

refreshSession();
