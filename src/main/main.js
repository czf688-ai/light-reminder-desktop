const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, clipboard, Notification, nativeImage, screen, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { pathToFileURL } = require('url');

let mainWindow;
let tray;
let reminderTimer;
const notifiedTaskIds = new Set();
let currentSettings = null;
let shortcutStatus = {};
let expandedWindowBounds = null;
let isWindowCollapsed = false;
const MIN_WINDOW_WIDTH = 340;
const MIN_WINDOW_HEIGHT = 460;
const COLLAPSED_WINDOW_HEIGHT = 46;

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
}

const stableUserDataPath = path.join(app.getPath('appData'), 'light-reminder-desktop');
app.setPath('userData', stableUserDataPath);

function logApp(message, error) {
  try {
    const dir = app.getPath('userData');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const detail = error ? ` ${error.stack || error.message || error}` : '';
    fs.appendFileSync(path.join(dir, 'app.log'), `[${new Date().toISOString()}] ${message}${detail}\n`, 'utf8');
  } catch {
  }
}

process.on('uncaughtException', (error) => logApp('Uncaught exception', error));
process.on('unhandledRejection', (error) => logApp('Unhandled rejection', error));

const DEFAULT_GROUP_ID = 'inbox';
let activeGroupId = DEFAULT_GROUP_ID;
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']);

if (process.platform === 'win32') {
  app.setAppUserModelId('com.light-reminder-desktop.app');
}

function getTasksFile() {
  return path.join(app.getPath('userData'), 'tasks.json');
}

function getGroupsFile() {
  return path.join(app.getPath('userData'), 'groups.json');
}

function getSettingsFile() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function getAttachmentsDir() {
  return path.join(app.getPath('userData'), 'attachments');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function ensureDataFile(file, defaultContent) {
  ensureDir(path.dirname(file));
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultContent, null, 2), 'utf8');
  }
}

function parseJson(raw, fallback) {
  try {
    return JSON.parse(String(raw || '').replace(/^\uFEFF/, ''));
  } catch (error) {
    console.error('Failed to parse JSON:', error);
    return fallback;
  }
}

function defaultGroups() {
  return [
    {
      id: DEFAULT_GROUP_ID,
      name: '收集箱',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
}

function defaultSettings() {
  return {
    alwaysOnTop: false,
    openAtLogin: false,
    opacity: 1,
    autoCopySelection: false,
    restoreClipboard: true,
    shortcuts: {
      quickInput: 'Control+Alt+Space',
      clipboardTask: 'Control+Alt+T',
      toggleWindow: 'Control+Alt+R'
    }
  };
}

function normalizeSettings(value) {
  const defaults = defaultSettings();
  const source = value && typeof value === 'object' ? value : {};
  const shortcuts = source.shortcuts && typeof source.shortcuts === 'object' ? source.shortcuts : {};
  return {
    alwaysOnTop: Boolean(source.alwaysOnTop),
    openAtLogin: Boolean(source.openAtLogin),
    opacity: normalizeOpacity(source.opacity, defaults.opacity),
    autoCopySelection: Boolean(source.autoCopySelection),
    restoreClipboard: source.restoreClipboard !== false,
    shortcuts: {
      quickInput: normalizeText(shortcuts.quickInput) || defaults.shortcuts.quickInput,
      clipboardTask: normalizeText(shortcuts.clipboardTask) || defaults.shortcuts.clipboardTask,
      toggleWindow: normalizeText(shortcuts.toggleWindow) || defaults.shortcuts.toggleWindow
    }
  };
}

function readSettings() {
  ensureDataFile(getSettingsFile(), defaultSettings());
  try {
    const raw = fs.readFileSync(getSettingsFile(), 'utf8');
    const settings = normalizeSettings(parseJson(raw, defaultSettings()));
    writeSettings(settings);
    return settings;
  } catch (error) {
    logApp('Failed to read settings', error);
    return defaultSettings();
  }
}

function writeSettings(settings) {
  const normalized = normalizeSettings(settings);
  ensureDataFile(getSettingsFile(), defaultSettings());
  fs.writeFileSync(getSettingsFile(), JSON.stringify(normalized, null, 2), 'utf8');
  currentSettings = normalized;
  return normalized;
}

function readGroups() {
  ensureDataFile(getGroupsFile(), defaultGroups());
  try {
    const raw = fs.readFileSync(getGroupsFile(), 'utf8');
    const parsed = parseJson(raw, defaultGroups());
    const groups = Array.isArray(parsed) ? parsed : defaultGroups();
    if (!groups.some((group) => group.id === DEFAULT_GROUP_ID)) {
      groups.unshift(defaultGroups()[0]);
      writeGroups(groups);
    }
    return groups;
  } catch (error) {
    console.error('Failed to read groups:', error);
    return defaultGroups();
  }
}

function writeGroups(groups) {
  ensureDataFile(getGroupsFile(), defaultGroups());
  fs.writeFileSync(getGroupsFile(), JSON.stringify(groups, null, 2), 'utf8');
}

function normalizeTask(task) {
  return {
    ...task,
    groupId: task.groupId || DEFAULT_GROUP_ID,
    pmStatus: task.pmStatus || 'normal',
    attachments: Array.isArray(task.attachments) ? task.attachments : []
  };
}

function readTasks() {
  ensureDataFile(getTasksFile(), []);
  try {
    const raw = fs.readFileSync(getTasksFile(), 'utf8');
    const parsed = parseJson(raw, []);
    if (Array.isArray(parsed)) return parsed.map(normalizeTask);
    if (parsed && typeof parsed === 'object') return [normalizeTask(parsed)];
    return [];
  } catch (error) {
    console.error('Failed to read tasks:', error);
    return [];
  }
}

function writeTasks(tasks) {
  ensureDataFile(getTasksFile(), []);
  const taskList = Array.isArray(tasks) ? tasks : tasks ? [tasks] : [];
  fs.writeFileSync(getTasksFile(), JSON.stringify(taskList.map(normalizeTask), null, 2), 'utf8');
}

function createId(prefix = 'task') {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeOpacity(value, fallback = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(1, Math.max(0.45, number));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sendCopyShortcut() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(false);
      return;
    }
    const script = "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^c')";
    execFile('powershell.exe', ['-NoProfile', '-STA', '-Command', script], { windowsHide: true }, (error) => {
      if (error) logApp('Failed to send copy shortcut', error);
      resolve(!error);
    });
  });
}

