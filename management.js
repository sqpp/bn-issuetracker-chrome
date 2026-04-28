const statusEl = document.getElementById("status");
const errorEl = document.getElementById("error");
const issuesBody = document.getElementById("issues-body");
const topUsersBody = document.getElementById("top-users-body");
const searchInput = document.getElementById("search-uuid");
const searchFieldEl = document.getElementById("search-field");
const issuesSection = document.getElementById("issues-section");
const topUsersSection = document.getElementById("top-users-section");
const manageSection = document.getElementById("manage-section");
const newIssueSection = document.getElementById("new-issue-section");
const paginationEl = document.getElementById("issues-pagination");
const viewLabel = document.getElementById("view-label");
const pageSizeEl = document.getElementById("page-size");
const pagePrevEl = document.getElementById("page-prev");
const pageNextEl = document.getElementById("page-next");
const pageInfoEl = document.getElementById("page-info");
const topUsersPaginationEl = document.getElementById("top-users-pagination");
const topPagePrevEl = document.getElementById("top-page-prev");
const topPageNextEl = document.getElementById("top-page-next");
const topPageInfoEl = document.getElementById("top-page-info");
const filtersSection = document.getElementById("filters-section");
const summaryCardsSection = document.getElementById("summary-cards");
const riskCenterSummaryEl = document.getElementById("risk-center-summary");
const sum1LabelEl = document.getElementById("sum-1-label");
const sum1ValueEl = document.getElementById("sum-1-value");
const sum2LabelEl = document.getElementById("sum-2-label");
const sum2ValueEl = document.getElementById("sum-2-value");
const sum3LabelEl = document.getElementById("sum-3-label");
const sum3ValueEl = document.getElementById("sum-3-value");
let currentView = "issues";
let cachedIssues = [];
let cachedTopUsers = [];
let cachedOngoingIssues = [];
let activeRiskFilter = "all";
let selectedIssue = null;
let currentPage = 1;
let topUsersPage = 1;
let pageSize = Number(pageSizeEl?.value || 20);
let activeFilter = { field: "issue-id", query: "" };
let issuesTotalCount = 0;
let isServerPagedIssues = true;

function parseIssueDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) return d;
  const normalized = String(v).replace(" ", "T");
  const d2 = new Date(normalized);
  if (!Number.isNaN(d2.getTime())) return d2;
  return null;
}

function daysSince(date) {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
}

function setSummaryCards(items) {
  if (!sum1LabelEl || !sum1ValueEl || !sum2LabelEl || !sum2ValueEl || !sum3LabelEl || !sum3ValueEl) return;
  sum1LabelEl.textContent = items[0].label;
  sum1ValueEl.textContent = items[0].value;
  sum1ValueEl.className = `text-2xl font-bold ${items[0].tone || ""}`.trim();
  sum2LabelEl.textContent = items[1].label;
  sum2ValueEl.textContent = items[1].value;
  sum2ValueEl.className = `text-2xl font-bold ${items[1].tone || ""}`.trim();
  sum3LabelEl.textContent = items[2].label;
  sum3ValueEl.textContent = items[2].value;
  sum3ValueEl.className = `text-2xl font-bold ${items[2].tone || ""}`.trim();
}

function buildIssueSummary(rows, totalOverride = null) {
  const now = Date.now();
  const last7 = (rows || []).filter((r) => {
    const d = parseIssueDate(r.dateCreated);
    return d && now - d.getTime() <= 7 * 24 * 60 * 60 * 1000;
  });
  const moduleCount = new Map();
  for (const r of last7) {
    const m = String(r.issueType ?? r.issuetype ?? "Unknown").trim() || "Unknown";
    moduleCount.set(m, (moduleCount.get(m) || 0) + 1);
  }
  let topModule = "N/A";
  let topModuleCount = 0;
  for (const [m, c] of moduleCount.entries()) {
    if (c > topModuleCount) {
      topModule = m;
      topModuleCount = c;
    }
  }
  return [
    { label: "TOTAL", value: String(totalOverride ?? (rows || []).length), tone: "" },
    { label: "TOP MODULE (7D)", value: topModuleCount ? `${topModule} (${topModuleCount})` : "N/A", tone: "text-emerald-400" },
    { label: "NEW (7D)", value: String(last7.length), tone: "text-sky-400" },
  ];
}

function buildOngoingSummary(rows) {
  const validDates = (rows || [])
    .map((r) => parseIssueDate(r.dateCreated))
    .filter(Boolean);
  const ages = validDates.map((d) => daysSince(d));
  const oldest = ages.length ? Math.max(...ages) : 0;
  const avg = ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : 0;
  return [
    { label: "TOTAL ONGOING", value: String((rows || []).length), tone: "text-rose-400" },
    { label: "OLDEST ONGOING", value: `${Math.floor(oldest)}d`, tone: "text-amber-400" },
    { label: "AVG ONGOING AGE", value: `${Math.floor(avg)}d`, tone: "text-sky-400" },
  ];
}

function buildRiskSummary(rows) {
  const mrrDanger = (rows || [])
    .filter((u) => Number(u.risk || 0) > 0)
    .reduce((acc, u) => acc + Number(u.mrr || 0), 0);
  const withRisk = (rows || []).filter((u) => Number(u.risk || 0) > 0).length;
  const highRisk = (rows || []).filter((u) => Number(u.risk || 0) >= 3).length;
  return [
    { label: "MRR DANGER", value: `$${mrrDanger.toFixed(0)}`, tone: "text-rose-400" },
    { label: "USERS WITH RISK", value: String(withRisk), tone: "text-amber-400" },
    { label: "HIGH RISK", value: String(highRisk), tone: "text-rose-400" },
  ];
}

