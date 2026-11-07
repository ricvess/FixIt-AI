/*
  FIXIT AI · FRONTEND APPLICATION
  Before running:
  1. Add your Supabase project URL and anon key below.
  2. Create the database table and Storage bucket described in the setup guide.
  3. Deploy the "diagnose" Supabase Edge Function.
*/

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/* =========================================================
   1. SUPABASE CONFIGURATION
   ========================================================= */
const SUPABASE_URL = "https://uytbxmdifvooxwqewkqw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_elN133FxSOsTRU7clR53lQ_GJBI_x0h";
const STORAGE_BUCKET = "diagnosis-images";
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const supabaseConfigured =
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("YOUR_SUPABASE") &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");

const supabase = supabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;

/* =========================================================
   2. DOM HELPERS AND APP STATE
   ========================================================= */
const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

const state = {
  user: null,
  session: null,
  authMode: "login",
  selectedFile: null,
  previewUrl: null,
  diagnoses: [],
  currentDiagnosis: null,
  currentView: "overview",
  historyQuery: "",
  savedIds: new Set()
};

const page = {
  landing: $("#landing-page"),
  auth: $("#auth-page"),
  dashboard: $("#dashboard"),
  footer: $("#landing-footer"),
  authForm: $("#auth-form"),
  authMessage: $("#auth-message"),
  authTitle: $("#auth-title"),
  authSubtitle: $("#auth-subtitle"),
  authSubmit: $("#auth-submit"),
  authSwitch: $("#auth-switch"),
  nameField: $("#name-field"),
  authName: $("#auth-name"),
  authEmail: $("#auth-email"),
  authPassword: $("#auth-password"),
  uploadZone: $("#upload-zone"),
  imageInput: $("#image-input"),
  uploadPlaceholder: $("#upload-placeholder"),
  imagePreview: $("#image-preview"),
  previewImage: $("#preview-image"),
  previewFilename: $("#preview-filename"),
  analyzeButton: $("#analyze-button"),
  scanProgress: $("#scan-progress"),
  progressTitle: $("#progress-title"),
  progressSubtitle: $("#progress-subtitle"),
  scannerError: $("#scanner-error"),
  diagnosisSection: $("#diagnosis-section"),
  diagnosisResult: $("#diagnosis-result"),
  historyList: $("#history-list"),
  recentList: $("#recent-list"),
  toastRegion: $("#toast-region")
};

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "error" : ""}`;
  toast.innerHTML = `<i data-lucide="${type === "error" ? "alert-circle" : "check-circle-2"}"></i><span>${escapeHTML(message)}</span>`;
  page.toastRegion.appendChild(toast);
  refreshIcons();
  window.setTimeout(() => toast.remove(), 3600);
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("fixit-theme", theme);
  $$(".theme-toggle").forEach(button => {
    button.innerHTML = `<i data-lucide="${theme === "dark" ? "sun" : "moon"}"></i>`;
    button.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  });
  refreshIcons();
}

function initTheme() {
  const saved = localStorage.getItem("fixit-theme");
  setTheme(saved === "dark" ? "dark" : "light");
}

function showPage(name) {
  page.landing.classList.toggle("hidden", name !== "landing");
  page.auth.classList.toggle("hidden", name !== "auth");
  page.dashboard.classList.toggle("hidden", name !== "dashboard");
  page.footer.classList.toggle("hidden", name !== "landing");
  window.scrollTo({ top: 0, behavior: "smooth" });
  refreshIcons();
}

function showAuth(mode = "login") {
  state.authMode = mode;
  updateAuthMode();
  showPage("auth");
  page.authEmail.focus();
}

function updateAuthMode() {
  const isSignup = state.authMode === "signup";
  page.authTitle.textContent = isSignup ? "Create your account." : "Welcome back.";
  page.authSubtitle.textContent = isSignup
    ? "Set up your account to start using FixIt AI."
    : "Sign in to continue to your workspace.";
  page.nameField.classList.toggle("hidden", !isSignup);
  page.authName.required = isSignup;
  page.authPassword.autocomplete = isSignup ? "new-password" : "current-password";
  page.authSubmit.innerHTML = isSignup
    ? 'Create account <i data-lucide="arrow-right"></i>'
    : 'Log in <i data-lucide="arrow-right"></i>';
  page.authSwitch.innerHTML = isSignup
    ? 'Already have an account? <button type="button" data-switch-auth="login">Log in</button>'
    : 'New to FixIt AI? <button type="button" data-switch-auth="signup">Create an account</button>';
  hideAuthMessage();
  refreshIcons();
}

function showAuthMessage(message, type = "error") {
  page.authMessage.textContent = message;
  page.authMessage.classList.remove("hidden", "success");
  if (type === "success") page.authMessage.classList.add("success");
}
function hideAuthMessage() {
  page.authMessage.classList.add("hidden");
  page.authMessage.textContent = "";
  page.authMessage.classList.remove("success");
}

function setAuthLoading(loading) {
  page.authSubmit.disabled = loading;
  page.authSubmit.innerHTML = loading
    ? '<span class="button-spinner"></span> Please wait...'
    : state.authMode === "signup"
      ? 'Create account <i data-lucide="arrow-right"></i>'
      : 'Log in <i data-lucide="arrow-right"></i>';
  refreshIcons();
}

function getDisplayName(user) {
  return user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "there";
}

function updateUserUI(user) {
  const name = getDisplayName(user);
  const initial = name.trim().charAt(0).toUpperCase() || "U";
  $("#sidebar-user-name").textContent = name;
  $("#sidebar-user-email").textContent = user?.email || "";
  $("#sidebar-avatar").textContent = initial;
  $("#top-avatar").textContent = initial;
  $("#welcome-name").textContent = name.split(/\s+/)[0];
  $("#current-date").textContent = new Intl.DateTimeFormat("en", {
    weekday: "short", month: "short", day: "numeric"
  }).format(new Date());
}

/* =========================================================
   3. AUTHENTICATION
   ========================================================= */
async function handleAuthSubmit(event) {
  event.preventDefault();
  hideAuthMessage();

  if (!supabase) {
    showAuthMessage("Supabase is not configured yet. Add your project URL and anon key in script.js.");
    return;
  }

  const email = page.authEmail.value.trim();
  const password = page.authPassword.value;
  const fullName = page.authName.value.trim();

  if (!email || !password) {
    showAuthMessage("Please enter your email address and password.");
    return;
  }
  if (state.authMode === "signup" && fullName.length < 2) {
    showAuthMessage("Please enter your name.");
    return;
  }

  setAuthLoading(true);
  try {
    if (state.authMode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } }
      });
      if (error) throw error;

      if (!data.session) {
        showAuthMessage("Account created. Check your email to confirm your account, then log in.", "success");
        page.authForm.reset();
      } else {
        state.session = data.session;
        state.user = data.user;
        await enterDashboard();
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      state.session = data.session;
      state.user = data.user;
      await enterDashboard();
    }
  } catch (error) {
    showAuthMessage(authErrorMessage(error));
  } finally {
    setAuthLoading(false);
  }
}

function authErrorMessage(error) {
  const message = error?.message || "Something went wrong. Please try again.";
  if (/invalid login credentials/i.test(message)) return "Email or password is incorrect.";
  if (/already registered/i.test(message)) return "This email already has an account. Try logging in.";
  if (/password should be at least/i.test(message)) return "Your password must contain at least 6 characters.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email address before logging in.";
  return message;
}

async function enterDashboard() {
  if (!state.user) return;
  updateUserUI(state.user);
  showPage("dashboard");
  setDashboardView("overview");
  await loadDiagnoses();
}

async function logout() {
  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) {
      showToast("Could not log out. Please try again.", "error");
      return;
    }
  }
  state.user = null;
  state.session = null;
  state.diagnoses = [];
  state.savedIds.clear();
  clearSelectedImage();
  showPage("landing");
  showToast("You have been logged out.");
}

/* =========================================================
   4. DASHBOARD NAVIGATION
   ========================================================= */
const viewNames = {
  overview: "Overview",
  scanner: "AI Scanner",
  history: "Scan history",
  safety: "Safety guidelines",
  about: "About FixIt AI"
};

function setDashboardView(view) {
  if (!state.user) {
    showAuth("login");
    return;
  }
  if (!viewNames[view]) return;
  state.currentView = view;
  $$(".dashboard-view").forEach(section => section.classList.toggle("active", section.id === `view-${view}`));
  $$(".side-link[data-dashboard-view]").forEach(button => {
    button.classList.toggle("active", button.dataset.dashboardView === view);
  });
  $("#breadcrumb-current").textContent = viewNames[view];
  closeMobileSidebar();
  window.scrollTo({ top: 0, behavior: "smooth" });
  refreshIcons();
}

function openMobileSidebar() {
  $("#sidebar").classList.add("open");
  $("#sidebar-backdrop").classList.remove("hidden");
}
function closeMobileSidebar() {
  $("#sidebar").classList.remove("open");
  $("#sidebar-backdrop").classList.add("hidden");
}

/* =========================================================
   5. IMAGE UPLOAD AND PREVIEW
   ========================================================= */
function validateImage(file) {
  if (!file) return "Choose an image first.";
  if (!ALLOWED_TYPES.includes(file.type)) return "Please use a JPG, PNG, or WEBP image.";
  if (file.size > MAX_IMAGE_SIZE) return "This image is larger than 8 MB. Choose a smaller image.";
  return null;
}

function handleSelectedFile(file) {
  const error = validateImage(file);
  if (error) {
    showScannerError(error);
    return;
  }
  hideScannerError();
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  state.selectedFile = file;
  state.previewUrl = URL.createObjectURL(file);
  page.previewImage.src = state.previewUrl;
  page.previewFilename.textContent = file.name;
  page.uploadPlaceholder.classList.add("hidden");
  page.imagePreview.classList.remove("hidden");
  page.analyzeButton.disabled = false;
}

function clearSelectedImage() {
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  state.previewUrl = null;
  state.selectedFile = null;
  page.imageInput.value = "";
  page.previewImage.removeAttribute("src");
  page.imagePreview.classList.add("hidden");
  page.uploadPlaceholder.classList.remove("hidden");
  page.analyzeButton.disabled = true;
}

function showScannerError(message) {
  page.scannerError.textContent = message;
  page.scannerError.classList.remove("hidden");
}
function hideScannerError() {
  page.scannerError.classList.add("hidden");
  page.scannerError.textContent = "";
}

function setScanLoading(loading) {
  page.analyzeButton.disabled = loading || !state.selectedFile;
  page.scanProgress.classList.toggle("hidden", !loading);
  if (loading) {
    page.progressTitle.textContent = "Analyzing your image...";
    page.progressSubtitle.textContent = "Looking for visible details. This may take a moment.";
  }
}

/* =========================================================
   6. AI DIAGNOSIS
   ========================================================= */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(new Error("Could not read this image. Please choose it again."));
    reader.readAsDataURL(file);
  });
}

async function uploadDiagnosisImage(file, userId) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeName = `${crypto.randomUUID()}.${extension}`;
  const path = `${userId}/${safeName}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) throw new Error(`Image storage failed: ${error.message}`);
  return path;
}