async function readSelectionViaClipboard(settings) {
  const previousText = clipboard.readText();
  const previousImage = clipboard.readImage();
  const hadImage = previousImage && !previousImage.isEmpty();
  const copied = await sendCopyShortcut();
  if (!copied) return normalizeText(previousText);
  await wait(260);
  const selectedText = normalizeText(clipboard.readText());
  if (settings.restoreClipboard) {
    if (hadImage) clipboard.writeImage(previousImage);
    else clipboard.writeText(previousText || '');
  }
  return selectedText || normalizeText(previousText);
}

function groupExists(groupId) {
  return readGroups().some((group) => group.id === groupId);
}

function parseReminder(text) {
  const now = new Date();
  const trimmed = normalizeText(text);
  if (!trimmed) return null;

  const minutesLater = trimmed.match(/(\d{1,3})\s*(分钟|分鐘|min|m)后/iu);
  if (minutesLater) {
    return new Date(now.getTime() + Number(minutesLater[1]) * 60 * 1000).toISOString();
  }

  const hoursLater = trimmed.match(/(\d{1,2})\s*(小时|小時|h)后/iu);
  if (hoursLater) {
    return new Date(now.getTime() + Number(hoursLater[1]) * 60 * 60 * 1000).toISOString();
  }

  const explicitDate = trimmed.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\s*(\d{1,2})(?::|点|點)(\d{1,2})?/u);
  if (explicitDate) {
    const [, year, month, day, hour, minute = '0'] = explicitDate;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0).toISOString();
  }

  const tomorrow = trimmed.match(/明天\s*(上午|下午|晚上)?\s*(\d{1,2})(?::|点|點)?(\d{1,2})?/u);
  if (tomorrow) {
    const [, period = '', rawHour, rawMinute = '0'] = tomorrow;
    let hour = Number(rawHour);
    if ((period === '下午' || period === '晚上') && hour < 12) hour += 12;
    const target = new Date(now);
    target.setDate(target.getDate() + 1);
    target.setHours(hour, Number(rawMinute), 0, 0);
    return target.toISOString();
  }

  const today = trimmed.match(/今天\s*(上午|下午|晚上)?\s*(\d{1,2})(?::|点|點)?(\d{1,2})?/u);
  if (today) {
    const [, period = '', rawHour, rawMinute = '0'] = today;
    let hour = Number(rawHour);
    if ((period === '下午' || period === '晚上') && hour < 12) hour += 12;
    const target = new Date(now);
    target.setHours(hour, Number(rawMinute), 0, 0);
    if (target > now) return target.toISOString();
  }

  return null;
}