function writeUrlState() {
  const params = new URLSearchParams(window.location.search);
  params.set("view", currentView);
  params.set("page", String(currentPage));
  params.set("pageSize", String(pageSize));
  if (currentView === "top-users") {
    params.set("risk", activeRiskFilter);
    params.delete("searchField");
    params.delete("search");
  } else {
    params.delete("risk");
    params.set("searchField", activeFilter.field || "issue-id");
    if (String(activeFilter.query || "").trim()) {
      params.set("search", String(activeFilter.query || "").trim());
    } else {
      params.delete("search");
    }
  }
  const next = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, "", next);
}

function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");
  const page = Number(params.get("page") || "1");
  const nextPageSize = Number(params.get("pageSize") || `${pageSize}`);
  const risk = params.get("risk");
  const searchField = params.get("searchField");
  const search = params.get("search");
  return {
    view: view || "issues",
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: Number.isFinite(nextPageSize) && nextPageSize > 0 ? nextPageSize : pageSize,
    risk: risk || "all",
    searchField: searchField || "issue-id",
    search: search || "",
  };
}

function syncMenuActive() {
  const items = [
    document.getElementById("menu-issues"),
    document.getElementById("menu-new"),
    document.getElementById("menu-ongoing"),
    document.getElementById("menu-top-users"),
  ];
  items.forEach((el) => {
    if (!el) return;
    el.classList.remove("bg-[#c23843]", "text-white");
    el.classList.add("text-gray-200");
  });
  const activeId =
    currentView === "new"
      ? "menu-new"
      : currentView === "ongoing"
      ? "menu-ongoing"
      : currentView === "top-users"
      ? "menu-top-users"
      : "menu-issues";
  const active = document.getElementById(activeId);
  if (active) {
    active.classList.remove("text-gray-200");
    active.classList.add("bg-[#c23843]", "text-white");
  }
}

function setStatus(msg) {
  statusEl.textContent = msg || "";
}

function setError(msg) {
  if (!msg) {
    errorEl.classList.add("hidden");
    errorEl.textContent = "";
    return;
  }
  errorEl.classList.remove("hidden");
  errorEl.textContent = msg;
}

function esc(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getRiskGroup(riskValue) {
  const risk = Number(riskValue || 0);
  if (risk >= 3) return "high";
  if (risk >= 1) return "low";
  return "none";
}

function getRiskColor(riskValue) {
  const risk = Number(riskValue || 0);
  if (risk >= 4) return "#ff4d5e";
  if (risk === 3) return "#ff7a45";
  if (risk === 2) return "#f5c84c";
  if (risk === 1) return "#38bdf8";
  return "#12d2a6";
}

function getFilteredTopUsers() {
  if (activeRiskFilter === "all") return cachedTopUsers;
  if (activeRiskFilter === "none") {
    return cachedTopUsers.filter((u) => Number(u.risk || 0) === 0);
  }
  if (activeRiskFilter === "low") return cachedTopUsers.filter((u) => Number(u.risk || 0) === 1);
  if (activeRiskFilter === "medium") return cachedTopUsers.filter((u) => Number(u.risk || 0) === 2);
  if (activeRiskFilter === "high") return cachedTopUsers.filter((u) => Number(u.risk || 0) === 3);
  if (activeRiskFilter === "very-high") return cachedTopUsers.filter((u) => Number(u.risk || 0) === 4);
  return cachedTopUsers;
}

function renderRiskFilterButtons() {
  const btns = [
    { id: "risk-filter-all", key: "all" },
    { id: "risk-filter-none", key: "none" },
    { id: "risk-filter-low", key: "low" },
    { id: "risk-filter-medium", key: "medium" },
    { id: "risk-filter-high", key: "high" },
    { id: "risk-filter-very-high", key: "very-high" },
  ];
  for (const { id, key } of btns) {
    const el = document.getElementById(id);
    if (!el) continue;
    const isActive = activeRiskFilter === key;
    el.classList.toggle("bg-[#2b2d57]", isActive);
    el.classList.toggle("text-white", isActive);
    el.classList.toggle("bg-transparent", !isActive);
    el.classList.toggle("text-[#aeb3de]", !isActive);
  }
}

function renderRiskSummary(items) {
  const mrrSum = (items || [])
    .filter((u) => Number(u.risk || 0) > 0)
    .reduce((acc, u) => acc + Number(u.mrr || 0), 0);
  const mrrEl = document.getElementById("risk-mrr-total");
  if (mrrEl) mrrEl.textContent = `$${mrrSum.toFixed(0)}`;
}

function getPlatformIconSlug(platform) {
  const p = String(platform || "").trim().toLowerCase();
  if (p === "jira") return "jira";
  if (p === "zendesk") return "zendesk";
  if (p === "intercom") return "intercom";
  if (p === "slack") return "slack";
  if (p === "skype") return "skype";
  return "";
}

function platformWithIcon(platform) {
  const label = String(platform || "");
  const slug = getPlatformIconSlug(label);
  if (!slug) return esc(label);
  const icon = `https://cdn.simpleicons.org/${slug}`;
  return `<span style="display:inline-flex;align-items:center;gap:6px;"><img src="${icon}" alt="${esc(label)}" style="width:14px;height:14px;" />${esc(label)}</span>`;
}

function updateNewPlatformPreview() {
  const platformEl = document.getElementById("new-platform");
  const previewEl = document.getElementById("new-platform-preview");
  if (!platformEl || !previewEl) return;
  const value = platformEl.value;
  const slug = getPlatformIconSlug(value);
  if (!value || !slug) {
    previewEl.innerHTML = "";
    return;
  }
  previewEl.innerHTML = `<img src="https://cdn.simpleicons.org/${slug}" alt="${esc(value)}" style="width:14px;height:14px;" /><span>${esc(value)}</span>`;
}

function apiUrl(base, path, key, extra = "") {
  const root = String(base || "").trim().replace(/\/+$/, "");
  const join = `${root}${path}`;
  const q = [`key=${encodeURIComponent(key || "")}`];
  if (extra) q.push(extra);
  return `${join}?${q.join("&")}`;
}

async function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["itURL", "itAPI"], (cfg) => resolve(cfg));
  });
}