async function callDiagnosisFunction(file) {
  if (!supabase || !state.session?.access_token) {
    throw new Error("Your session is missing. Please log in again.");
  }

  const imageBase64 = await fileToBase64(file);
  const endpoint = `${SUPABASE_URL}/functions/v1/diagnose`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${state.session.access_token}`,
      "apikey": SUPABASE_ANON_KEY
    },
    body: JSON.stringify({
      imageBase64,
      mimeType: file.type,
      fileName: file.name
    })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || result.message || `AI service returned an error (${response.status}).`);
  }
  if (!result.diagnosis) {
    throw new Error("The AI response did not contain a diagnosis. Check your Edge Function response format.");
  }
  return normalizeDiagnosis(result.diagnosis);
}

function normalizeList(value, fallback = []) {
  if (Array.isArray(value)) return value.map(item => String(item)).filter(Boolean).slice(0, 8);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return fallback;
}

function normalizeDiagnosis(raw) {
  const allowedUrgencies = ["low", "medium", "high", "critical"];
  const urgency = String(raw.urgency || "medium").toLowerCase();
  const confidence = Number(raw.confidence);
  return {
    object_name: String(raw.object_name || "Unidentified household item").slice(0, 120),
    category: String(raw.category || "Household item").slice(0, 80),
    problem: String(raw.problem || "Possible issue needs further inspection").slice(0, 180),
    summary: String(raw.summary || "The image may show an issue, but more information is needed to understand it.").slice(0, 1200),
    urgency: allowedUrgencies.includes(urgency) ? urgency : "medium",
    confidence: Number.isFinite(confidence) && confidence >= 0 && confidence <= 100 ? confidence : null,
    possible_causes: normalizeList(raw.possible_causes, ["The visible image does not provide enough detail to determine the cause."]),
    recommended_actions: normalizeList(raw.recommended_actions, ["Keep a safe distance from the affected area.", "Ask a qualified professional to inspect the item if the issue continues."]),
    safety_notes: String(raw.safety_notes || "Do not attempt a repair if you are unsure whether it is safe.").slice(0, 1000),
    professional_help: String(raw.professional_help || "Contact a qualified professional if the issue persists or involves a safety risk.").slice(0, 1000),
    image_quality_note: String(raw.image_quality_note || "").slice(0, 500)
  };
}

async function saveDiagnosis(diagnosis, imagePath, file) {
  const record = {
    user_id: state.user.id,
    image_path: imagePath,
    object_name: diagnosis.object_name,
    problem: diagnosis.problem,
    urgency: diagnosis.urgency,
    confidence: diagnosis.confidence,
    diagnosis_json: diagnosis
  };
  const { data, error } = await supabase
    .from("diagnoses")
    .insert(record)
    .select()
    .single();

  if (error) throw new Error(`Diagnosis was generated but could not be saved: ${error.message}`);
  return data;
}

async function runDiagnosis() {
  if (!state.user || !state.selectedFile) return;
  hideScannerError();
  setScanLoading(true);
  page.diagnosisSection.classList.add("hidden");

  let imagePath = null;
  try {
    const diagnosis = await callDiagnosisFunction(state.selectedFile);

    try {
      imagePath = await uploadDiagnosisImage(state.selectedFile, state.user.id);
    } catch (storageError) {
      console.warn("Storage upload warning:", storageError);
      showToast("Hasil diagnosis berhasil, tetapi gambar gagal disimpan ke storage.", "error");
    }

    const savedRecord = await saveDiagnosis(diagnosis, imagePath, state.selectedFile);
    const localResult = {
      ...savedRecord,
      diagnosis_json: diagnosis,
      image_url: state.previewUrl
    };
    state.currentDiagnosis = localResult;
    state.diagnoses.unshift(localResult);
    renderDiagnosis(localResult, state.previewUrl);
    updateDashboardStats();
    renderHistory();
    page.diagnosisSection.classList.remove("hidden");
    page.diagnosisSection.scrollIntoView({ behavior: "smooth", block: "start" });
    showToast("Your diagnosis is ready and saved.");
  } catch (error) {
    console.error("FixIt AI diagnosis error:", error);
    showScannerError(error.message || "We could not analyze this image. Please try again.");
  } finally {
    setScanLoading(false);
  }
}

/* =========================================================
   7. DIAGNOSIS DISPLAY
   ========================================================= */
function urgencyLabel(level) {
  return ({ low: "Low urgency", medium: "Medium urgency", high: "High urgency", critical: "Critical" })[level] || "Review needed";
}

function renderDiagnosis(record, imageUrl = null) {
  const diagnosis = record.diagnosis_json || record;
  const image = imageUrl || record.image_url || "";
  const confidenceText = diagnosis.confidence === null || diagnosis.confidence === undefined
    ? "Not available"
    : `${Math.round(diagnosis.confidence)}% (AI estimate)`;
  const causes = normalizeList(diagnosis.possible_causes);
  const actions = normalizeList(diagnosis.recommended_actions);
  const isSaved = state.savedIds.has(record.id);

  page.diagnosisResult.innerHTML = `
    <article class="diagnosis-card">
      <div class="diagnosis-image">${image ? `<img src="${escapeHTML(image)}" alt="Analyzed household item" />` : `<div class="empty-icon"><i data-lucide="image"></i></div>`}</div>
      <div class="diagnosis-body">
        <div class="diagnosis-topline"><span class="diagnosis-category">${escapeHTML(diagnosis.category || "HOUSEHOLD ITEM")}</span><span class="urgency-badge urgency-${escapeHTML(diagnosis.urgency)}">${escapeHTML(urgencyLabel(diagnosis.urgency))}</span></div>
        <h3>${escapeHTML(diagnosis.object_name)}</h3>
        <p class="diagnosis-summary"><strong>${escapeHTML(diagnosis.problem)}</strong><br />${escapeHTML(diagnosis.summary)}</p>
        <div class="diagnosis-meta"><span class="meta-chip">AI confidence: ${escapeHTML(confidenceText)}</span><span class="meta-chip">Image-based estimate</span></div>
        ${diagnosis.image_quality_note ? `<div class="diagnosis-block"><h4><i data-lucide="image"></i> Image note</h4><p>${escapeHTML(diagnosis.image_quality_note)}</p></div>` : ""}
        <div class="diagnosis-block"><h4><i data-lucide="search"></i> Possible causes</h4><ul>${causes.map(item => `<li>${escapeHTML(item)}</li>`).join("")}</ul></div>
        <div class="diagnosis-block"><h4><i data-lucide="list-checks"></i> Recommended next steps</h4><ol>${actions.map(item => `<li>${escapeHTML(item)}</li>`).join("")}</ol></div>
        <div class="diagnosis-block"><h4><i data-lucide="shield-check"></i> Safety guidance</h4><p>${escapeHTML(diagnosis.safety_notes)}</p></div>
        <div class="diagnosis-warning"><i data-lucide="alert-triangle"></i><p><strong>When to get professional help</strong><br />${escapeHTML(diagnosis.professional_help)}</p></div>
        <div class="diagnosis-footer"><small>AI-generated estimate. Not a professional inspection.</small><div class="diagnosis-footer-actions"><button class="button button-outline" type="button" data-save-diagnosis="${escapeHTML(record.id)}"><i data-lucide="${isSaved ? "bookmark-check" : "bookmark"}"></i>${isSaved ? "Saved" : "Save result"}</button></div></div>
      </div>
    </article>`;
  refreshIcons();
}

/* =========================================================
   8. HISTORY, SAVED RESULTS, AND DASHBOARD STATS
   ========================================================= */
async function loadDiagnoses() {
  if (!supabase || !state.user) return;
  const { data, error } = await supabase
    .from("diagnoses")
    .select("*")
    .eq("user_id", state.user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Could not load diagnoses:", error);
    showToast("Could not load scan history. Check your database setup.", "error");
    state.diagnoses = [];
  } else {
    const loadedData = data || [];
    for (let record of loadedData) {
      if (record.image_path && !record.image_url) {
        try {
          const { data: signData } = await supabase.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(record.image_path, 60 * 60);
          if (signData?.signedUrl) {
            record.image_url = signData.signedUrl;
          }
        } catch (e) {
          console.error("Could not create signed URL for history item:", e);
        }
      }
    }
    state.diagnoses = loadedData;
  }
  await loadSavedIds();
  updateDashboardStats();
  renderHistory();
  renderRecentScans();
}

async function loadSavedIds() {
  if (!supabase || !state.user) return;
  const { data, error } = await supabase
    .from("saved_diagnoses")
    .select("diagnosis_id")
    .eq("user_id", state.user.id);
  if (!error) state.savedIds = new Set((data || []).map(row => row.diagnosis_id));
}

function updateDashboardStats() {
  $("#stat-total").textContent = String(state.diagnoses.length);
  $("#stat-saved").textContent = String(state.savedIds.size);
  const latest = state.diagnoses[0]?.created_at;
  $("#stat-last").textContent = latest
    ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(latest))
    : "—";
}

function formatDate(value) {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function renderHistoryItem(record) {
  const diagnosis = record.diagnosis_json || {};
  const title = record.object_name || diagnosis.object_name || "Household item";
  const problem = record.problem || diagnosis.problem || "Diagnosis saved";
  const urgency = record.urgency || diagnosis.urgency || "medium";
  const thumb = record.image_url || "";
  return `
    <article class="history-item">
      <div class="history-thumb">${thumb ? `<img src="${escapeHTML(thumb)}" alt="" />` : `<span class="empty-icon"><i data-lucide="image"></i></span>`}</div>
      <div class="history-info"><strong>${escapeHTML(title)}</strong><span>${escapeHTML(problem)}</span></div>
      <span class="urgency-badge urgency-${escapeHTML(urgency)}">${escapeHTML(urgencyLabel(urgency))}</span>
      <span class="history-date">${escapeHTML(formatDate(record.created_at))}</span>
      <div class="history-item-actions"><button type="button" title="View diagnosis" data-view-diagnosis="${escapeHTML(record.id)}"><i data-lucide="arrow-up-right"></i></button><button type="button" title="Delete diagnosis" data-delete-diagnosis="${escapeHTML(record.id)}"><i data-lucide="trash-2"></i></button></div>
    </article>`;
}

function renderHistory() {
  const query = state.historyQuery.toLowerCase();
  const filtered = state.diagnoses.filter(record => {
    const diagnosis = record.diagnosis_json || {};
    return [record.object_name, record.problem, diagnosis.object_name, diagnosis.problem]
      .some(value => String(value || "").toLowerCase().includes(query));
  });

  page.historyList.innerHTML = filtered.length
    ? filtered.map(renderHistoryItem).join("")
    : `<div class="empty-state"><span class="empty-icon"><i data-lucide="search-x"></i></span><strong>${query ? "No matching scans" : "No scan history yet"}</strong><p>${query ? "Try another search term." : "Your completed scans will show up here."}</p></div>`;
  refreshIcons();
}

function renderRecentScans() {
  const recent = state.diagnoses.slice(0, 3);
  page.recentList.innerHTML = recent.length
    ? recent.map(renderHistoryItem).join("")
    : `<div class="empty-state compact-empty"><span class="empty-icon"><i data-lucide="image-plus"></i></span><strong>No scans yet</strong><p>Your recent diagnoses will appear here.</p><button class="button button-outline" type="button" data-dashboard-view="scanner">Start your first scan</button></div>`;
  refreshIcons();
}

async function toggleSavedDiagnosis(id) {
  if (!supabase || !state.user) return;
  const alreadySaved = state.savedIds.has(id);
  try {
    if (alreadySaved) {
      const { error } = await supabase.from("saved_diagnoses")
        .delete().eq("user_id", state.user.id).eq("diagnosis_id", id);
      if (error) throw error;
      state.savedIds.delete(id);
      showToast("Removed from saved results.");
    } else {
      const { error } = await supabase.from("saved_diagnoses")
        .insert({ user_id: state.user.id, diagnosis_id: id });
      if (error) throw error;
      state.savedIds.add(id);
      showToast("Diagnosis saved for later.");
    }
    updateDashboardStats();
    if (state.currentDiagnosis?.id === id) {
      const record = state.currentDiagnosis;
      renderDiagnosis(record, record.image_url);
    }
  } catch (error) {
    showToast(error.message || "Could not update saved results.", "error");
  }
}

async function deleteDiagnosis(id) {
  if (!supabase || !state.user) return;
  const record = state.diagnoses.find(item => item.id === id);
  if (!record) return;
  const confirmed = window.confirm("Delete this diagnosis from your history? This action cannot be undone.");
  if (!confirmed) return;

  try {
    if (record.image_path) {
      await supabase.storage.from(STORAGE_BUCKET).remove([record.image_path]);
    }
    const { error } = await supabase.from("diagnoses")
      .delete().eq("id", id).eq("user_id", state.user.id);
    if (error) throw error;

    await supabase.from("saved_diagnoses")
      .delete().eq("diagnosis_id", id).eq("user_id", state.user.id);

    state.diagnoses = state.diagnoses.filter(item => item.id !== id);
    state.savedIds.delete(id);
    updateDashboardStats();
    renderHistory();
    renderRecentScans();
    showToast("Diagnosis deleted.");
  } catch (error) {
    showToast(error.message || "Could not delete this diagnosis.", "error");
  }
}

async function viewPastDiagnosis(id) {
  const record = state.diagnoses.find(item => item.id === id);
  if (!record) return;
  let imageUrl = record.image_url || null;

  if (!imageUrl && record.image_path && supabase) {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET).createSignedUrl(record.image_path, 60 * 10);
    if (!error) imageUrl = data.signedUrl;
  }

  state.currentDiagnosis = { ...record, image_url: imageUrl };
  setDashboardView("scanner");
  renderDiagnosis(state.currentDiagnosis, imageUrl);
  page.diagnosisSection.classList.remove("hidden");
  page.diagnosisSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* =========================================================
   9. EVENT LISTENERS
   ========================================================= */
document.addEventListener("click", event => {
  // Handle Category Card Click (Tahap 2)
  const categoryCard = event.target.closest("[data-category]");
  if (categoryCard) {
    const categoryName = categoryCard.dataset.category;
    if (state.user) {
      setDashboardView("scanner");
      showToast(`Siap memeriksa kategori: ${categoryName}`);
    } else {
      showAuth("signup");
      showToast(`Silakan daftar/masuk untuk scan ${categoryName}`, "success");
    }
    return;
  }

  const authButton = event.target.closest("[data-open-auth]");
  if (authButton) {
    showAuth(authButton.dataset.openAuth);
    return;
  }

  const homeLink = event.target.closest("[data-home-link], [data-back-home]");
  if (homeLink) {
    event.preventDefault();
    if (state.user) {
      setDashboardView("overview");
    } else {
      showPage("landing");
    }
    return;
  }

  const switchButton = event.target.closest("[data-switch-auth]");
  if (switchButton) {
    state.authMode = switchButton.dataset.switchAuth;
    updateAuthMode();
    return;
  }

  const viewButton = event.target.closest("[data-dashboard-view]");
  if (viewButton) {
    setDashboardView(viewButton.dataset.dashboardView);
    return;
  }

  const saveButton = event.target.closest("[data-save-diagnosis]");
  if (saveButton) {
    toggleSavedDiagnosis(saveButton.dataset.saveDiagnosis);
    return;
  }

  const viewDiagnosisButton = event.target.closest("[data-view-diagnosis]");
  if (viewDiagnosisButton) {
    viewPastDiagnosis(viewDiagnosisButton.dataset.viewDiagnosis);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-diagnosis]");
  if (deleteButton) {
    deleteDiagnosis(deleteButton.dataset.deleteDiagnosis);
  }
});

$$(".theme-toggle").forEach(button => {
  button.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(next);
  });
});

page.authForm.addEventListener("submit", handleAuthSubmit);
$("#logout-button").addEventListener("click", logout);
$("#browse-image").addEventListener("click", () => page.imageInput.click());
page.imageInput.addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (file) handleSelectedFile(file);
});
$("#remove-image").addEventListener("click", clearSelectedImage);
page.analyzeButton.addEventListener("click", runDiagnosis);
$("#new-scan-button").addEventListener("click", () => {
  clearSelectedImage();
  page.diagnosisSection.classList.add("hidden");
  hideScannerError();
  setDashboardView("scanner");
  window.scrollTo({ top: 0, behavior: "smooth" });
});
$("#history-search").addEventListener("input", event => {
  state.historyQuery = event.target.value;
  renderHistory();
});
$("#mobile-menu-button").addEventListener("click", openMobileSidebar);
$("#sidebar-backdrop").addEventListener("click", closeMobileSidebar);

page.uploadZone.addEventListener("dragover", event => {
  event.preventDefault();
  page.uploadZone.classList.add("drag-over");
});
page.uploadZone.addEventListener("dragleave", () => page.uploadZone.classList.remove("drag-over"));
page.uploadZone.addEventListener("drop", event => {
  event.preventDefault();
  page.uploadZone.classList.remove("drag-over");
  const file = event.dataTransfer.files?.[0];
  if (file) handleSelectedFile(file);
});
page.uploadZone.addEventListener("click", event => {
  if (event.target.closest("button") || event.target.closest(".image-preview")) return;
  if (!state.selectedFile) page.imageInput.click();
});
$("#auth-password").addEventListener("keydown", event => {
  if (event.key === "Enter") page.authForm.requestSubmit();
});
$(".password-toggle").addEventListener("click", event => {
  const input = $("#auth-password");
  const isPassword = input.type === "password";
  input.type = isPassword ? "text" : "password";
  event.currentTarget.innerHTML = `<i data-lucide="${isPassword ? "eye-off" : "eye"}"></i>`;
  refreshIcons();
});

/* =========================================================
   10. APP INITIALIZATION
   ========================================================= */
async function initializeApp() {
  $("#footer-year").textContent = new Date().getFullYear();
  initTheme();
  refreshIcons();

  if (!supabase) {
    console.info("FixIt AI: Add Supabase URL and anon key in script.js to enable authentication and data.");
    showPage("landing");
    return;
  }

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) console.error("Could not read auth session:", error);

  if (session?.user) {
    state.session = session;
    state.user = session.user;
    await enterDashboard();
  } else {
    showPage("landing");
  }

  supabase.auth.onAuthStateChange((event, sessionValue) => {
    if (event === "SIGNED_OUT") {
      state.user = null;
      state.session = null;
      state.diagnoses = [];
      state.savedIds.clear();
      showPage("landing");
    } else if (sessionValue?.user) {
      state.session = sessionValue;
      state.user = sessionValue.user;
    }
  });
}

initializeApp();