function createTask(input = {}) {
  const title = normalizeText(typeof input === 'string' ? input : input.title);
  if (!title) return null;

  const now = new Date().toISOString();
  const groupId = input.groupId && groupExists(input.groupId) ? input.groupId : DEFAULT_GROUP_ID;
  const task = {
    id: createId('task'),
    title,
    note: '',
    sourceText: normalizeText(input.sourceText || ''),
    sourceApp: '',
    status: 'todo',
    priority: 'normal',
    pmStatus: input.pmStatus || 'normal',
    pinned: false,
    groupId,
    attachments: Array.isArray(input.attachments) ? input.attachments : [],
    remindAt: input.remindAt || parseReminder(title),
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    notifiedAt: null
  };

  const tasks = readTasks();
  tasks.unshift(task);
  writeTasks(tasks);
  broadcastTasks();
  return task;
}

function updateTask(id, patch) {
  const tasks = readTasks();
  const nextTasks = tasks.map((task) => {
    if (task.id !== id) return task;
    const next = normalizeTask({
      ...task,
      ...patch,
      updatedAt: new Date().toISOString()
    });

    if (patch.status === 'done' && task.status !== 'done') {
      next.completedAt = new Date().toISOString();
    }
    if (patch.status === 'todo') {
      next.completedAt = null;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'remindAt')) {
      next.notifiedAt = null;
      notifiedTaskIds.delete(id);
    }
    return next;
  });
  writeTasks(nextTasks);
  broadcastTasks();
  return nextTasks.find((task) => task.id === id) || null;
}

function deleteTask(id) {
  const tasks = readTasks().filter((task) => task.id !== id);
  notifiedTaskIds.delete(id);
  writeTasks(tasks);
  broadcastTasks();
  return true;
}

function createGroup(name) {
  const trimmed = normalizeText(name);
  if (!trimmed) return null;
  const now = new Date().toISOString();
  const group = {
    id: createId('group'),
    name: trimmed,
    createdAt: now,
    updatedAt: now
  };
  const groups = readGroups();
  groups.push(group);
  writeGroups(groups);
  broadcastGroups();
  return group;
}

function renameGroup(id, name) {
  const trimmed = normalizeText(name);
  if (!trimmed) return null;
  const groups = readGroups();
  const nextGroups = groups.map((group) => (
    group.id === id ? { ...group, name: trimmed, updatedAt: new Date().toISOString() } : group
  ));
  writeGroups(nextGroups);
  broadcastGroups();
  return nextGroups.find((group) => group.id === id) || null;
}

function deleteGroup(id) {
  if (!id || id === DEFAULT_GROUP_ID) return null;
  const groups = readGroups();
  const group = groups.find((item) => item.id === id);
  if (!group) return null;

  const nextGroups = groups.filter((item) => item.id !== id);
  const tasks = readTasks().map((task) => (
    (task.groupId || DEFAULT_GROUP_ID) === id
      ? { ...task, groupId: DEFAULT_GROUP_ID, updatedAt: new Date().toISOString() }
      : task
  ));
  if (activeGroupId === id) activeGroupId = DEFAULT_GROUP_ID;

  writeGroups(nextGroups);
  writeTasks(tasks);
  broadcastGroups();
  broadcastTasks();
  return { deletedGroupId: id, movedToGroupId: DEFAULT_GROUP_ID };
}

function makeAttachmentFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(ext)) {
    throw new Error('Only image files are supported.');
  }
  if (!fs.existsSync(filePath)) {
    throw new Error('Image file does not exist.');
  }

  ensureDir(getAttachmentsDir());
  const createdAt = new Date().toISOString();
  const id = createId('image');
  const safeExt = ext || '.png';
  const target = path.join(getAttachmentsDir(), `${id}${safeExt}`);
  fs.copyFileSync(filePath, target);

  return {
    id,
    type: 'image',
    name: path.basename(filePath),
    path: target,
    url: pathToFileURL(target).toString(),
    createdAt
  };
}