async function callJSON(url, init) {
  const resp = await fetch(url, init);
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(text || `${resp.status} ${resp.statusText}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function renderRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    issuesBody.innerHTML = `<div class="it-card text-gray-400">No issues found.</div>`;
    return;
  }
  issuesBody.innerHTML = rows
    .map((r) => {
      const issueId = r.uuid ?? r.UUID ?? r.id ?? r.issueId ?? r.issue_id ?? "";
      const userId = r.userId ?? r.userid ?? r.uid ?? "";
      const user = r.userName ?? r.username ?? "";
      const issueType = r.issueType ?? r.issuetype ?? "";
      const platform = r.platform ?? "";
      const issueLink = r.link ?? r.issueLink ?? r.issue_link ?? "";
      const solvedBy = r.solvedBy ?? r.solvedby ?? "";
      const note = r.note ?? "";
      const isSolved = String(r.solved ?? "").toLowerCase() === "true" || ["dev","supp"].includes(String(solvedBy).toLowerCase());
      const sideColor = isSolved ? "#12d2a6" : "#ff4d5e";
      const statusIcon = isSolved
        ? `<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:999px;border:2px solid #12d2a6;color:#12d2a6;font-size:16px;font-weight:700;">✓</span>`
        : `<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:999px;border:2px solid #ff4d5e;color:#ff4d5e;font-size:16px;font-weight:700;">✕</span>`;
      const userViewUrl = userId ? `https://office.bitninja.io/index.php/user/view?id=${encodeURIComponent(String(userId))}` : "";
      const baseBtnStyle = "display:inline-flex;align-items:center;justify-content:center;padding:3px 10px;border-radius:6px;color:#fff;font-size:11px;font-weight:700;border:1px solid transparent;cursor:pointer;text-decoration:none;";
      const manageBtnStyle = `${baseBtnStyle}background:#4f46e5;border-color:#6366f1;`;
      const linkBtnStyle = `${baseBtnStyle}background:#2563eb;border-color:#3b82f6;`;
      return `<div class="it-card" style="background:#1a1c3a;border-left:6px solid ${sideColor};border-radius:14px;overflow:hidden; padding:0;">
        <div style="display:grid;grid-template-columns:1.2fr 1.8fr .7fr .9fr;gap:0;align-items:stretch;min-height:84px;">
          <div style="padding:10px 12px;border-right:1px solid #252752;">
            <div style="font-size:11px;color:#8b8fb6;">#${esc(issueId)}</div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:2px;">
              ${statusIcon}
              <span style="font-size:24px;line-height:1;font-weight:700;">${
              userViewUrl
                ? `<a href="${esc(userViewUrl)}" target="_blank" rel="noopener noreferrer" style="color:#3b82f6;text-decoration:none;">${esc(userId)}</a>`
                : `<span style="color:#f2f3ff;">${esc(userId)}</span>`
            }</span>
            </div>
            <div style="margin-top:5px;font-size:17px;font-weight:600;color:#e8e9f7;line-height:1.1;">${esc(user)}</div>
            <div style="font-size:13px;color:#8f93b9;line-height:1.15;">${esc(issueType)}</div>
          </div>
          <div style="padding:10px 12px;border-right:1px solid #252752;">
            <div style="display:inline-flex;align-items:center;gap:8px;font-size:13px;">${platformWithIcon(platform)} <span style="color:#cfd2ee;">${esc(solvedBy || "ongoing")}</span></div>
            <div style="margin-top:8px;color:#d6d8ef;font-size:16px;line-height:1.2;">${esc(note)}</div>
          </div>
          <div style="padding:10px 12px;border-right:1px solid #252752;display:flex;align-items:center;justify-content:center;">
            <span style="font-size:13px;font-weight:700;letter-spacing:.03em;color:#8f93b9;">${esc(solvedBy || "-")}</span>
          </div>
          <div style="padding:10px 12px;display:flex;flex-direction:column;justify-content:center;gap:6px;">
            <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end;">
              <button type="button" class="action-btn" data-action="manage" data-issue-id="${esc(issueId)}" style="${manageBtnStyle}">Manage</button>
              ${
                issueLink
                  ? `<a href="${esc(issueLink)}" target="_blank" rel="noopener noreferrer" style="${linkBtnStyle}">Issue Link</a>`
                  : ""
              }
            </div>
            
          </div>
        </div>
      </div>`;
    })
    .join("");
}

function aggregateTopUsers(rows) {
  const users = new Map();
  for (const r of rows || []) {
    const userId = r.userId ?? r.userid ?? "";
    const userName = r.userName ?? r.username ?? "";
    const mrrRaw = r.currentMrr ?? r.currentmrr ?? r.mrr ?? 0;
    const mrr = Number(mrrRaw) || 0;
    const key = `${userId}__${userName}`;
    if (!users.has(key)) {
      users.set(key, { userId, userName, mrr, issueCount: 1 });
      continue;
    }
    const current = users.get(key);
    current.issueCount += 1;
    current.mrr = Math.max(current.mrr, mrr);
    users.set(key, current);
  }
  const items = Array.from(users.values()).sort((a, b) => {
    if (b.mrr !== a.mrr) return b.mrr - a.mrr;
    return b.issueCount - a.issueCount;
  });
  return items;
}

