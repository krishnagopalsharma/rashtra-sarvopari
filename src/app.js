import { siteData } from "./data.js";

const loader = document.querySelector("#cinemaLoader");
const introStatus = document.querySelector("#introStatus");
const areaSearch = document.querySelector("#areaSearch");
const stateInput = document.querySelector("#stateInput");
const districtInput = document.querySelector("#districtInput");
const areaInput = document.querySelector("#areaInput");
const pinInput = document.querySelector("#pinInput");
const areaViewTitle = document.querySelector("#areaViewTitle");
const heritageTitle = document.querySelector("#heritageTitle");
const politicalHistoryTitle = document.querySelector("#historyTitle");
const filterNote = document.querySelector("#filterNote");
const areaMapCard = document.querySelector("#areaMapCard");
const areaGallery = document.querySelector("#areaGallery");
const assemblyList = document.querySelector("#assemblyList");
const winnerTimeline = document.querySelector("#winnerTimeline");
const issueGrid = document.querySelector("#issueGrid");
const statusBoard = document.querySelector("#statusBoard");
const languageToggle = document.querySelector("#languageToggle");
const feedbackForm = document.querySelector("#report");
const reportArea = document.querySelector("#reportArea");
const categoryInput = feedbackForm?.querySelector("select");
const locationButton = document.querySelector("#locationButton");
const clearButton = document.querySelector("#clearButton");
const openBoardButton = areaSearch?.querySelector(".primary-action");
const mvpRegionNotice = document.querySelector("#mvpRegionNotice");
const dashboardSections = [...document.querySelectorAll("[data-dashboard-section]")];
const citizenAccountForm = document.querySelector("#citizenAccountForm");
const netaAccountForm = document.querySelector("#netaAccountForm");
const citizenAccountStatus = document.querySelector("#citizenAccountStatus");
const netaAccountStatus = document.querySelector("#netaAccountStatus");
const galleryLightbox = document.querySelector("#galleryLightbox");
const lightboxImage = document.querySelector("#lightboxImage");
const lightboxTitle = document.querySelector("#lightboxTitle");
const lightboxDescription = document.querySelector("#lightboxDescription");
const lightboxClose = document.querySelector("#lightboxClose");
const accountButton = document.querySelector("#accountButton");
const accountShell = document.querySelector(".account-shell");
const profileMenu = document.querySelector("#profileMenu");
const profileUsername = document.querySelector("#profileUsername");
const profileAvatar = document.querySelector("#profileAvatar");
const profileVotes = document.querySelector("#profileVotes");
const profileOpinions = document.querySelector("#profileOpinions");
const avatarInput = document.querySelector("#avatarInput");
const profileLogout = document.querySelector("#profileLogout");
const accountModal = document.querySelector("#accountModal");
const accountModalClose = document.querySelector("#accountModalClose");
const quickAccountForm = document.querySelector("#quickAccountForm");
const slideReportForm = document.querySelector("#slideReportForm");
const slideReportStatus = document.querySelector("#slideReportStatus");

let currentLanguage = "en";
let showDashboard = false;
let verifiedNetaUnlocked = localStorage.getItem("rashtraVerifiedNeta") === "true";
let currentUser = null;
let latestVoteData = [];

const t = (key) => siteData.language[currentLanguage]?.[key] || siteData.language.en[key] || key;
const translateStatus = (status) => siteData.language[currentLanguage]?.status?.[status] || status;
const translateCategory = (category) => siteData.language[currentLanguage]?.categories?.[category] || category;
const mvpRegion = siteData.defaultArea;
const userStorageKey = "rashtra_user";
const authTokenKey = "rashtra_auth_token";
let authToken = localStorage.getItem(authTokenKey) || "";
const usernamePattern = /^[a-z0-9._]+$/;

const readJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const apiRequest = async (path, options = {}) => {
  const headers = {
    "content-type": "application/json",
    ...(options.headers || {}),
  };

  if (authToken) headers.authorization = `Bearer ${authToken}`;

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.message || "Server request failed.");
  }

  return payload;
};

const updateAccountButton = () => {
  accountButton?.classList.toggle("is-logged-in", Boolean(currentUser));
  if (!accountButton) return;
  accountButton.textContent = currentUser ? `@${currentUser.username}` : "Login / Create Account";
  accountButton.setAttribute(
    "aria-label",
    currentUser ? "Open citizen profile" : "Login or create citizen account",
  );
  renderProfileMenu();
};

const loadCurrentUser = () => {
  currentUser = readJson(userStorageKey, null);
  if (currentUser && !currentUser.username) {
    logoutUser();
    return null;
  }
  updateAccountButton();
  return currentUser;
};

const persistSession = ({ token, user }) => {
  authToken = token;
  currentUser = user;
  localStorage.setItem(authTokenKey, token);
  writeJson(userStorageKey, user);
  updateAccountButton();
};

const logoutUser = () => {
  authToken = "";
  currentUser = null;
  localStorage.removeItem(authTokenKey);
  localStorage.removeItem(userStorageKey);
  updateAccountButton();
  if (profileMenu) profileMenu.hidden = true;
};