function makeAttachmentFromClipboardImage() {
  const image = clipboard.readImage();
  if (image.isEmpty()) return null;

  ensureDir(getAttachmentsDir());
  const createdAt = new Date().toISOString();
  const id = createId('image');
  const target = path.join(getAttachmentsDir(), `${id}.png`);
  fs.writeFileSync(target, image.toPNG());

  return {
    id,
    type: 'image',
    name: '剪贴板图片.png',
    path: target,
    url: pathToFileURL(target).toString(),
    createdAt
  };
}

async function selectImageFiles() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择图片',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }]
  });
  return result.canceled ? [] : result.filePaths;
}

async function createImageTasksFromFiles(groupId) {
  const files = await selectImageFiles();
  if (files.length === 0) return [];

  const tasks = [];
  for (const file of files) {
    const attachment = makeAttachmentFromFile(file);
    const title = `图片：${path.basename(file, path.extname(file))}`;
    const task = createTask({ title, groupId, attachments: [attachment] });
    if (task) tasks.push(task);
  }
  return tasks;
}

async function attachImagesToTask(taskId) {
  const files = await selectImageFiles();
  if (files.length === 0) return null;
  const attachments = files.map(makeAttachmentFromFile);
  const task = readTasks().find((item) => item.id === taskId);
  if (!task) return null;
  return updateTask(taskId, { attachments: [...(task.attachments || []), ...attachments] });
}

function createTaskFromClipboardImage(groupId) {
  const attachment = makeAttachmentFromClipboardImage();
  if (!attachment) return null;
  return createTask({ title: '剪贴板图片', groupId, attachments: [attachment] });
}

function broadcastTasks() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('tasks:changed', readTasks());
  }
}

function broadcastGroups() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('groups:changed', readGroups());
  }
}

function broadcastSettings() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('settings:changed', {
      settings: currentSettings || readSettings(),
      shortcutStatus
    });
  }
}

function createTrayIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#2563eb"/><path d="M9 9h14v3H9zM9 15h14v3H9zM9 21h9v3H9z" fill="#fff"/></svg>`;
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
}

function createMainWindow() {
  const display = screen.getPrimaryDisplay();
  const { x, y, width, height } = display.workArea;
  const windowWidth = 390;
  const windowHeight = Math.min(680, height - 48);
  const settings = currentSettings || readSettings();

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: x + width - windowWidth - 24,
    y: y + 24,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    frame: false,
    transparent: false,
    alwaysOnTop: Boolean(settings.alwaysOnTop),
    resizable: true,
    skipTaskbar: false,
    title: '轻量提醒',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setOpacity(normalizeOpacity(settings.opacity));

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  logApp('Main window loadFile requested');

  mainWindow.webContents.on('did-finish-load', () => logApp('Main window did-finish-load')); 
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    logApp(`Main window did-fail-load ${errorCode} ${errorDescription}`);
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logApp(`Renderer gone ${JSON.stringify(details)}`);
  });
  mainWindow.on('unresponsive', () => logApp('Main window unresponsive'));

  mainWindow.on('close', (event) => {
    logApp('Main window close requested');
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on('closed', () => logApp('Main window closed'));
}

function showWindowAndFocusInput() {
  if (!mainWindow) return;
  if (isWindowCollapsed) setWindowCollapsed(false);
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('quick-input:focus');
}

function toggleWindow() {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

function setWindowCollapsed(value) {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  const nextCollapsed = Boolean(value);
  if (nextCollapsed === isWindowCollapsed) return isWindowCollapsed;

  const bounds = mainWindow.getBounds();
  if (nextCollapsed) {
    expandedWindowBounds = bounds.height > COLLAPSED_WINDOW_HEIGHT ? bounds : expandedWindowBounds;
    mainWindow.setMinimumSize(MIN_WINDOW_WIDTH, COLLAPSED_WINDOW_HEIGHT);
    mainWindow.setBounds({ ...bounds, height: COLLAPSED_WINDOW_HEIGHT }, true);
  } else {
    const defaultHeight = Math.min(680, screen.getPrimaryDisplay().workArea.height - 48);
    const nextBounds = expandedWindowBounds || { ...bounds, height: defaultHeight };
    mainWindow.setBounds({ ...nextBounds, height: Math.max(nextBounds.height, MIN_WINDOW_HEIGHT) }, true);
    mainWindow.setMinimumSize(MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT);
  }

  isWindowCollapsed = nextCollapsed;
  mainWindow.webContents.send('window:collapsedChanged', isWindowCollapsed);
  return isWindowCollapsed;
}

function toggleCollapsedWindow() {
  return setWindowCollapsed(!isWindowCollapsed);
}

function restoreMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip('轻量提醒');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示 / 隐藏', click: toggleWindow },
    { label: '快速添加', click: showWindowAndFocusInput },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]));
  tray.on('click', toggleWindow);
}