function renderTopUsers(items) {
  if (items.length === 0) {
    topUsersBody.innerHTML = `<div class="it-card text-gray-400">No users found.</div>`;
    return;
  }
  topUsersBody.innerHTML = items
    .map(
      (u, idx) => {
        const risk = Number(u.risk || 0);
        const group = getRiskGroup(risk);
        const sideColor = group === "high" ? "#ff4d5e" : group === "low" ? "#f59e0b" : "#12d2a6";
        const riskColor = getRiskColor(risk);
        const riskIcon =
          group === "high"
            ? `<span style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:999px;background:#ff4d5e;color:#fff;font-size:16px;font-weight:700;">−</span>`
            : group === "low"
            ? `<span style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:999px;background:#f5c84c;color:#1b1838;font-size:16px;font-weight:700;">!</span>`
            : `<span style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:999px;background:#12d2a6;color:#0b1f1a;font-size:16px;font-weight:700;">✓</span>`;
        return `<div class="it-card" data-top-user="${esc(u.userId)}" style="background:#1a1c3a;border-left:6px solid ${sideColor};border-radius:14px;overflow:hidden; padding:0;">
        <div style="display:grid;grid-template-columns:1.25fr 1.7fr .9fr;gap:0;align-items:stretch;min-height:82px;">
          <div style="padding:10px 12px;border-right:1px solid #252752;">
            <div style="font-size:11px;color:#8b8fb6;">#${idx + 1} • UID ${esc(u.userId)}</div>
            <div style="margin-top:4px;display:flex;align-items:center;gap:8px;">
              ${riskIcon}
              <span style="font-size:18px;font-weight:600;color:#e8e9f7;line-height:1.15;">${esc(u.userName || "-")}</span>
            </div>
            <div style="font-size:12px;color:#aeb3de;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(u.email || "-")}</div>
          </div>
          <div style="padding:10px 12px;border-right:1px solid #252752;">
            <div style="font-size:11px;color:#8b8fb6;">MRR</div>
            <div style="margin-top:2px;font-size:22px;font-weight:700;color:#34d399;">$${Number(u.mrr || 0).toFixed(2)}</div>
            <div style="font-size:12px;color:#8f93b9;">${Number(u.activeSub || 0)} active subscriptions</div>
          </div>
          <div style="padding:10px 12px;display:flex;align-items:center;justify-content:center;">
            <div style="display:flex;flex-direction:column;gap:6px;align-items:center;">
              <label style="font-size:10px;color:#8b8fb6;letter-spacing:.04em;">RISK</label>
              <div style="position:relative;display:inline-flex;align-items:center;">
                <select class="rounded-full bg-transparent px-3 py-1 text-xs font-bold" style="min-width:64px;border:2px solid ${riskColor};color:${riskColor};appearance:none;-webkit-appearance:none;-moz-appearance:none;-ms-appearance:none;background-image:none;background:none;padding-right:22px;" data-action="risk-select" data-user-id="${esc(u.userId)}">
                <option style="color:#dcdff7;background:#11122a;" value="0" ${risk === 0 ? "selected" : ""}>0</option>
                <option style="color:#dcdff7;background:#11122a;" value="1" ${risk === 1 ? "selected" : ""}>1</option>
                <option style="color:#dcdff7;background:#11122a;" value="2" ${risk === 2 ? "selected" : ""}>2</option>
                <option style="color:#dcdff7;background:#11122a;" value="3" ${risk === 3 ? "selected" : ""}>3</option>
                <option style="color:#dcdff7;background:#11122a;" value="4" ${risk === 4 ? "selected" : ""}>4</option>
                </select>
                <span style="position:absolute;right:8px;pointer-events:none;color:${riskColor};font-size:11px;line-height:1;">▾</span>
              </div>
            </div>
          </div>
        </div>
      </div>`;
      }
    )
    .join("");
}

function isUnsolved(row) {
  const solved = String(row.solved ?? "").toLowerCase();
  const solvedBy = String(row.solvedBy ?? row.solvedby ?? "").toLowerCase();
  return solved !== "true" && solvedBy !== "dev" && solvedBy !== "supp";
}

function getSeverity(row) {
  const raw = row.severity ?? row.Severity ?? row.level ?? row.Level ?? row.severity_level;
  const n = Number(raw);
  if (Number.isNaN(n)) return 0;
  return n;
}

function isOngoingIssue(row) {
  const ongoingRisk = Number(row.ongoingRisk ?? row.ongoingrisk ?? 0);
  return ongoingRisk >= 1 && ongoingRisk <= 4;
}

function getFilteredIssues() {
  const field = activeFilter.field || "issue-id";
  const query = String(activeFilter.query || "").trim().toLowerCase();
  if (field === "unsolved") {
    return cachedIssues.filter((r) => isUnsolved(r));
  }
  if (!query) return cachedIssues;

  return cachedIssues.filter((r) => {
    const issueId = String(r.uuid ?? r.UUID ?? r.id ?? r.issueId ?? r.issue_id ?? "").toLowerCase();
    const uid = String(r.userId ?? r.userid ?? r.uid ?? "").toLowerCase();
    const platform = String(r.platform ?? "").toLowerCase();
    const issueType = String(r.issueType ?? r.issuetype ?? "").toLowerCase();
    const note = String(r.note ?? "").toLowerCase();
    if (field === "issue-id") return issueId.includes(query);
    if (field === "uid") return uid.includes(query);
    if (field === "platform") return platform.includes(query);
    if (field === "issue-type") return issueType.includes(query);
    if (field === "note") return note.includes(query);
    return (
      issueId.includes(query) ||
      uid.includes(query) ||
      platform.includes(query) ||
      issueType.includes(query) ||
      note.includes(query)
    );
  });
}

function filterRowsByField(rows, field, queryRaw) {
  const query = String(queryRaw || "").trim().toLowerCase();
  if (!query) return rows || [];
  return (rows || []).filter((r) => {
    const issueId = String(r.uuid ?? r.UUID ?? r.id ?? r.issueId ?? r.issue_id ?? "").toLowerCase();
    const uid = String(r.userId ?? r.userid ?? r.uid ?? "").toLowerCase();
    const platform = String(r.platform ?? "").toLowerCase();
    const issueType = String(r.issueType ?? r.issuetype ?? "").toLowerCase();
    const note = String(r.note ?? "").toLowerCase();
    if (field === "issue-id") return issueId.includes(query);
    if (field === "uid") return uid.includes(query);
    if (field === "platform") return platform.includes(query);
    if (field === "issue-type") return issueType.includes(query);
    if (field === "note") return note.includes(query);
    return issueId.includes(query) || uid.includes(query) || platform.includes(query) || issueType.includes(query) || note.includes(query);
  });
}