const authenticateUser = ({ username, password }) =>
  apiRequest("/.netlify/functions/auth", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

const updateAvatar = (avatar) =>
  apiRequest("/.netlify/functions/auth", {
    method: "POST",
    body: JSON.stringify({ action: "updateAvatar", avatar }),
  });

const renderProfileMenu = () => {
  if (!profileMenu || !profileUsername || !profileAvatar) return;
  if (!currentUser) {
    profileMenu.hidden = true;
    return;
  }
  profileUsername.textContent = `@${currentUser.username}`;
  profileVotes.textContent = currentUser.totalVotes || 0;
  profileOpinions.textContent = currentUser.totalOpinions || 0;
  if (currentUser.avatar) {
    profileAvatar.innerHTML = `<img src="${currentUser.avatar}" alt="${currentUser.username} avatar" />`;
  } else {
    profileAvatar.textContent = currentUser.username.slice(0, 2).toUpperCase();
  }
};

const validateUsernameValue = (username) => {
  const clean = username.toLowerCase().trim();
  if (!usernamePattern.test(clean)) {
    return {
      ok: false,
      username: clean,
      message: "Username me sirf lowercase letters, numbers, underscore (_) aur period (.) allowed hain.",
    };
  }
  return { ok: true, username: clean };
};

const loadCitizenIssues = async (area) => {
  const params = new URLSearchParams({ area });
  const result = await apiRequest(`/.netlify/functions/issues?${params.toString()}`, {
    method: "GET",
  });
  return result.issues || [];
};

const selectedIssueContext = () => {
  const selectedArea = areaInput.value || mvpRegion.focus;
  const selectedAreaMeta = siteData.areaOptions.find((area) => area.name === selectedArea);
  return {
    area: selectedArea,
    pin: selectedAreaMeta?.pin || pinInput.value || mvpRegion.pin,
  };
};

const escapeHtml = (value) =>
  value
    .toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const readImageAsDataUrl = (file, maxBytes = 1600000) =>
  new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      reject(new Error("Only image files are allowed."));
      return;
    }
    if (file.size > maxBytes) {
      reject(new Error("Image too large. Please upload a smaller photo."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        name: file.name,
        type: file.type,
        dataUrl: reader.result,
      });
    reader.onerror = () => reject(new Error("Photo read failed."));
    reader.readAsDataURL(file);
  });

const introStorageKey = "rashtraSarvopariIntroSeenV6";
let introMessageTimer;

const getConnectionProfile = () => {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  if (navigator.onLine === false) {
    return {
      delay: 5200,
      message: "Internet required to sync civic data. Opening local preview...",
    };
  }

  if (connection?.saveData || ["slow-2g", "2g"].includes(connection?.effectiveType)) {
    return {
      delay: 4300,
      message: "Low internet detected. Loading dashboard carefully...",
    };
  }

  if (connection?.effectiveType === "3g") {
    return {
      delay: 3400,
      message: "Optimizing for slower internet...",
    };
  }

  return {
    delay: 2400,
    message: "Synchronizing national civic data...",
  };
};

const setIntroStatus = (message) => {
  if (introStatus) introStatus.textContent = message;
};

const startIntroStatusLoop = () => {
  const profile = getConnectionProfile();
  const messages = [
    "Checking secure connection...",
    profile.message,
    "Preparing Rashtra Sarvopari dashboard...",
  ];
  let index = 0;
  setIntroStatus(messages[index]);
  window.clearInterval(introMessageTimer);
  introMessageTimer = window.setInterval(() => {
    index = (index + 1) % messages.length;
    setIntroStatus(messages[index]);
  }, 760);
};

const hasSeenIntro = () => {
  try {
    return sessionStorage.getItem(introStorageKey) === "true";
  } catch {
    return false;
  }
};

const markIntroSeen = () => {
  try {
    sessionStorage.setItem(introStorageKey, "true");
  } catch {}
};

const hideLoader = () => {
  if (!loader) return;
  window.clearInterval(introMessageTimer);
  markIntroSeen();
  loader.classList.add("is-hidden");
  document.body.classList.remove("no-scroll");
  document.body.classList.add("is-ready");
  window.setTimeout(() => {
    loader.style.display = "none";
  }, 650);
};

if (loader && !hasSeenIntro()) {
  document.body.classList.add("no-scroll");
  startIntroStatusLoop();
  const queueIntroExit = () => {
    const { delay, message } = getConnectionProfile();
    setIntroStatus(message);
    window.setTimeout(hideLoader, Math.max(2200, delay));
  };
  if (document.readyState === "complete") {
    queueIntroExit();
  } else {
    window.addEventListener("load", queueIntroExit, { once: true });
  }
} else {
  if (loader) loader.style.display = "none";
  document.body.classList.remove("no-scroll");
  document.body.classList.add("is-ready");
}

window.addEventListener("online", () => setIntroStatus("Connection restored. Syncing civic data..."));
window.addEventListener("offline", () => setIntroStatus("Internet required to sync civic data."));

const mathuraTehsilNames = siteData.mathuraTehsils || ["Govardhan", "Vrindavan", "Mant", "Chhata", "Baldeo"];

const areaOptionsMarkup = (areas = siteData.areaOptions) =>
  `<option value="">${t("selectArea")}</option>` +
  areas
    .map((area) => `<option value="${area.name}" data-pin="${area.pin}">${area.name}</option>`)
    .join("");

const mathuraTehsilOptions = () =>
  mathuraTehsilNames
    .map((name) => siteData.areaOptions.find((area) => area.name === name))
    .filter(Boolean);

const districtOptionsMarkup = () =>
  `<option value="">${t("selectDistrict")}</option>` +
  siteData.upDistricts.map((district) => `<option value="${district}">${district}</option>`).join("");

