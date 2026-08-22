/* =====================================================================
   Dork Builder — front-end logic
   All of this runs in the browser. Nothing here contacts any outside
   server except when the student presses "Open in Google", which just
   opens a normal Google search tab (the same as typing it by hand).
===================================================================== */

// ---- 1. Grab every field on the page once, so we don't repeat
//         document.getElementById(...) everywhere below.
const fields = {
  freeText: document.getElementById("freeText"),
  site: document.getElementById("site"),
  filetype: document.getElementById("filetype"),
  intitle: document.getElementById("intitle"),
  inurl: document.getElementById("inurl"),
  intext: document.getElementById("intext"),
  dateAfter: document.getElementById("dateAfter"),
  dateBefore: document.getElementById("dateBefore"),
  exclude: document.getElementById("exclude"),
};

const queryPreview = document.getElementById("queryPreview");
const copyBtn = document.getElementById("copyBtn");
const openBtn = document.getElementById("openBtn");
const templateList = document.getElementById("templateList");
const templateNote = document.getElementById("templateNote");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const studentName = document.getElementById("studentName");

// ---- 2. The categorized template library.
//         Each entry is: a label, an educational note, and the field
//         values to fill in when the student clicks it.
const TEMPLATES = [
  {
    label: "Exposed documents",
    note:
      "Combines filetype: with a keyword to find documents (PDF, XLSX, DOCX...) " +
      "that were never meant to be public. Teaches why sensitive files should " +
      "be kept out of publicly indexable folders.",
    values: { filetype: "pdf", intext: "internal use only" },
  },
  {
    label: "Login panels",
    note:
      "Looks for pages whose title or URL suggests an admin or login screen. " +
      "Teaches why admin panels should require authentication and not be " +
      "discoverable or indexed by search engines at all.",
    values: { intitle: "login", inurl: "admin" },
  },
  {
    label: "Exposed directories",
    note:
      "The classic 'index of' pattern shows up when a web server lists a " +
      "folder's contents instead of a real page. Teaches why directory " +
      "listing should be disabled on production servers.",
    values: { intitle: "index of" },
  },
  {
    label: "Configuration files",
    note:
      "Config and environment files sometimes get uploaded by mistake and " +
      "contain settings that should never be public. Teaches why these file " +
      "types should never live inside a public web folder.",
    values: { filetype: "env", intext: "password" },
  },
];

// ---- 3. Build the query string from whatever the student has typed.
function buildQuery() {
  const parts = [];

  if (fields.freeText.value.trim()) {
    parts.push(fields.freeText.value.trim());
  }
  if (fields.site.value.trim()) {
    parts.push(`site:${fields.site.value.trim()}`);
  }
  if (fields.filetype.value.trim()) {
    parts.push(`filetype:${fields.filetype.value.trim()}`);
  }
  if (fields.intitle.value.trim()) {
    parts.push(`intitle:${quoteIfNeeded(fields.intitle.value.trim())}`);
  }
  if (fields.inurl.value.trim()) {
    parts.push(`inurl:${fields.inurl.value.trim()}`);
  }
  if (fields.intext.value.trim()) {
    parts.push(`intext:${quoteIfNeeded(fields.intext.value.trim())}`);
  }
  if (fields.dateAfter.value) {
    parts.push(`after:${fields.dateAfter.value}`);
  }
  if (fields.dateBefore.value) {
    parts.push(`before:${fields.dateBefore.value}`);
  }
  if (fields.exclude.value.trim()) {
    fields.exclude.value
      .split(",")
      .map((w) => w.trim())
      .filter(Boolean)
      .forEach((word) => parts.push(`-${word}`));
  }

  return parts.join(" ");
}

// Wraps a phrase in quotes only if it has more than one word,
// e.g.  index of -> "index of"   but   login -> login
function quoteIfNeeded(value) {
  return value.includes(" ") ? `"${value}"` : value;
}

// ---- 4. Re-render the query preview every time any field changes.
function refreshPreview() {
  const query = buildQuery();
  queryPreview.textContent = query || "Fill in a field to build your query…";
}

Object.values(fields).forEach((input) => {
  input.addEventListener("input", refreshPreview);
});

// ---- 5. Copy / Open actions.
copyBtn.addEventListener("click", async () => {
  const query = buildQuery();
  if (!query) return;
  await navigator.clipboard.writeText(query);
  flashButton(copyBtn, "Copied!");
});

openBtn.addEventListener("click", () => {
  const query = buildQuery();
  if (!query) return;
  saveToHistory(query);
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  window.open(url, "_blank", "noopener,noreferrer");
});

function flashButton(button, tempText) {
  const original = button.textContent;
  button.textContent = tempText;
  setTimeout(() => (button.textContent = original), 1200);
}

// ---- 6. Template library rendering.
function renderTemplates() {
  templateList.innerHTML = "";
  TEMPLATES.forEach((tpl) => {
    const chip = document.createElement("button");
    chip.className = "template-chip";
    chip.type = "button";
    chip.textContent = tpl.label;
    chip.addEventListener("click", () => applyTemplate(tpl));
    templateList.appendChild(chip);
  });
}

function applyTemplate(tpl) {
  // Clear every field first, then fill in only what the template defines.
  Object.values(fields).forEach((input) => (input.value = ""));
  Object.entries(tpl.values).forEach(([key, value]) => {
    if (fields[key]) fields[key].value = value;
  });
  templateNote.textContent = tpl.note;
  refreshPreview();
}

// ---- 7. History, saved in the browser's own storage (localStorage).
//         This is NOT a real account system — it just remembers the
//         last searches on this specific browser/device.
const HISTORY_KEY = "dorkBuilderHistory";

function loadHistory() {
  const raw = localStorage.getItem(HISTORY_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveToHistory(query) {
  const history = loadHistory();
  history.unshift({
    query,
    student: studentName.value.trim() || "Unnamed student",
    time: new Date().toLocaleString(),
  });
  // Keep only the most recent 20 entries so storage doesn't grow forever.
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
  renderHistory();
}

function renderHistory() {
  const history = loadHistory();
  historyList.innerHTML = "";
  if (history.length === 0) {
    historyList.innerHTML = "<li>No searches yet.</li>";
    return;
  }
  history.forEach((entry) => {
    const li = document.createElement("li");
    li.innerHTML = `${entry.time} — ${entry.student}<span>${escapeHtml(entry.query)}</span>`;
    historyList.appendChild(li);
  });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

clearHistoryBtn.addEventListener("click", () => {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
});

// ---- 8. Restore the student's name if they've entered it before.
const NAME_KEY = "dorkBuilderStudentName";
studentName.value = localStorage.getItem(NAME_KEY) || "";
studentName.addEventListener("input", () => {
  localStorage.setItem(NAME_KEY, studentName.value.trim());
});

// ---- 9. Run everything once on page load.
renderTemplates();
renderHistory();
refreshPreview();