function getRowsForCurrentView() {
  if (currentView === "ongoing") {
    return cachedOngoingIssues;
  }
  const sourceRows = getFilteredIssues();
  if (currentView === "top-users") {
    return getFilteredTopUsers();
  }
  return sourceRows;
}

function renderCurrentPage() {
  const rows = getRowsForCurrentView();
  const all = getFilteredIssues();
  if (currentView === "ongoing") {
    setSummaryCards(buildOngoingSummary(cachedOngoingIssues));
  } else if (currentView === "top-users") {
    setSummaryCards(buildRiskSummary(cachedTopUsers));
  } else {
    const totalForIssues = currentView === "issues" ? issuesTotalCount : all.length;
    setSummaryCards(buildIssueSummary(all, totalForIssues));
  }
  const issuesTotal = currentView === "issues"
    ? (isServerPagedIssues ? Math.max(issuesTotalCount, rows.length) : rows.length)
    : rows.length;
  const total = issuesTotal;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (currentView === "top-users") {
    if (topUsersPage > totalPages) topUsersPage = totalPages;
  } else {
    if (currentPage > totalPages) currentPage = totalPages;
  }
  const activePage = currentView === "top-users" ? topUsersPage : currentPage;
  const start = (activePage - 1) * pageSize;
  const pageRows = currentView === "issues"
    ? (isServerPagedIssues ? rows : rows.slice(start, start + pageSize))
    : rows.slice(start, start + pageSize);

  pageInfoEl.textContent = `Page ${currentPage} / ${totalPages}`;
  pagePrevEl.disabled = currentView === "top-users" || currentPage <= 1;
  pageNextEl.disabled = currentView === "top-users" || currentPage >= totalPages;
  pagePrevEl.classList.toggle("opacity-50", pagePrevEl.disabled);
  pageNextEl.classList.toggle("opacity-50", pageNextEl.disabled);
  if (topPageInfoEl) topPageInfoEl.textContent = `Page ${activePage} / ${totalPages}`;
  if (topPagePrevEl) {
    topPagePrevEl.disabled = activePage <= 1;
    topPagePrevEl.classList.toggle("opacity-50", topPagePrevEl.disabled);
  }
  if (topPageNextEl) {
    topPageNextEl.disabled = activePage >= totalPages;
    topPageNextEl.classList.toggle("opacity-50", topPageNextEl.disabled);
  }

  if (currentView === "top-users") {
    renderRiskFilterButtons();
    renderRiskSummary(cachedTopUsers);
    filtersSection?.classList.add("hidden");
    summaryCardsSection?.classList.remove("hidden");
    riskCenterSummaryEl?.classList.add("hidden");
    newIssueSection.classList.add("hidden");
    manageSection.classList.add("hidden");
    paginationEl.classList.add("hidden");
    topUsersPaginationEl?.classList.remove("hidden");
    issuesSection.classList.add("hidden");
    topUsersSection.classList.remove("hidden");
    renderTopUsers(pageRows);
    viewLabel.textContent = "View: Top Users";
    setStatus(`Loaded ${total} top-user rows.`);
    writeUrlState();
    return;
  }

  if (currentView === "new") {
    filtersSection?.classList.add("hidden");
    summaryCardsSection?.classList.add("hidden");
    riskCenterSummaryEl?.classList.add("hidden");
    topUsersSection.classList.add("hidden");
    issuesSection.classList.add("hidden");
    manageSection.classList.add("hidden");
    newIssueSection.classList.remove("hidden");
    paginationEl.classList.add("hidden");
    topUsersPaginationEl?.classList.add("hidden");
    viewLabel.textContent = "View: New Issue";
    setStatus("");
    writeUrlState();
    return;
  }

  filtersSection?.classList.remove("hidden");
  summaryCardsSection?.classList.remove("hidden");
  riskCenterSummaryEl?.classList.add("hidden");
  topUsersSection.classList.add("hidden");
  issuesSection.classList.remove("hidden");
  newIssueSection.classList.add("hidden");
  manageSection.classList.add("hidden");
  paginationEl.classList.remove("hidden");
  topUsersPaginationEl?.classList.add("hidden");
  renderRows(pageRows);
  if (currentView === "ongoing") {
    viewLabel.textContent = "View: Ongoing Issues";
    setStatus(`Loaded ${total} ongoing issue(s).`);
  } else {
    viewLabel.textContent = "View: Issues";
    setStatus(`Loaded ${total} issue(s).`);
  }
  writeUrlState();
}

function applyView(resetPage = true) {
  if (resetPage) {
    if (currentView === "top-users") {
      topUsersPage = 1;
    } else {
      currentPage = 1;
    }
  }
  syncMenuActive();
  renderCurrentPage();
}

async function loadIssues(searchUuid = "") {
  setError("");
  const { itURL, itAPI } = await getConfig();
  if (!itURL || !itAPI) {
    setError("Missing IssueTracker API URL or API key. Set them in extension options.");
    renderRows([]);
    return;
  }
  setStatus("Loading issues...");
  const isSearch = !!searchUuid;
  const url = isSearch
    ? apiUrl(itURL, "/search_issue", itAPI, `issue=${encodeURIComponent(searchUuid)}&page=${currentPage}&pageSize=${pageSize}`)
    : apiUrl(itURL, "/list", itAPI, `page=${currentPage}&pageSize=${pageSize}`);
  try {
    isServerPagedIssues = true;
    const data = await callJSON(url, { method: isSearch ? "POST" : "GET" });
    if (Array.isArray(data)) {
      cachedIssues = data;
      issuesTotalCount = data.length;
    } else {
      cachedIssues = Array.isArray(data?.items) ? data.items : [];
      issuesTotalCount = Number(data?.total ?? cachedIssues.length) || 0;
    }
    applyView(false);
  } catch (err) {
    setError(`Failed to load issues: ${err.message}`);
    renderRows([]);
    setStatus("");
  }
}