const renderDistrictOptions = (selectedValue = districtInput.value) => {
  districtInput.innerHTML = districtOptionsMarkup();
  if (selectedValue && siteData.upDistricts.includes(selectedValue)) {
    districtInput.value = selectedValue;
  }
};

const renderAreaOptions = (selectedValue = "") => {
  const options = areaOptionsMarkup(mathuraTehsilOptions());
  areaInput.innerHTML = options;
  reportArea.innerHTML = options;
  areaInput.value = selectedValue && mathuraTehsilNames.includes(selectedValue) ? selectedValue : "";
  reportArea.value = "";
  if (!areaInput.value) pinInput.value = "";
};

const setSelectLocked = (select, locked) => {
  select.disabled = locked;
  select.closest("label")?.classList.toggle("is-locked", locked);
};

const syncDropdownChain = ({ preserveArea = false } = {}) => {
  const stateSelected = Boolean(stateInput.value);
  const districtSelected = Boolean(districtInput.value);
  const districtIsMathura = districtInput.value === mvpRegion.district;
  const currentArea = preserveArea ? areaInput.value : "";

  setSelectLocked(districtInput, !stateSelected);
  setSelectLocked(areaInput, !stateSelected || !districtSelected || !districtIsMathura);

  if (!stateSelected) {
    districtInput.value = "";
    renderAreaOptions();
    pinInput.value = "";
    return;
  }

  if (!districtSelected || !districtIsMathura) {
    renderAreaOptions();
    pinInput.value = "";
    return;
  }

  renderAreaOptions(currentArea);
};

const renderCategoryOptions = () => {
  const selects = [categoryInput, slideReportForm?.querySelector('[name="category"]')].filter(Boolean);
  if (!selects.length) return;
  const options = siteData.issueCategories
    .map((category) => `<option value="${category}">${translateCategory(category)}</option>`)
    .join("");
  selects.forEach((select) => {
    const selectedValue = select.value;
    select.innerHTML = options;
    if (selectedValue) select.value = selectedValue;
  });
};

const renderAssembly = () => {
  const govardhanSeat =
    siteData.assemblySeats.find((seat) => seat.name === mvpRegion.focus) || siteData.assemblySeats[0];
  const affidavit = siteData.govardhanAffidavit;
  const verifiedBadge = verifiedNetaUnlocked
    ? '<span class="verified-badge">Verified Neta</span>'
    : '<span class="verified-badge is-pending">Docs pending</span>';

  assemblyList.innerHTML = `
    <div class="representative-hierarchy reveal">
      <article class="state-node">
        <span class="tier-label">State Node</span>
        <strong>${siteData.stateLeadership.title}</strong>
        <p>${siteData.stateLeadership.summary}</p>
        <div class="node-pills">
          ${siteData.stateLeadership.points.map((point) => `<span>${point}</span>`).join("")}
        </div>
      </article>

      <article class="tehsil-node assembly-card">
        <div class="node-head">
          <span class="tier-label">Tehsil Node | Assembly #${govardhanSeat.seatNo}</span>
          ${verifiedBadge}
        </div>
        <h3>${govardhanSeat.name} MLA</h3>
        <p class="leader-name">${govardhanSeat.mla}</p>
        <p>${govardhanSeat.party} | ${govardhanSeat.note}</p>
        <p>${govardhanSeat.detail}</p>
        <div class="affidavit-tabs" role="tablist" aria-label="Govardhan MLA details">
          <button type="button" class="affidavit-tab is-active" data-tab="summary">Affidavit Summary</button>
          <button type="button" class="affidavit-tab" data-tab="assets">Asset Details</button>
          <button type="button" class="affidavit-tab" data-tab="contact">Public Contact</button>
        </div>
        <div class="affidavit-panel" id="affidavitPanel">${affidavit.summary}</div>
        <div class="mla-official-links">
          <a class="mla-link mla-link-green" href="https://mlaladsup.in/" target="_blank" rel="noopener noreferrer">MLA Work Record (Govt. Web)</a>
          <a class="mla-link mla-link-orange" href="https://www.myneta.info/uttarpradesh2022/candidate.php?candidate_id=68" target="_blank" rel="noopener noreferrer">Check Official Affidavit (Govt. Verified)</a>
        </div>
      </article>
    </div>
  `;
};
const renderTimeline = () => {
  winnerTimeline.innerHTML = siteData.lokSabha.winners
    .map(
      (item) => `
        <article class="timeline-item reveal">
          <span>${t("lokSabhaResult")}</span>
          <strong>${item.year}</strong>
          <h3>${item.winner}</h3>
          <p>${item.party} | ${item.note}</p>
        </article>
      `,
    )
    .join("");
};

const renderIssues = () => {
  const topIssues = siteData.govardhanTopIssues || [];
  issueGrid.innerHTML = topIssues
    .map(
      (issue) => `
        <article class="issue-card priority-card reveal" data-issue-key="${issue.key}" data-category="${issue.title}">
          <span>Govardhan critical issue</span>
          <strong>${issue.title}</strong>
          <p>${issue.description}</p>
          <div class="vote-row">
            <button class="vote-action" type="button" data-vote-key="${issue.key}" data-title="${issue.title}">Vote for this Issue</button>
            <b id="vote-count-${issue.key}">0 votes</b>
          </div>
          <div class="voter-feed" id="voter-feed-${issue.key}">No citizen votes yet.</div>
        </article>
      `,
    )
    .join("");
  renderVotes();
};

