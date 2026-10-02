/*
 * VeoCraft AI frontend
 * --------------------
 * Real generation belongs behind a server-side API. To connect one, set
 * API_ENDPOINT to your backend URL below (never put a provider API key here).
 * See README.md for the expected request/response contract and security notes.
 */
'use strict';

// Keep this empty for the clearly labeled sample-video Demo Mode.
// Example: const API_ENDPOINT = 'https://your-backend.example.com/api/videos';
const API_ENDPOINT = '';
const DEMO_VIDEO_URL = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
const STORAGE_KEYS = { videos: 'veocraft.videos.v1', history: 'veocraft.promptHistory.v1', theme: 'veocraft.theme.v1' };
const MAX_HISTORY = 8;
const MAX_SAVED_VIDEOS = 30;
const EXAMPLE_PROMPTS = [
  'A cinematic sunset over a futuristic city',
  'A funny grandma dancing in a supermarket',
  'A beautiful African landscape at sunset',
  'A robot walking through Tokyo at night',
  'A tiny cabin floating above the clouds at dawn',
  'A time-lapse of a flower opening under the moonlight'
];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const promptInput = $('#promptInput');
const generateButton = $('#generateButton');
const loadingPanel = $('#loadingPanel');
const resultEmpty = $('#resultEmpty');
const resultVideoWrap = $('#resultVideoWrap');
const resultVideo = $('#resultVideo');
const resultStatus = $('#resultStatus');
let activeGeneration = null;
let currentResult = null;

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.warn(`Could not read ${key} from localStorage.`, error);
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Could not save ${key} to localStorage.`, error);
    showToast('Browser storage is unavailable or full. This item was not saved.', 'error');
    return false;
  }
}

function showToast(message, type = 'info') {
  const region = $('#toastRegion');
  if (!region) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.textContent = message;
  region.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3400);
}

function setPrompt(value, { focus = false } = {}) {
  promptInput.value = value.slice(0, 600);
  updateCharacterCount();
  if (focus) promptInput.focus();
}

function updateCharacterCount() {
  const count = promptInput.value.length;
  $('#charCount').textContent = String(count);
  $('.prompt-meta').classList.toggle('limit-near', count >= 540);
}

function getSettings() {
  return {
    aspectRatio: $('#aspectRatio').value,
    duration: Number($('#duration').value),
    style: $('#style').value,
    quality: $('#quality').value
  };
}

function setSettings(settings = {}) {
  if (settings.aspectRatio) $('#aspectRatio').value = settings.aspectRatio;
  if (settings.duration) $('#duration').value = String(settings.duration);
  if (settings.style) $('#style').value = settings.style;
  if (settings.quality) $('#quality').value = settings.quality;
}

function addToHistory(prompt) {
  const oldHistory = readStorage(STORAGE_KEYS.history, []);
  const history = [prompt, ...oldHistory.filter(item => item !== prompt)].slice(0, MAX_HISTORY);
  writeStorage(STORAGE_KEYS.history, history);
  renderHistory();
}

function renderHistory() {
  const list = $('#historyList');
  const history = readStorage(STORAGE_KEYS.history, []);
  list.replaceChildren();
  if (!history.length) {
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = 'Your recent prompts will appear here.';
    list.appendChild(empty);
    return;
  }
  history.forEach(text => {
    const button = document.createElement('button');
    button.className = 'history-item';
    button.type = 'button';
    button.textContent = text;
    button.addEventListener('click', () => {
      setPrompt(text, { focus: true });
      list.hidden = true;
      $('#historyToggle').setAttribute('aria-expanded', 'false');
    });
    list.appendChild(button);
  });
}

function getSavedVideos() {
  const value = readStorage(STORAGE_KEYS.videos, []);
  return Array.isArray(value) ? value : [];
}

function saveVideo(result) {
  const videos = getSavedVideos();
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    prompt: result.prompt,
    date: new Date().toISOString(),
    videoUrl: result.videoUrl,
    settings: result.settings,
    mode: result.mode
  };
  writeStorage(STORAGE_KEYS.videos, [entry, ...videos].slice(0, MAX_SAVED_VIDEOS));
  renderLibrary();
  return entry;
}

function makePreviewCard(video) {
  const article = document.createElement('article');
  article.className = 'video-card';
  const preview = document.createElement('div');
  preview.className = 'video-card-preview';
  const play = document.createElement('span');
  play.className = 'video-card-play';
  play.textContent = '▶';
  preview.appendChild(play);
  const meta = document.createElement('div');
  meta.className = 'video-card-meta';
  const title = document.createElement('p');
  title.className = 'video-card-title';
  title.textContent = video.prompt;
  const sub = document.createElement('div');
  sub.className = 'video-card-sub';
  const date = document.createElement('span');
  date.textContent = formatDate(video.date);
  const mode = document.createElement('span');
  mode.textContent = video.mode === 'demo' ? 'DEMO SAMPLE' : 'AI VIDEO';
  sub.append(date, mode);
  const actions = document.createElement('div');
  actions.className = 'video-card-actions';
  const view = document.createElement('button');
  view.className = 'card-action';
  view.type = 'button';
  view.textContent = 'View';
  view.addEventListener('click', () => viewSavedVideo(video.id));
  const download = document.createElement('button');
  download.className = 'card-action';
  download.type = 'button';
  download.textContent = 'Download';
  download.addEventListener('click', () => downloadUrl(video.videoUrl, video.prompt));
  const remove = document.createElement('button');
  remove.className = 'card-action delete';
  remove.type = 'button';
  remove.textContent = 'Delete';
  remove.addEventListener('click', () => deleteSavedVideo(video.id));
  actions.append(view, download, remove);
  meta.append(title, sub, actions);
  article.append(preview, meta);
  return article;
}

function renderLibrary() {
  const container = $('#videoLibrary');
  const empty = $('#libraryEmpty');
  const oldCards = $$('.video-card', container);
  oldCards.forEach(card => card.remove());
  const videos = getSavedVideos();
  empty.hidden = videos.length > 0;
  $('#libraryCount').textContent = `${videos.length} SAVED`;
  videos.forEach(video => container.appendChild(makePreviewCard(video)));
}

function viewSavedVideo(id) {
  const video = getSavedVideos().find(item => item.id === id);
  if (!video) return;
  currentResult = video;
  setPrompt(video.prompt);
  setSettings(video.settings);
  displayResult(video);
  $('#creator').scrollIntoView({ behavior: 'smooth' });
}

function deleteSavedVideo(id) {
  const next = getSavedVideos().filter(video => video.id !== id);
  writeStorage(STORAGE_KEYS.videos, next);
  renderLibrary();
  showToast('Saved video removed from this browser.', 'success');
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Saved preview';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function displayResult(result) {
  resultEmpty.hidden = true;
  resultVideoWrap.hidden = false;
  resultVideo.pause();
  resultVideo.src = result.videoUrl;
  resultVideo.load();
  const isDemo = result.mode === 'demo';
  $('#demoWatermark').hidden = !isDemo;
  $('#demoNotice').hidden = !isDemo;
  $('#resultModeTag').textContent = isDemo ? 'DEMO SAMPLE · NOT AI-GENERATED' : 'CONNECTED API';
  $('#resultModeTag').classList.toggle('connected', !isDemo);
  $('#resultPromptText').textContent = result.prompt;
  const settings = result.settings || {};
  $('#resultSettings').replaceChildren();
  [`${settings.aspectRatio || '16:9'}`, `${settings.duration || 5}s`, settings.style || 'Cinematic', settings.quality || 'Standard'].forEach(label => {
    const badge = document.createElement('span');
    badge.textContent = label;
    $('#resultSettings').appendChild(badge);
  });
  resultStatus.textContent = isDemo ? 'DEMO PREVIEW' : 'VIDEO READY';
  resultStatus.classList.add('ready');
}

function animateProgress() {
  const bar = $('#progressBar');
  const text = $('#progressText');
  const stages = ['Preparing your concept', 'Processing your request', 'Finishing the preview'];
  let progress = 0;
  text.textContent = `${stages[0]} · 0%`;
  bar.style.width = '0%';
  const timer = window.setInterval(() => {
    progress = Math.min(progress + Math.floor(Math.random() * 13) + 8, 92);
    const stage = progress < 38 ? stages[0] : progress < 74 ? stages[1] : stages[2];
    bar.style.width = `${progress}%`;
    text.textContent = `${stage} · ${progress}%`;
  }, 430);
  return {
    finish() { window.clearInterval(timer); bar.style.width = '100%'; text.textContent = 'Preview ready · 100%'; },
    stop() { window.clearInterval(timer); }
  };
}

/**
 * Generate or preview a video.
 * Demo mode returns a known sample clip and is explicitly labeled as not AI-generated.
 * When API_ENDPOINT is configured, this calls your backend; it does not silently
 * fall back to a demo on API errors.
 * Expected backend response: { "videoUrl": "https://.../video.mp4" }
 */
async function generateVideo(prompt, settings) {
  if (!API_ENDPOINT) {
    // The external MP4 is a real sample clip; it is not based on the submitted prompt.
    return { videoUrl: DEMO_VIDEO_URL, prompt, settings, mode: 'demo' };
  }

  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, settings })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || `The video service returned an error (${response.status}).`);
  }
  const data = await response.json();
  if (!data || typeof data.videoUrl !== 'string' || !data.videoUrl.trim()) {
    throw new Error('The backend response did not include a videoUrl. See the README API contract.');
  }
  return { videoUrl: data.videoUrl, prompt, settings, mode: 'api' };
}

async function handleGenerate() {
  const prompt = promptInput.value.trim();
  if (!prompt) {
    promptInput.focus();
    showToast('Add a prompt first so the video service knows what to make.', 'error');
    return;
  }
  if (activeGeneration) return;
  addToHistory(prompt);
  const settings = getSettings();
  const progress = animateProgress();
  activeGeneration = true;
  generateButton.disabled = true;
  loadingPanel.hidden = false;
  $('#loadingTitle').textContent = API_ENDPOINT ? 'Creating your video...' : 'Preparing a sample preview...';
  $('#loadingSubtitle').textContent = API_ENDPOINT ? 'Your connected video service is processing the prompt.' : 'Demo Mode is loading a sample clip—not generating AI video.';
  $('#resultStatus').textContent = 'WORKING';
  $('#resultStatus').classList.remove('ready');

  try {
    const result = await generateVideo(prompt, settings);
    // Give the status panel a brief readable moment in demo mode; this is not
    // presented as model processing, and the actual sample URL is shown afterward.
    if (result.mode === 'demo') await new Promise(resolve => window.setTimeout(resolve, 850));
    progress.finish();
    currentResult = result;
    displayResult(result);
    saveVideo(result);
    showToast(result.mode === 'demo' ? 'Sample preview ready. It was not generated from your prompt.' : 'Your video is ready and saved in this browser.', 'success');
  } catch (error) {
    progress.stop();
    $('#resultStatus').textContent = 'ERROR';
    $('#resultStatus').classList.remove('ready');
    showToast(error.message || 'Something went wrong while creating your video.', 'error');
  } finally {
    activeGeneration = null;
    generateButton.disabled = false;
    window.setTimeout(() => { loadingPanel.hidden = true; }, 350);
  }
}

async function downloadUrl(url, prompt) {
  if (!url) {
    showToast('No video URL is available to download.', 'error');
    return;
  }
  const filename = `veocraft-${slugify(prompt)}.mp4`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Download request failed.');
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    showToast('Download started.', 'success');
  } catch (error) {
    // For a cross-origin video without CORS, let the browser open the actual file URL.
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener';
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    showToast('Opened the video URL. If it plays in a new tab, use the browser download control.', 'info');
  }
}

function slugify(value) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
  return slug || 'video';
}

async function copyText(text, successMessage) {
  if (!text.trim()) {
    showToast('There is no prompt to copy yet.', 'error');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    const temporary = document.createElement('textarea');
    temporary.value = text;
    temporary.style.position = 'fixed';
    temporary.style.opacity = '0';
    document.body.appendChild(temporary);
    temporary.select();
    const copied = document.execCommand('copy');
    temporary.remove();
    if (!copied) {
      showToast('Copy was blocked by the browser. Select and copy the prompt manually.', 'error');
      return;
    }
  }
  showToast(successMessage, 'success');
}

function initializeTheme() {
  const savedTheme = readStorage(STORAGE_KEYS.theme, 'dark');
  applyTheme(savedTheme === 'light' ? 'light' : 'dark');
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  writeStorage(STORAGE_KEYS.theme, theme);
  $('#themeToggle').setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
}

function initializeNavigation() {
  const toggle = $('#menuToggle');
  const nav = $('#mainNav');
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    toggle.setAttribute('aria-label', expanded ? 'Open navigation menu' : 'Close navigation menu');
    nav.classList.toggle('open', !expanded);
  });
  $$('.nav-link').forEach(link => link.addEventListener('click', () => {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation menu');
  }));
  const sections = ['home', 'creator', 'my-videos', 'about'].map(id => document.getElementById(id));
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        $$('.nav-link').forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`));
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    sections.filter(Boolean).forEach(section => observer.observe(section));
  }
}

