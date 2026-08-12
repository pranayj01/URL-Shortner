const form = document.getElementById("shorten-form");
const formError = document.getElementById("form-error");
const result = document.getElementById("result");
const shortUrlEl = document.getElementById("short-url");
const copyBtn = document.getElementById("copy-btn");
const submitBtn = document.getElementById("submit-btn");

const statsForm = document.getElementById("stats-form");
const statsError = document.getElementById("stats-error");
const statsResult = document.getElementById("stats-result");

function showError(el, message) {
  el.hidden = !message;
  el.textContent = message || "";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError(formError, "");
  result.hidden = true;
  submitBtn.disabled = true;

  const originalUrl = document.getElementById("originalUrl").value.trim();
  const customAlias = document.getElementById("customAlias").value.trim();
  const expiresLocal = document.getElementById("expiresAt").value;

  const body = { originalUrl };
  if (customAlias) body.customAlias = customAlias;
  if (expiresLocal) body.expiresAt = new Date(expiresLocal).toISOString();

  try {
    const res = await fetch("/api/shorten", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Could not shorten URL");
    }

    shortUrlEl.href = data.shortUrl;
    shortUrlEl.textContent = data.shortUrl;
    result.hidden = false;
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

  const code = document.getElementById("statsCode").value.trim();

  try {
    const res = await fetch(`/api/urls/${encodeURIComponent(code)}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Could not load stats");
    }

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