const renderStatusBoard = async (selectedArea = siteData.defaultArea.focus, selectedPin = siteData.defaultArea.pin) => {
  let filteredIssues = [];

  try {
    const result = await apiRequest(`/.netlify/functions/issues?${new URLSearchParams({ area: selectedArea }).toString()}`, {
      method: "GET",
    });
    filteredIssues = result.issues || [];
    latestVoteData = result.votes || [];
    renderVotes();
  } catch (error) {
    statusBoard.innerHTML = `
      <article class="status-item empty-state reveal">
        <span>Netlify database</span>
        <strong>Real issue database will connect after Netlify Functions deploy.</strong>
        <p>${escapeHtml(error.message || "Backend unavailable in local static preview.")}</p>
      </article>
    `;
    return;
  }

  if (!filteredIssues.length) {
    statusBoard.innerHTML = `
      <article class="status-item empty-state reveal">
        <span>Citizen feed</span>
        <strong>No active issues reported by citizens in this area yet.</strong>
        <p>Be the first to write.</p>
      </article>
    `;
    return;
  }

  statusBoard.innerHTML = filteredIssues
    .map(
      (issue) => `
        <article class="status-item live-issue-card-real reveal">
          <span>${translateCategory(issue.category)} | ${escapeHtml(issue.area)} | ${escapeHtml(issue.pincode)}</span>
          <strong><i class="status-dot pending"></i>Live Citizen Feed</strong>
          <p>"${escapeHtml(issue.text)}"</p>
          ${
            issue.photo?.dataUrl
              ? `<img class="issue-proof" src="${issue.photo.dataUrl}" alt="Photo proof uploaded by ${escapeHtml(issue.username || "citizen")}" />`
              : ""
          }
          <small>Reported by: <b>${escapeHtml(issue.username || issue.name || "Citizen")}</b></small>
        </article>
      `,
    )
    .join("");
};

const renderVotes = () => {
  (siteData.govardhanTopIssues || []).forEach((issue) => {
    const vote = latestVoteData.find((item) => item.issueKey === issue.key);
    const countNode = document.querySelector(`#vote-count-${issue.key}`);
    const feedNode = document.querySelector(`#voter-feed-${issue.key}`);
    if (countNode) countNode.textContent = `${vote?.count || 0} votes`;
    if (feedNode) {
      const voters = (vote?.voters || []).slice(0, 4);
      feedNode.innerHTML = voters.length
        ? voters
            .map(
              (voter) => `
                <span class="voter-chip">
                  ${
                    voter.avatar
                      ? `<img src="${voter.avatar}" alt="${escapeHtml(voter.username)} avatar" />`
                      : `<i>${escapeHtml(voter.username.slice(0, 1).toUpperCase())}</i>`
                  }
                  Voted by: ${escapeHtml(voter.username)}
                </span>
              `,
            )
            .join("")
        : "No citizen votes yet.";
    }
  });
};

const openAccountModal = () => {
  if (!accountModal) return;
  accountModal.hidden = false;
  document.body.classList.add("no-scroll");
  accountModal.querySelector("input")?.focus();
};

const closeAccountModal = () => {
  if (!accountModal) return;
  accountModal.hidden = true;
  document.body.classList.remove("no-scroll");
};

const publishCitizenIssue = async ({ category, text, photo = null }) => {
  const context = selectedIssueContext();
  const result = await apiRequest("/.netlify/functions/issues", {
    method: "POST",
    body: JSON.stringify({
      category,
      text: text.trim(),
      pincode: context.pin,
      area: context.area,
      photo,
    }),
  });
  if (result.user) persistSession({ token: authToken, user: result.user });
  await renderStatusBoard(context.area, context.pin);
  setupReveal();
};

const voteForIssue = async ({ issueKey, title }) => {
  const context = selectedIssueContext();
  const result = await apiRequest("/.netlify/functions/issues", {
    method: "POST",
    body: JSON.stringify({
      action: "vote",
      issueKey,
      title,
      area: context.area,
    }),
  });
  latestVoteData = result.votes || latestVoteData;
  if (result.user) persistSession({ token: authToken, user: result.user });
  renderVotes();
};

const openOpinionBox = (category, user) => {
  const existing = document.querySelector(".opinion-modal");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.className = "opinion-modal";
  overlay.innerHTML = `
    <form class="opinion-panel">
      <button class="modal-close" type="button" aria-label="Close opinion modal">×</button>
      <span class="section-kicker">Citizen issue</span>
      <h3>Write your opinion/issue for ${escapeHtml(translateCategory(category))}</h3>
      <p>Posting as <b>${escapeHtml(user.username)}</b> | Area: ${escapeHtml(selectedIssueContext().area)}</p>
      <textarea name="opinionText" rows="5" placeholder="Yahan apni asli shikayat ya raye likhein..." required></textarea>
      <div class="opinion-actions">
        <button type="submit" class="primary-action">Live Publish Karein</button>
        <button type="button" class="ghost-action" data-cancel>Cancel</button>
      </div>
    </form>
  `;

  document.body.appendChild(overlay);
  document.body.classList.add("no-scroll");
  overlay.querySelector("textarea")?.focus();

  const close = () => {
    overlay.remove();
    document.body.classList.remove("no-scroll");
  };

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.closest(".modal-close") || event.target.closest("[data-cancel]")) {
      close();
    }
  });

  overlay.querySelector("form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = overlay.querySelector("textarea")?.value.trim();
    if (!text) return;
    const submitButton = overlay.querySelector("button[type='submit']");
    submitButton.disabled = true;
    submitButton.textContent = "Publishing...";
    try {
      await publishCitizenIssue({ category, text });
    } catch (error) {
      submitButton.disabled = false;
      submitButton.textContent = "Live Publish Karein";
      window.alert(error.message || "Issue submit nahi ho paya.");
      return;
    }
    close();
  });
};