function initialize() {
  initializeTheme();
  initializeNavigation();
  renderHistory();
  renderLibrary();
  $('#modeLabel').textContent = API_ENDPOINT ? 'API Connected' : 'Demo Mode';
  $('#demoNotice').hidden = Boolean(API_ENDPOINT);
  $('#resultStatus').textContent = 'READY';
  updateCharacterCount();

  promptInput.addEventListener('input', updateCharacterCount);
  $('#clearPrompt').addEventListener('click', () => {
    setPrompt('');
    promptInput.focus();
    showToast('Prompt cleared.', 'success');
  });
  $('#randomPrompt').addEventListener('click', () => {
    const choices = EXAMPLE_PROMPTS.filter(prompt => prompt !== promptInput.value.trim());
    setPrompt(choices[Math.floor(Math.random() * choices.length)] || EXAMPLE_PROMPTS[0]);
    promptInput.focus();
  });
  $$('.example-chip').forEach(button => button.addEventListener('click', () => {
    setPrompt(button.textContent);
    promptInput.focus();
  }));
  $('#copyPrompt').addEventListener('click', () => copyText(promptInput.value, 'Prompt copied to clipboard.'));
  $('#historyToggle').addEventListener('click', () => {
    const list = $('#historyList');
    const open = list.hidden;
    list.hidden = !open;
    $('#historyToggle').setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.history-wrap')) {
      $('#historyList').hidden = true;
      $('#historyToggle').setAttribute('aria-expanded', 'false');
    }
  });
  $('#themeToggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });
  generateButton.addEventListener('click', handleGenerate);
  $('#generateAgain').addEventListener('click', handleGenerate);
  $('#downloadVideo').addEventListener('click', () => {
    if (currentResult) downloadUrl(currentResult.videoUrl, currentResult.prompt);
  });
  $('#copyPrompt').addEventListener('keydown', event => {
    if (event.key === 'Enter') copyText(promptInput.value, 'Prompt copied to clipboard.');
  });
  resultVideo.addEventListener('error', () => {
    if (!resultVideoWrap.hidden) showToast('The video sample could not load. Check your internet connection or verify the backend video URL.', 'error');
  });
}

document.addEventListener('DOMContentLoaded', initialize);