function applyLoginSetting(settings) {
  try {
    app.setLoginItemSettings({
      openAtLogin: Boolean(settings.openAtLogin),
      path: process.execPath
    });
  } catch (error) {
    logApp('Failed to update login item settings', error);
  }
}

function registerShortcut(name, accelerator, callback) {
  const cleanAccelerator = normalizeText(accelerator);
  if (!cleanAccelerator) {
    shortcutStatus[name] = { ok: false, accelerator: cleanAccelerator, error: '快捷键为空' };
    return;
  }

  try {
    const ok = globalShortcut.register(cleanAccelerator, callback);
    shortcutStatus[name] = {
      ok,
      accelerator: cleanAccelerator,
      error: ok ? '' : '快捷键可能被其他程序占用'
    };
  } catch (error) {
    shortcutStatus[name] = {
      ok: false,
      accelerator: cleanAccelerator,
      error: '快捷键格式不可用'
    };
    logApp(`Failed to register shortcut ${name}=${cleanAccelerator}`, error);
  }
}

async function createClipboardTaskFromShortcut() {
  const settings = currentSettings || readSettings();
  const text = settings.autoCopySelection
    ? await readSelectionViaClipboard(settings)
    : normalizeText(clipboard.readText());
  if (!text) {
    showWindowAndFocusInput();
    return;
  }
  const task = createTask({ title: text, sourceText: text, groupId: activeGroupId });
  if (task) {
    showWindowAndFocusInput();
    mainWindow.webContents.send('task:highlight', task.id);
  }
}

function applyRuntimeSettings(settings) {
  const normalized = writeSettings(settings);
  applyLoginSetting(normalized);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(Boolean(normalized.alwaysOnTop));
    mainWindow.setOpacity(normalizeOpacity(normalized.opacity));
  }
  registerShortcuts(normalized);
  broadcastSettings();
  return { settings: normalized, shortcutStatus };
}

function registerShortcuts() {
  const settings = currentSettings || readSettings();
  const shortcuts = settings.shortcuts || defaultSettings().shortcuts;
  shortcutStatus = {};
  globalShortcut.unregisterAll();
  registerShortcut('quickInput', shortcuts.quickInput, showWindowAndFocusInput);
  registerShortcut('clipboardTask', shortcuts.clipboardTask, createClipboardTaskFromShortcut);
  registerShortcut('toggleWindow', shortcuts.toggleWindow, toggleWindow);
}

function surfaceDueTask(task) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (isWindowCollapsed) setWindowCollapsed(false);
  mainWindow.show();
  mainWindow.focus();
  mainWindow.flashFrame(true);
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.flashFrame(false);
  }, 8000);
  const sendReminder = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('reminders:due', task);
    mainWindow.webContents.send('task:highlight', task.id);
  };
  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.once('did-finish-load', sendReminder);
  } else {
    sendReminder();
  }
}

function showSystemNotification(task) {
  if (!Notification.isSupported()) return;

  const notification = new Notification({
    title: '任务提醒',
    body: task.title,
    silent: false,
    urgency: 'critical'
  });
  notification.on('click', () => surfaceDueTask(task));
  notification.show();
}

function runReminderCheck() {
  const now = Date.now();
  const tasks = readTasks();
  let changed = false;

  for (const task of tasks) {
    if (task.status === 'done' || !task.remindAt) continue;
    const remindTime = Date.parse(task.remindAt);
    if (Number.isNaN(remindTime) || remindTime > now) continue;
    if (notifiedTaskIds.has(task.id)) continue;

    notifiedTaskIds.add(task.id);
    task.notifiedAt = new Date().toISOString();
    changed = true;

    showSystemNotification(task);
    surfaceDueTask(task);
  }

  if (changed) {
    writeTasks(tasks);
    broadcastTasks();
  }
}