const syncPoliticalHistoryTitle = () => {
  if (!politicalHistoryTitle) return;
  const district = districtInput.value || mvpRegion.district;
  politicalHistoryTitle.textContent =
    currentLanguage === "hi"
      ? `${district === "Mathura" ? "मथुरा" : district} निर्वाचन क्षेत्र का राजनीतिक इतिहास`
      : `${district} Constituency Political History`;
};

const placeholderMarkup = (areaName) => `
  <article class="coming-soon-card reveal">
    <span>${t("mediaUpdate")}</span>
    <strong>${t("comingSoonTitle")} ${areaName}</strong>
    <p>${t("comingSoonText")}</p>
  </article>
`;

const renderAreaMedia = (areaName) => {
  const media = siteData.areaMedia?.[areaName];
  const comingSoon = placeholderMarkup(areaName);

  if (media?.map?.src) {
    areaMapCard.innerHTML = `
      <div class="map-bento">
        <article class="map-tile map-tile-main">
          <img class="clean-map-image" src="${media.map.src}" alt="${media.map.alt || `${areaName} satellite map`}" />
          <div class="map-scrim" aria-hidden="true"></div>
          <div class="satellite-overlay">
            <strong id="activeAreaLabel">${areaName} Dashboard</strong>
            <span>${t("satelliteAttribution")} ${media.map.imageDate || "Coming soon"}</span>
          </div>
        </article>
        <article class="map-tile map-metric">
          <span>Active node</span>
          <strong>${areaName}</strong>
          <p>${mvpRegion.district}, ${mvpRegion.state}</p>
        </article>
        <article class="map-tile map-metric">
          <span>Pin code</span>
          <strong>${siteData.areaOptions.find((area) => area.name === areaName)?.pin || "Queued"}</strong>
          <p>Used as primary issue filter.</p>
        </article>
        <article class="map-tile map-metric">
          <img class="govardhan-photo-tile" src="assets/kusum-sarovar-preview.png" alt="Kusum Sarovar Govardhan" />
          <span>Govardhan ground reference</span>
          <strong>Kusum Sarovar node</strong>
          <p>Photo reference for local civic reports around the Govardhan area.</p>
        </article>
      </div>
    `;
  } else {
    areaMapCard.innerHTML = comingSoon;
  }

  if (areaGallery && media?.gallery?.length) {
    areaGallery.innerHTML = media.gallery
      .map(
        (item) => `
          <article class="gallery-card ${item.featured ? "feature" : ""} reveal" role="button" tabindex="0" data-src="${item.src}" data-title="${item.caption}" data-description="${item.description || item.alt || item.caption}">
            <img src="${item.src}" alt="${item.alt || item.caption}" />
            <span>${item.caption}</span>
          </article>
        `,
      )
      .join("");
  } else {
    if (areaGallery) areaGallery.innerHTML = comingSoon;
  }
};

const setDashboardVisible = (visible) => {
  showDashboard = visible;
  dashboardSections.forEach((section) => {
    section.hidden = !visible;
    section.classList.toggle("dashboard-enter", visible);
  });
};

const setOpenBoardDisabled = (disabled) => {
  if (!openBoardButton) return;
  openBoardButton.disabled = disabled;
  openBoardButton.setAttribute("aria-disabled", String(disabled));
};

const hideMvpNotice = () => {
  if (!mvpRegionNotice) return;
  mvpRegionNotice.classList.remove("is-visible");
  mvpRegionNotice.setAttribute("aria-hidden", "true");
  mvpRegionNotice.innerHTML = "";
};

const showMvpNotice = (message) => {
  if (!mvpRegionNotice) return;
  mvpRegionNotice.innerHTML = `
    <strong>⚠️ CURRENTLY WORK IN PROGRESS</strong>
    <span>${message}</span>
  `;
  mvpRegionNotice.classList.add("is-visible");
  mvpRegionNotice.setAttribute("aria-hidden", "false");
};

const isMvpRegionSelected = () =>
  stateInput.value === mvpRegion.state &&
  districtInput.value === mvpRegion.district &&
  areaInput.value === mvpRegion.focus;

