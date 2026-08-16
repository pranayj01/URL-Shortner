function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const shell = (title, body) => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="/assets/styles.css" />
  </head>
  <body>
    <div class="bg" aria-hidden="true"></div>
    <main class="shell gate">
      ${body}
    </main>
  </body>
</html>`;

export function passwordGatePage(code, errorMessage) {
  const err = errorMessage
    ? `<p class="error">${escapeHtml(errorMessage)}</p>`
    : "";
  return shell(
    "Password required",
    `<section class="panel">
      <h1>This link is locked</h1>
      <p class="hint">Enter the password to continue to the destination.</p>
      <form method="post" action="/${escapeHtml(code)}">
        <label class="field">
          <span>Password</span>
          <input type="password" name="password" required autofocus />
        </label>
        ${err}
        <button type="submit">Continue</button>
      </form>
    </section>`
  );
}

export function simpleMessagePage(title, message) {
  return shell(
    title,
    `<section class="panel">
      <h1>${escapeHtml(title)}</h1>
      <p class="hint">${escapeHtml(message)}</p>
    </section>`
  );
}