function startReminderScheduler() {
  if (reminderTimer) clearInterval(reminderTimer);
  reminderTimer = setInterval(runReminderCheck, 10000);
}

ipcMain.handle('tasks:list', () => readTasks());
ipcMain.handle('renderer:ready', () => {
  runReminderCheck();
  return true;
});
ipcMain.handle('tasks:create', (_event, input) => createTask(input));
ipcMain.handle('tasks:update', (_event, id, patch) => updateTask(id, patch));
ipcMain.handle('tasks:delete', (_event, id) => deleteTask(id));
ipcMain.handle('tasks:clearCompleted', (_event, groupId) => {
  const tasks = readTasks().filter((task) => task.status !== 'done' || (groupId && task.groupId !== groupId));
  writeTasks(tasks);
  broadcastTasks();
  return tasks;
});

ipcMain.handle('groups:list', () => readGroups());
ipcMain.handle('groups:create', (_event, name) => createGroup(name));
ipcMain.handle('groups:rename', (_event, id, name) => renameGroup(id, name));
ipcMain.handle('groups:delete', (_event, id) => deleteGroup(id));
ipcMain.handle('groups:setActive', (_event, id) => {
  activeGroupId = groupExists(id) ? id : DEFAULT_GROUP_ID;
  return activeGroupId;
});

ipcMain.handle('clipboard:createTask', (_event, groupId) => {
  const text = normalizeText(clipboard.readText());
  if (!text) return null;
  return createTask({ title: text, sourceText: text, groupId });
});
ipcMain.handle('clipboard:createTaskFromSelection', async (_event, groupId) => {
  const settings = currentSettings || readSettings();
  const text = await readSelectionViaClipboard(settings);
  if (!text) return null;
  return createTask({ title: text, sourceText: text, groupId });
});

ipcMain.handle('images:createTasksFromFiles', (_event, groupId) => createImageTasksFromFiles(groupId));
ipcMain.handle('images:createTaskFromClipboard', (_event, groupId) => createTaskFromClipboardImage(groupId));
ipcMain.handle('tasks:attachImages', (_event, taskId) => attachImagesToTask(taskId));
ipcMain.handle('attachments:open', (_event, attachmentPath) => {
  if (!attachmentPath || !fs.existsSync(attachmentPath)) return false;
  shell.openPath(attachmentPath);
  return true;
});

ipcMain.handle('window:hide', () => {
  if (mainWindow) mainWindow.hide();
});
ipcMain.handle('window:toggleCollapsed', () => toggleCollapsedWindow());
ipcMain.handle('window:toggleAlwaysOnTop', (_event, value) => {
  if (!mainWindow) return false;
  const next = normalizeSettings({ ...(currentSettings || readSettings()), alwaysOnTop: Boolean(value) });
  writeSettings(next);
  mainWindow.setAlwaysOnTop(Boolean(next.alwaysOnTop));
  broadcastSettings();
  return mainWindow.isAlwaysOnTop();
});

ipcMain.handle('settings:get', () => ({
  settings: currentSettings || readSettings(),
  shortcutStatus
}));
ipcMain.handle('settings:update', (_event, patch) => {
  const current = currentSettings || readSettings();
  const next = normalizeSettings({
    ...current,
    ...(patch || {}),
    shortcuts: {
      ...(current.shortcuts || {}),
      ...((patch && patch.shortcuts) || {})
    }
  });
  return applyRuntimeSettings(next);
});

app.whenReady().then(() => {
  logApp(`App ready. userData=${app.getPath('userData')}`);
  readGroups();
  currentSettings = readSettings();
  applyLoginSetting(currentSettings);
  registerShortcuts();
  createMainWindow();
  createTray();
  startReminderScheduler();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  restoreMainWindow();
});

app.on('second-instance', () => {
  logApp('Second instance requested');
  restoreMainWindow();
});

app.on('before-quit', () => {
  logApp('Before quit');
  app.isQuitting = true;
});

app.on('window-all-closed', (event) => {
  logApp('window-all-closed');
  event.preventDefault();
});

app.on('will-quit', () => {
  logApp('Will quit');
  globalShortcut.unregisterAll();
  if (reminderTimer) clearInterval(reminderTimer);
});