async function loadIssuesForClientSearch(field, query) {
  setError("");
  const { itURL, itAPI } = await getConfig();
  if (!itURL || !itAPI) {
    setError("Missing IssueTracker API URL or API key. Set them in extension options.");
    cachedIssues = [];
    issuesTotalCount = 0;
    applyView(false);
    return;
  }
  setStatus("Searching issues...");
  try {
    const data = await callJSON(apiUrl(itURL, "/list", itAPI), { method: "GET" });
    const allRows = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
    cachedIssues = filterRowsByField(allRows, field, query);
    issuesTotalCount = cachedIssues.length;
    isServerPagedIssues = false;
    currentPage = 1;
    applyView(false);
  } catch (err) {
    setError(`Search failed: ${err.message}`);
    cachedIssues = [];
    issuesTotalCount = 0;
    applyView(false);
  }
}

async function loadTopUsers() {
  setError("");
  const { itURL, itAPI } = await getConfig();
  if (!itURL || !itAPI) {
    setError("Missing IssueTracker API URL or API key. Set them in extension options.");
    cachedTopUsers = [];
    applyView();
    return;
  }
  setStatus("Loading top users by MRR...");
  try {
    const data = await callJSON(apiUrl(itURL, "/top_users_mrr", itAPI), { method: "GET" });
    cachedTopUsers = Array.isArray(data) ? data : [];
    applyView();
  } catch (err) {
    setError(`Failed to load top users: ${err.message}`);
    cachedTopUsers = [];
    applyView();
  }
}

async function loadOngoingIssues() {
  setError("");
  const { itURL, itAPI } = await getConfig();
  if (!itURL || !itAPI) {
    setError("Missing IssueTracker API URL or API key. Set them in extension options.");
    cachedOngoingIssues = [];
    applyView();
    return;
  }
  setStatus("Loading ongoing issues...");
  try {
    const data = await callJSON(apiUrl(itURL, "/ongoing_issues", itAPI), { method: "GET" });
    cachedOngoingIssues = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
    applyView();
  } catch (err) {
    setError(`Failed to load ongoing issues: ${err.message}`);
    cachedOngoingIssues = [];
    applyView();
  }
}

async function setOngoingIssue(uuid, risk, active) {
  const { itURL, itAPI } = await getConfig();
  return callJSON(apiUrl(itURL, "/ongoing_issue", itAPI), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uuid: Number(uuid), risk: Number(risk || 1), active: !!active }),
  });
}

async function reloadIssuesForCurrentContext() {
  if (currentView === "ongoing") {
    await loadOngoingIssues();
    return;
  }
  if (activeFilter.field === "issue-id" && activeFilter.query) {
    await loadIssues(activeFilter.query);
    return;
  }
  if (activeFilter.query) {
    await loadIssuesForClientSearch(activeFilter.field, activeFilter.query);
    return;
  }
  await loadIssues("");
}

async function updateTopRisk(topUser, risk) {
  const { itURL, itAPI } = await getConfig();
  return callJSON(apiUrl(itURL, "/top_risk", itAPI), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: String(topUser.userId || "").trim(),
      userName: String(topUser.userName || "").trim(),
      email: String(topUser.email || "").trim(),
      mrr: Number(topUser.mrr || 0),
      risk: Number(risk || 0),
    }),
  });
}

async function syncTopRisk() {
  const { itURL, itAPI } = await getConfig();
  return callJSON(apiUrl(itURL, "/top_risk/sync", itAPI), {
    method: "POST",
  });
}

async function solveIssue(uuid, result) {
  const { itURL, itAPI } = await getConfig();
  await callJSON(apiUrl(itURL, "/issue", itAPI), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uuid: Number(uuid), result }),
  });
}

async function deleteIssue(uuid) {
  const { itURL, itAPI } = await getConfig();
  await callJSON(apiUrl(itURL, "/issue", itAPI, `uuid=${encodeURIComponent(uuid)}`), {
    method: "DELETE",
  });
}

async function updateNote(uuid, note) {
  const { itURL, itAPI } = await getConfig();
  await callJSON(apiUrl(itURL, "/note", itAPI), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uuid: Number(uuid), note }),
  });
}

document.getElementById("refresh-btn").addEventListener("click", async () => {
  activeFilter = {
    field: searchFieldEl?.value || "issue-id",
    query: "",
  };
  searchInput.value = "";
  if (currentView === "top-users") {
    await loadTopUsers();
    return;
  }
  await loadIssues("");
});

document.getElementById("search-btn").addEventListener("click", async () => {
  activeFilter = {
    field: searchFieldEl?.value || "issue-id",
    query: searchInput.value.trim(),
  };
  if (activeFilter.field === "issue-id" && activeFilter.query) {
    currentPage = 1;
    await loadIssues(activeFilter.query);
    return;
  }
  if (activeFilter.query) {
    await loadIssuesForClientSearch(activeFilter.field, activeFilter.query);
    return;
  }
  isServerPagedIssues = true;
  await loadIssues("");
});

document.getElementById("open-options").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById("menu-issues").addEventListener("click", async () => {
  currentView = "issues";
  isServerPagedIssues = true;
  activeFilter = { field: "issue-id", query: "" };
  if (searchFieldEl) searchFieldEl.value = "issue-id";
  if (searchInput) {
    searchInput.value = "";
    searchInput.disabled = false;
    searchInput.placeholder = "Search by Issue ID";
  }
  await loadIssues("");
});

document.getElementById("menu-new").addEventListener("click", () => {
  currentView = "new";
  applyView();
});