const updateMvpRegionGate = ({ forceNotice = false, autoFillGovardhan = false } = {}) => {
  const selectedState = stateInput.value;
  const selectedDistrict = districtInput.value;
  const selectedArea = areaInput.value;

  if (autoFillGovardhan && selectedArea === mvpRegion.focus) {
    stateInput.value = mvpRegion.state;
    districtInput.value = mvpRegion.district;
    pinInput.value = mvpRegion.pin;
    syncDropdownChain({ preserveArea: true });
    areaInput.value = mvpRegion.focus;
    reportArea.value = mvpRegion.focus;
    hideMvpNotice();
    setOpenBoardDisabled(false);
    return true;
  }

  const hasSelection = Boolean(selectedState || selectedDistrict || selectedArea || pinInput.value.trim());
  const isOutsideState = Boolean(selectedState && selectedState !== mvpRegion.state);
  const isOutsideDistrict = Boolean(selectedDistrict && selectedDistrict !== mvpRegion.district);
  const isOutsideArea = Boolean(selectedArea && selectedArea !== mvpRegion.focus);

  if (!hasSelection && !forceNotice) {
    hideMvpNotice();
    setOpenBoardDisabled(false);
    return false;
  }

  if (isOutsideState || isOutsideDistrict || isOutsideArea || forceNotice) {
    const regionName = selectedDistrict || selectedArea || selectedState || "This region";
    const queuedMessage =
      selectedDistrict && selectedDistrict !== mvpRegion.district
        ? `${regionName} Board is currently queued. Development is in progress. Switching systems to Govardhan MVP node.`
        : `Current MVP is live only for ${mvpRegion.focus}, ${mvpRegion.district}, ${mvpRegion.state}.`;

    showMvpNotice(queuedMessage);
    setOpenBoardDisabled(true);
    setDashboardVisible(false);
    return false;
  }

  hideMvpNotice();
  setOpenBoardDisabled(false);
  return false;
};

const applyLanguage = () => {
  const dictionary = siteData.language[currentLanguage];
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    node.textContent = dictionary[key] || node.textContent;
  });
  languageToggle.textContent = currentLanguage === "en" ? "हिंदी" : "English";
  languageToggle.textContent = currentLanguage === "en" ? "हिंदी" : "English";
  languageToggle.textContent = currentLanguage === "en" ? "\u0939\u093f\u0902\u0926\u0940" : "English";
  languageToggle.classList.toggle("is-active", currentLanguage === "hi");
  languageToggle.setAttribute(
    "aria-label",
    currentLanguage === "en" ? "Switch to Hindi" : "Switch to English",
  );
  stateInput.options[0].textContent = t("selectState");
  const districtValue = districtInput.value;
  const areaValue = areaInput.value;
  const reportAreaValue = reportArea.value;
  renderDistrictOptions(districtValue);
  renderAreaOptions(areaValue);
  reportArea.value = reportAreaValue;
  syncDropdownChain({ preserveArea: true });
  const issueTextarea = feedbackForm?.querySelector("textarea");
  if (issueTextarea) issueTextarea.placeholder = t("issuePlaceholder");
  document.documentElement.lang = currentLanguage === "en" ? "en" : "hi";
  syncPoliticalHistoryTitle();
  renderTimeline();
  renderIssues();
  renderCategoryOptions();
  updateMvpRegionGate();
  if (showDashboard) {
    const selected = selectedAreaFromForm();
    if (selected) syncArea(selected.name);
  }
};

languageToggle.addEventListener("click", () => {
  currentLanguage = currentLanguage === "en" ? "hi" : "en";
  applyLanguage();
});

accountButton?.addEventListener("click", () => {
  if (currentUser && profileMenu) {
    profileMenu.hidden = !profileMenu.hidden;
    renderProfileMenu();
    return;
  }
  openAccountModal();
});
profileLogout?.addEventListener("click", () => logoutUser());
document.addEventListener("click", (event) => {
  if (!profileMenu || profileMenu.hidden) return;
  if (accountShell?.contains(event.target)) return;
  profileMenu.hidden = true;
});

document.querySelectorAll("input[name='quickUsername']").forEach((input) => {
  input.addEventListener("input", () => {
    input.value = input.value.toLowerCase().replace(/[^a-z0-9._]/g, "");
  });
});

avatarInput?.addEventListener("change", async () => {
  const file = avatarInput.files?.[0];
  if (!file || !currentUser) return;
  try {
    const photo = await readImageAsDataUrl(file, 600000);
    const result = await updateAvatar(photo.dataUrl);
    persistSession({ token: authToken, user: result.user });
  } catch (error) {
    window.alert(error.message || "Avatar update failed.");
  } finally {
    avatarInput.value = "";
  }
});
accountModalClose?.addEventListener("click", closeAccountModal);
accountModal?.addEventListener("click", (event) => {
  if (event.target === accountModal) closeAccountModal();
});

quickAccountForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(quickAccountForm);
  const usernameCheck = validateUsernameValue(formData.get("quickUsername")?.toString() || "");
  const password = formData.get("quickPassword")?.toString();
  const authMessage = document.querySelector("#authMessage");
  const button = quickAccountForm.querySelector("button[type='submit']");
  if (!usernameCheck.ok) {
    if (authMessage) authMessage.textContent = usernameCheck.message;
    return;
  }
  const username = usernameCheck.username;
  if (!username || !password) return;
  if (authMessage) authMessage.textContent = "Connecting to Netlify secure account...";
  button.disabled = true;
  try {
    const session = await authenticateUser({ username, password });
    persistSession(session);
    quickAccountForm.reset();
    closeAccountModal();
  } catch (error) {
    if (authMessage) authMessage.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

issueGrid.addEventListener("click", (event) => {
  const voteButton = event.target.closest("[data-vote-key]");
  const user = loadCurrentUser();
  if (!user) {
    openAccountModal();
    return;
  }
  if (voteButton) {
    voteButton.disabled = true;
    voteButton.textContent = "Voting...";
    voteForIssue({
      issueKey: voteButton.dataset.voteKey,
      title: voteButton.dataset.title,
    })
      .catch((error) => window.alert(error.message || "Vote submit nahi ho paya."))
      .finally(() => {
        voteButton.disabled = false;
        voteButton.textContent = "Vote for this Issue";
      });
    return;
  }
  const card = event.target.closest(".priority-card");
  if (card) openOpinionBox(card.dataset.category || "Local Issue", user);
});

const syncArea = (areaName) => {
  const selected = siteData.areaOptions.find((area) => area.name === areaName) || siteData.areaOptions[0];
  areaInput.value = selected.name;
  reportArea.value = selected.name;
  pinInput.value = selected.pin;
  areaViewTitle.textContent = `${selected.name} ${t("dashboardSuffix")}`;
  heritageTitle.textContent = `${selected.name} ${t("photoGallerySuffix")}`;
  syncPoliticalHistoryTitle();
  filterNote.textContent = `${t("filterNotePrefix")} ${selected.name} ${t("filterNoteMiddle")} ${selected.pin} ${t("filterNoteSuffix")}`;
  renderAreaMedia(selected.name);
  renderStatusBoard(selected.name, selected.pin);
  setupReveal();
};

const selectedAreaFromForm = () => siteData.areaOptions.find((area) => area.name === areaInput.value);

const hideOnEdit = () => {
  if (showDashboard) setDashboardVisible(false);
};

areaInput.addEventListener("change", () => {
  const selected = selectedAreaFromForm();
  pinInput.value = selected?.pin || "";
  if (reportArea) reportArea.value = areaInput.value;
  hideOnEdit();
  updateMvpRegionGate({ autoFillGovardhan: true });
});

reportArea.addEventListener("change", () => {
  areaInput.value = reportArea.value;
  const selected = selectedAreaFromForm();
  pinInput.value = selected?.pin || "";
  hideOnEdit();
});

[stateInput, districtInput].forEach((input) => {
  input.addEventListener("change", () => {
    syncDropdownChain({ preserveArea: input === districtInput });
    hideOnEdit();
    updateMvpRegionGate();
  });
});

pinInput.addEventListener("change", () => {
  hideOnEdit();
  updateMvpRegionGate();
});

[stateInput, districtInput, pinInput].forEach((input) => {
  input.addEventListener("input", () => {
    pinInput.setCustomValidity("");
    hideOnEdit();
    updateMvpRegionGate();
  });
});

areaSearch.addEventListener("submit", (event) => {
  event.preventDefault();
  pinInput.setCustomValidity("");
  if (!areaSearch.reportValidity()) return;
  const selected = selectedAreaFromForm();
  if (!selected || !isMvpRegionSelected()) {
    updateMvpRegionGate({ forceNotice: true });
    setDashboardVisible(false);
    return;
  }
  if (pinInput.value.trim() !== mvpRegion.pin) {
    pinInput.setCustomValidity(`${t("invalidPinPrefix")} ${mvpRegion.pin} ${t("invalidPinMiddle")} ${mvpRegion.focus}.`);
    pinInput.reportValidity();
    setDashboardVisible(false);
    return;
  }
  syncArea(selected.name);
  setDashboardVisible(true);
  document.querySelector("#mapZoom").scrollIntoView({ behavior: "smooth", block: "start" });
});

areaSearch.addEventListener("reset", () => {
  window.setTimeout(() => {
    stateInput.value = "";
    districtInput.value = "";
    areaInput.value = "";
    reportArea.value = "";
    pinInput.value = "";
    syncDropdownChain();
    hideMvpNotice();
    setOpenBoardDisabled(false);
    setDashboardVisible(false);
  }, 0);
});

clearButton.addEventListener("click", () => {
  hideMvpNotice();
  setOpenBoardDisabled(false);
  setDashboardVisible(false);
});

const setMvpLocation = () => {
  stateInput.value = mvpRegion.state;
  districtInput.value = mvpRegion.district;
  syncDropdownChain({ preserveArea: true });
  areaInput.value = mvpRegion.focus;
  reportArea.value = mvpRegion.focus;
  pinInput.value = mvpRegion.pin;
  updateMvpRegionGate({ autoFillGovardhan: true });
  setDashboardVisible(false);
};

const requestLocation = () => {
  if (!("geolocation" in navigator)) return;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      const nearMathura = latitude > 27 && latitude < 28.2 && longitude > 77 && longitude < 78.4;
      if (nearMathura) setMvpLocation();
    },
    () => {},
    { enableHighAccuracy: false, maximumAge: 300000, timeout: 5000 },
  );
};

locationButton.addEventListener("click", requestLocation);

if ("permissions" in navigator && "geolocation" in navigator) {
  navigator.permissions
    .query({ name: "geolocation" })
    .then((permission) => {
      if (permission.state === "granted") requestLocation();
    })
    .catch(() => {});
}

if (feedbackForm) {
  feedbackForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = feedbackForm.querySelector("button");
    const original = button.textContent;
    const descriptionInput = feedbackForm.querySelector('[name="description"]');
    const category = categoryInput?.value || siteData.issueCategories[0];
    const description = descriptionInput?.value.trim() || "No detailed summary provided.";
    const photoFile = feedbackForm.querySelector('[name="photoProof"]')?.files?.[0];
    const user = loadCurrentUser();

    if (!user) {
      openAccountModal();
      return;
    }

    button.disabled = true;
    button.textContent = "Publishing...";
    try {
      const photo = await readImageAsDataUrl(photoFile);
      await publishCitizenIssue({ category, text: description, user, photo });
      button.textContent = "Submitted to Netlify";
    } catch (error) {
      button.textContent = error.message || "Submit failed";
    }
    feedbackForm.reset();
    reportArea.value = areaInput.value || mvpRegion.focus;
    window.setTimeout(() => {
      button.textContent = original;
      button.disabled = false;
    }, 1800);
  });
}

slideReportForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const user = loadCurrentUser();
  if (!user) {
    openAccountModal();
    return;
  }

  const button = slideReportForm.querySelector("button[type='submit']");
  const original = button.textContent;
  const formData = new FormData(slideReportForm);
  const category = formData.get("category")?.toString() || "Local Issue";
  const description = formData.get("description")?.toString().trim() || "";
  const photoFile = slideReportForm.querySelector('[name="photoProof"]')?.files?.[0];

  if (!description) return;
  button.disabled = true;
  button.textContent = "Publishing...";
  if (slideReportStatus) slideReportStatus.textContent = "Uploading issue to Netlify...";

  try {
    const photo = await readImageAsDataUrl(photoFile);
    await publishCitizenIssue({ category, text: description, photo });
    slideReportForm.reset();
    renderCategoryOptions();
    if (slideReportStatus) slideReportStatus.textContent = "Issue published into live citizen feed.";
  } catch (error) {
    if (slideReportStatus) slideReportStatus.textContent = error.message || "Issue submit failed.";
  } finally {
    button.textContent = original;
    button.disabled = false;
  }
});

const openLightbox = (card) => {
  if (!galleryLightbox || !lightboxImage || !lightboxTitle || !lightboxDescription) return;
  lightboxImage.src = card.dataset.src;
  lightboxImage.alt = card.dataset.title || "Gallery image";
  lightboxTitle.textContent = card.dataset.title || "";
  lightboxDescription.textContent = card.dataset.description || "";
  galleryLightbox.hidden = false;
  document.body.classList.add("no-scroll");
  lightboxClose?.focus();
};

const closeLightbox = () => {
  if (!galleryLightbox) return;
  galleryLightbox.hidden = true;
  document.body.classList.remove("no-scroll");
};

areaGallery?.addEventListener("click", (event) => {
  const card = event.target.closest(".gallery-card");
  if (card) openLightbox(card);
});

areaGallery?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest(".gallery-card");
  if (!card) return;
  event.preventDefault();
  openLightbox(card);
});

lightboxClose?.addEventListener("click", closeLightbox);
galleryLightbox?.addEventListener("click", (event) => {
  if (event.target === galleryLightbox) closeLightbox();
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && galleryLightbox && !galleryLightbox.hidden) closeLightbox();
});

assemblyList.addEventListener("click", (event) => {
  const tab = event.target.closest(".affidavit-tab");
  if (!tab) return;
  const panel = document.querySelector("#affidavitPanel");
  if (!panel) return;
  assemblyList.querySelectorAll(".affidavit-tab").forEach((button) => button.classList.remove("is-active"));
  tab.classList.add("is-active");
  panel.classList.remove("is-swapping");
  window.requestAnimationFrame(() => {
    panel.classList.add("is-swapping");
    panel.textContent = siteData.govardhanAffidavit[tab.dataset.tab] || siteData.govardhanAffidavit.summary;
  });
});

citizenAccountForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(citizenAccountForm);
  const username = formData.get("citizenUsername")?.toString().trim();
  const password = formData.get("citizenPassword")?.toString();
  const button = citizenAccountForm.querySelector("button[type='submit']");
  if (!username || !password) return;

  button.disabled = true;
  if (citizenAccountStatus) citizenAccountStatus.textContent = "Connecting to Netlify account...";

  try {
    const session = await authenticateUser({ username, password });
    persistSession(session);
    citizenAccountForm.reset();
    if (citizenAccountStatus) {
      citizenAccountStatus.textContent =
        session.mode === "created"
          ? `${session.user.username} account created on Netlify.`
          : `${session.user.username} logged in from Netlify.`;
    }
  } catch (error) {
    if (citizenAccountStatus) citizenAccountStatus.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

netaAccountForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(netaAccountForm);
  const name = formData.get("netaName")?.toString().trim() || "Representative";
  const pin = formData.get("netaPin")?.toString().trim() || mvpRegion.pin;
  verifiedNetaUnlocked = true;
  localStorage.setItem("rashtraVerifiedNeta", "true");
  if (netaAccountStatus) {
    netaAccountStatus.textContent = `${name} verification documents received for pin ${pin}. Verified badge enabled in this browser.`;
  }
  renderAssembly();
  setupReveal();
});

const setupReveal = () => {
  document
    .querySelectorAll(
      ".section-heading, .stat-card, .profile-card, .assembly-card, .timeline-item, .issue-card, .feedback-panel, .report-terminal, .builder-grid article, .satellite-card, .heritage-strip, .gallery-card, .coming-soon-card, .report-card-strip article, .status-item",
    )
    .forEach((node) => node.classList.add("reveal"));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.16 },
  );

  document.querySelectorAll(".reveal").forEach((node) => observer.observe(node));
};

renderAreaOptions();
renderDistrictOptions();
syncDropdownChain();
renderCategoryOptions();
loadCurrentUser();
renderAssembly();
renderTimeline();
renderIssues();
applyLanguage();
updateMvpRegionGate();
setDashboardVisible(false);
setupReveal();