document.getElementById("menu-ongoing").addEventListener("click", async () => {
  currentView = "ongoing";
  await loadOngoingIssues();
});

document.getElementById("menu-top-users").addEventListener("click", async () => {
  currentView = "top-users";
  topUsersPage = 1;
  activeRiskFilter = "all";
  await loadTopUsers();
});

document.getElementById("risk-filter-all")?.addEventListener("click", () => {
  activeRiskFilter = "all";
  renderCurrentPage();
});
document.getElementById("risk-filter-high")?.addEventListener("click", () => {
  activeRiskFilter = "high";
  renderCurrentPage();
});
document.getElementById("risk-filter-low")?.addEventListener("click", () => {
  activeRiskFilter = "low";
  renderCurrentPage();
});
document.getElementById("risk-filter-medium")?.addEventListener("click", () => {
  activeRiskFilter = "medium";
  renderCurrentPage();
});
document.getElementById("risk-filter-very-high")?.addEventListener("click", () => {
  activeRiskFilter = "very-high";
  renderCurrentPage();
});
document.getElementById("risk-filter-none")?.addEventListener("click", () => {
  activeRiskFilter = "none";
  renderCurrentPage();
});

document.getElementById("sync-top-risk")?.addEventListener("click", async () => {
  try {
    setError("");
    setStatus("Syncing top users to top_risk...");
    const resp = await syncTopRisk();
    await loadTopUsers();
    setStatus(`Synced ${resp?.synced ?? 0} top users to top_risk.`);
  } catch (err) {
    setError(`Sync failed: ${err.message}`);
  }
});

if (searchFieldEl) {
  searchFieldEl.addEventListener("change", () => {
    if (searchFieldEl.value === "unsolved") {
      searchInput.value = "";
      searchInput.disabled = true;
      searchInput.placeholder = "No value needed for Not Solved";
    } else if (searchFieldEl.value === "issue-id") {
      searchInput.disabled = false;
      searchInput.placeholder = "Search by Issue ID";
    } else if (searchFieldEl.value === "uid") {
      searchInput.disabled = false;
      searchInput.placeholder = "Search by UID";
    } else if (searchFieldEl.value === "platform") {
      searchInput.disabled = false;
      searchInput.placeholder = "Search by platform";
    } else if (searchFieldEl.value === "issue-type") {
      searchInput.disabled = false;
      searchInput.placeholder = "Search by issue type";
    } else if (searchFieldEl.value === "note") {
      searchInput.disabled = false;
      searchInput.placeholder = "Search by note text";
    } else {
      searchInput.disabled = false;
      searchInput.placeholder = "Search value";
    }
  });
}

pageSizeEl.addEventListener("change", () => {
  pageSize = Math.max(1, Number(pageSizeEl.value) || 20);
  currentPage = 1;
  if (currentView === "issues" && isServerPagedIssues) {
    loadIssues(activeFilter.field === "issue-id" ? activeFilter.query : "");
    return;
  }
  renderCurrentPage();
});

pagePrevEl.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage -= 1;
    if (currentView === "issues" && isServerPagedIssues) {
      loadIssues(activeFilter.field === "issue-id" ? activeFilter.query : "");
      return;
    }
    renderCurrentPage();
  }
});

pageNextEl.addEventListener("click", () => {
  currentPage += 1;
  if (currentView === "issues" && isServerPagedIssues) {
    loadIssues(activeFilter.field === "issue-id" ? activeFilter.query : "");
    return;
  }
  renderCurrentPage();
});

topPagePrevEl?.addEventListener("click", () => {
  if (topUsersPage > 1) {
    topUsersPage -= 1;
    renderCurrentPage();
  }
});

topPageNextEl?.addEventListener("click", () => {
  topUsersPage += 1;
  renderCurrentPage();
});

topUsersBody.addEventListener("change", async (event) => {
  const select = event.target.closest("select[data-action='risk-select']");
  if (!select) return;
  const userId = String(select.dataset.userId || "").trim();
  if (!userId) return;
  const risk = Number(select.value || 0);
  const topUser = cachedTopUsers.find((u) => String(u.userId) === userId);
  if (!topUser) return;
  try {
    const resp = await updateTopRisk(topUser, risk);
    topUser.risk = risk;
    await loadTopUsers();
    setStatus(`Risk ${risk} saved for user ${userId} -> ${resp?.table || "?"}.${resp?.riskColumn || "?"}`);
  } catch (err) {
    setError(`Risk update failed: ${err.message}`);
  }
});

issuesBody.addEventListener("click", async (event) => {
  const target = event.target.closest(".action-btn");
  if (!target) return;
  const action = target.dataset.action;
  const issueId = target.dataset.issueId;
  if (!issueId) return;

  if (action === "manage") {
    const issuePool = [...cachedIssues, ...cachedOngoingIssues];
    selectedIssue =
      issuePool.find(
        (r) =>
          String(r.uuid ?? r.UUID ?? r.id ?? r.issueId ?? r.issue_id ?? "") === String(issueId)
      ) || null;
    if (!selectedIssue) return;
    document.getElementById("manage-title").textContent = `Manage Issue #${issueId}`;
    document.getElementById("manage-uuid").value = String(issueId);
    document.getElementById("manage-user").value = selectedIssue.userName ?? selectedIssue.username ?? "";
    document.getElementById("manage-note").value = selectedIssue.note ?? "";
    const ongoingRisk = Number(selectedIssue.ongoingRisk ?? selectedIssue.ongoingrisk ?? 1);
    const riskEl = document.getElementById("manage-ongoing-risk");
    if (riskEl) riskEl.value = String(Math.min(4, Math.max(1, ongoingRisk || 1)));
    const toggleBtn = document.getElementById("manage-toggle-ongoing");
    const inOngoing = isOngoingIssue(selectedIssue);
    if (toggleBtn) {
      toggleBtn.textContent = inOngoing ? "Remove From Ongoing" : "Move To Ongoing";
    }
    const solved = String(selectedIssue.solved ?? "").toLowerCase() === "true";
    const solvedBy = String(selectedIssue.solvedBy ?? selectedIssue.solvedby ?? "").toLowerCase();
    const alreadyResolved = solved || solvedBy === "dev" || solvedBy === "supp";
    const solveDevBtn = document.getElementById("manage-solve-dev");
    const solveSuppBtn = document.getElementById("manage-solve-supp");
    if (solveDevBtn) solveDevBtn.classList.toggle("hidden", alreadyResolved);
    if (solveSuppBtn) solveSuppBtn.classList.toggle("hidden", alreadyResolved);
    manageSection.classList.remove("hidden");
    manageSection.classList.add("flex");
  }
});

document.getElementById("manage-close").addEventListener("click", () => {
  manageSection.classList.remove("flex");
  manageSection.classList.add("hidden");
});

document.getElementById("manage-toggle-ongoing").addEventListener("click", async () => {
  if (!selectedIssue) return;
  try {
    const uuid = selectedIssue.uuid ?? selectedIssue.UUID;
    const risk = Number(document.getElementById("manage-ongoing-risk").value || 1);
    const inOngoing = isOngoingIssue(selectedIssue);
    await setOngoingIssue(uuid, risk, !inOngoing);
    if (inOngoing) {
      selectedIssue.ongoingRisk = 0;
    } else {
      selectedIssue.ongoingRisk = risk;
    }
    if (currentView === "ongoing") {
      await loadOngoingIssues();
    } else {
      await loadIssues(searchInput.value.trim());
    }
    const toggleBtn = document.getElementById("manage-toggle-ongoing");
    if (toggleBtn) toggleBtn.textContent = inOngoing ? "Move To Ongoing" : "Remove From Ongoing";
    setStatus(inOngoing ? "Removed from ongoing issues." : "Moved to ongoing issues.");
  } catch (err) {
    setError(`Ongoing action failed: ${err.message}`);
  }
});

document.getElementById("manage-save-note").addEventListener("click", async () => {
  if (!selectedIssue) return;
  try {
    await updateNote(selectedIssue.uuid ?? selectedIssue.UUID, document.getElementById("manage-note").value);
    await reloadIssuesForCurrentContext();
  } catch (err) {
    setError(`Action failed: ${err.message}`);
  }
});

document.getElementById("manage-solve-dev").addEventListener("click", async () => {
  if (!selectedIssue) return;
  try {
    await solveIssue(selectedIssue.uuid ?? selectedIssue.UUID, "Dev");
    await reloadIssuesForCurrentContext();
  } catch (err) {
    setError(`Action failed: ${err.message}`);
  }
});

document.getElementById("manage-solve-supp").addEventListener("click", async () => {
  if (!selectedIssue) return;
  try {
    await solveIssue(selectedIssue.uuid ?? selectedIssue.UUID, "Supp");
    await reloadIssuesForCurrentContext();
  } catch (err) {
    setError(`Action failed: ${err.message}`);
  }
});

document.getElementById("manage-delete").addEventListener("click", async () => {
  if (!selectedIssue) return;
  const uuid = selectedIssue.uuid ?? selectedIssue.UUID;
  if (!confirm(`Delete issue ${uuid}?`)) return;
  try {
    await deleteIssue(uuid);
    manageSection.classList.add("hidden");
    await reloadIssuesForCurrentContext();
  } catch (err) {
    setError(`Action failed: ${err.message}`);
  }
});

document.getElementById("new-issue-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  setError("");
  try {
    const { itURL, itAPI } = await getConfig();
    const extCfg = await new Promise((resolve) => {
      chrome.storage.local.get(["username"], (cfg) => resolve(cfg));
    });
    const payload = {
      uid: document.getElementById("new-uid").value.trim(),
      agentName: (extCfg.username || "extension_user").trim(),
      module: document.getElementById("new-module").value.trim(),
      platform: document.getElementById("new-platform").value.trim(),
      ticketid: document.getElementById("new-ticketid").value.trim(),
      solved: "false",
      platformlink: document.getElementById("new-platformlink").value.trim(),
      note: document.getElementById("new-note").value.trim(),
      escalated: document.getElementById("new-escalated").checked,
      agentVer: null,
      qori: document.getElementById("new-qori").value,
      inTrial: document.getElementById("new-intrial").checked ? 1 : 0,
    };
    await callJSON(apiUrl(itURL, "/issue", itAPI), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    currentView = "issues";
    await loadIssues("");
  } catch (err) {
    setError(`Create failed: ${err.message}`);
  }
});

const newPlatformEl = document.getElementById("new-platform");
if (newPlatformEl) {
  newPlatformEl.addEventListener("change", updateNewPlatformPreview);
}

document.addEventListener("DOMContentLoaded", async () => {
  updateNewPlatformPreview();
  const initial = readUrlState();
  currentView = ["issues", "new", "ongoing", "top-users"].includes(initial.view) ? initial.view : "issues";
  currentPage = initial.page;
  pageSize = initial.pageSize;
  if (pageSizeEl) {
    pageSizeEl.value = String(pageSize);
  }
  activeRiskFilter = ["all", "none", "low", "medium", "high", "very-high"].includes(initial.risk) ? initial.risk : "all";
  activeFilter = {
    field: initial.searchField,
    query: initial.search,
  };
  if (searchFieldEl) searchFieldEl.value = activeFilter.field;
  if (searchInput) searchInput.value = activeFilter.query;

  if (currentView === "top-users") {
    await loadTopUsers();
  } else if (currentView === "ongoing") {
    await loadOngoingIssues();
  } else {
    const issueSearch = activeFilter.field === "issue-id" ? activeFilter.query : "";
    await loadIssues(issueSearch);
  }
  currentPage = initial.page;
  renderCurrentPage();
});
