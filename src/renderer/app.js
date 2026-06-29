const api = window.reminderApi;

const DEFAULT_GROUP_ID = 'inbox';

const state = {
  tasks: [],
  groups: [],
  activeGroupId: DEFAULT_GROUP_ID,
  filter: 'todo',
  groupEditorMode: null,
  dueReminders: [],
  highlightedId: null,
  settings: {
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
  },
  shortcutStatus: {},
  pendingDeleteGroupId: null,
  isCollapsed: false
};

const elements = {
  form: document.querySelector('#taskForm'),
  input: document.querySelector('#taskInput'),
  list: document.querySelector('#taskList'),
  count: document.querySelector('#taskCount'),
  groupTabs: document.querySelector('#groupTabs'),
  addGroup: document.querySelector('#addGroup'),
  renameGroup: document.querySelector('#renameGroup'),
  deleteGroup: document.querySelector('#deleteGroup'),
  groupEditor: document.querySelector('#groupEditor'),
  groupNameInput: document.querySelector('#groupNameInput'),
  cancelGroupEdit: document.querySelector('#cancelGroupEdit'),
  groupDeleteConfirm: document.querySelector('#groupDeleteConfirm'),
  groupDeleteText: document.querySelector('#groupDeleteText'),
  confirmDeleteGroup: document.querySelector('#confirmDeleteGroup'),
  cancelDeleteGroup: document.querySelector('#cancelDeleteGroup'),
  reminderPanel: document.querySelector('#reminderPanel'),
  reminderList: document.querySelector('#reminderList'),
  dismissReminderPanel: document.querySelector('#dismissReminderPanel'),
  addClipboard: document.querySelector('#addClipboard'),
  addImage: document.querySelector('#addImage'),
  pasteImage: document.querySelector('#pasteImage'),
  clearCompleted: document.querySelector('#clearCompleted'),
  hideWindow: document.querySelector('#hideWindow'),
  pinToggle: document.querySelector('#pinToggle'),
  collapseWindow: document.querySelector('#collapseWindow'),
  settingsToggle: document.querySelector('#settingsToggle'),
  settingsPanel: document.querySelector('#settingsPanel'),
  closeSettings: document.querySelector('#closeSettings'),
  settingAlwaysOnTop: document.querySelector('#settingAlwaysOnTop'),
  settingOpenAtLogin: document.querySelector('#settingOpenAtLogin'),
  settingOpacity: document.querySelector('#settingOpacity'),
  opacityValue: document.querySelector('#opacityValue'),
  settingAutoCopySelection: document.querySelector('#settingAutoCopySelection'),
  settingRestoreClipboard: document.querySelector('#settingRestoreClipboard'),
  shortcutQuickInput: document.querySelector('#shortcutQuickInput'),
  shortcutClipboardTask: document.querySelector('#shortcutClipboardTask'),
  shortcutToggleWindow: document.querySelector('#shortcutToggleWindow'),
  shortcutStatus: document.querySelector('#shortcutStatus'),
  saveSettings: document.querySelector('#saveSettings'),
  resetShortcuts: document.querySelector('#resetShortcuts'),
  quickInputHint: document.querySelector('#quickInputHint'),
  clipboardHint: document.querySelector('#clipboardHint'),
  filters: Array.from(document.querySelectorAll('.filter')),
  template: document.querySelector('#taskTemplate')
};

function getActiveGroup() {
  return state.groups.find((group) => group.id === state.activeGroupId) || state.groups[0];
}

function getDefaultSettings() {
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

function mergeSettings(settings) {
  const defaults = getDefaultSettings();
  const source = settings && typeof settings === 'object' ? settings : {};
  return {
    alwaysOnTop: Boolean(source.alwaysOnTop),
    openAtLogin: Boolean(source.openAtLogin),
    opacity: Math.min(1, Math.max(0.45, Number(source.opacity) || defaults.opacity)),
    autoCopySelection: Boolean(source.autoCopySelection),
    restoreClipboard: source.restoreClipboard !== false,
    shortcuts: {
      ...defaults.shortcuts,
      ...((source.shortcuts && typeof source.shortcuts === 'object') ? source.shortcuts : {})
    }
  };
}

function renderGroupControls() {
  const isInbox = state.activeGroupId === DEFAULT_GROUP_ID;
  elements.renameGroup.disabled = isInbox;
  elements.deleteGroup.disabled = isInbox;
  if (isInbox) closeDeleteGroupConfirm();
}

function formatShortcutForDisplay(value) {
  return String(value || '').replace(/Control/g, 'Ctrl');
}

function renderShortcutStatus() {
  const status = state.shortcutStatus || {};
  const failed = Object.values(status).filter((item) => item && item.ok === false);
  if (failed.length === 0) {
    elements.shortcutStatus.textContent = '快捷键已保存。';
    elements.shortcutStatus.classList.remove('is-warning');
    return;
  }
  elements.shortcutStatus.textContent = failed.map((item) => `${item.accelerator}：${item.error}`).join('；');
  elements.shortcutStatus.classList.add('is-warning');
}

function renderSettings() {
  const settings = mergeSettings(state.settings);
  state.settings = settings;
  elements.pinToggle.classList.toggle('is-active', Boolean(settings.alwaysOnTop));
  elements.settingAlwaysOnTop.checked = Boolean(settings.alwaysOnTop);
  elements.settingOpenAtLogin.checked = Boolean(settings.openAtLogin);
  elements.settingOpacity.value = String(Math.round(settings.opacity * 100));
  elements.opacityValue.textContent = `${Math.round(settings.opacity * 100)}%`;
  elements.settingAutoCopySelection.checked = Boolean(settings.autoCopySelection);
  elements.settingRestoreClipboard.checked = Boolean(settings.restoreClipboard);
  elements.shortcutQuickInput.value = settings.shortcuts.quickInput;
  elements.shortcutClipboardTask.value = settings.shortcuts.clipboardTask;
  elements.shortcutToggleWindow.value = settings.shortcuts.toggleWindow;
  elements.quickInputHint.textContent = `${formatShortcutForDisplay(settings.shortcuts.quickInput)} 快速输入`;
  elements.clipboardHint.textContent = `${formatShortcutForDisplay(settings.shortcuts.clipboardTask)} ${settings.autoCopySelection ? '选区添加' : '剪贴板添加'}`;
  renderShortcutStatus();
}

function openSettings() {
  renderSettings();
  elements.settingsPanel.classList.remove('is-hidden');
}

function closeSettings() {
  elements.settingsPanel.classList.add('is-hidden');
}

function renderCollapsedState() {
  document.body.classList.toggle('is-collapsed', state.isCollapsed);
  elements.collapseWindow.textContent = state.isCollapsed ? '+' : '-';
  elements.collapseWindow.title = state.isCollapsed ? '展开窗口' : '折叠窗口';
  elements.collapseWindow.setAttribute('aria-label', state.isCollapsed ? '展开窗口' : '折叠窗口');
}

function countOpenTasks(groupId) {
  return state.tasks.filter((task) => task.status !== 'done' && (task.groupId || DEFAULT_GROUP_ID) === groupId).length;
}

function getPmStatusLabel(value) {
  if (value === 'waiting') return '等反馈';
  if (value === 'risk') return '风险';
  return '待处理';
}

function getNextPmStatus(value) {
  if (value === 'normal') return 'waiting';
  if (value === 'waiting') return 'risk';
  return 'normal';
}

function formatReminder(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  const time = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });

  if (isToday) return `今天 ${time}`;
  if (isTomorrow) return `明天 ${time}`;
  return `${date.getMonth() + 1}/${date.getDate()} ${time}`;
}

function toDateTimeLocalValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromDateTimeLocalValue(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function isOverdue(task) {
  return task.status !== 'done' && task.remindAt && Date.parse(task.remindAt) <= Date.now();
}

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'todo' ? -1 : 1;
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const aTime = a.remindAt ? Date.parse(a.remindAt) : Number.MAX_SAFE_INTEGER;
    const bTime = b.remindAt ? Date.parse(b.remindAt) : Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) return aTime - bTime;
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

function getVisibleTasks() {
  const groupTasks = state.tasks.filter((task) => (task.groupId || DEFAULT_GROUP_ID) === state.activeGroupId);
  const sorted = sortTasks(groupTasks);
  if (state.filter === 'all') return sorted;
  if (state.filter === 'overdue') return sorted.filter((task) => isOverdue(task));
  if (state.filter === 'waiting') return sorted.filter((task) => task.status !== 'done' && task.pmStatus === 'waiting');
  if (state.filter === 'risk') return sorted.filter((task) => task.status !== 'done' && task.pmStatus === 'risk');
  return sorted.filter((task) => task.status === state.filter);
}

function updateCount() {
  const todoCount = countOpenTasks(state.activeGroupId);
  const group = getActiveGroup();
  elements.count.textContent = `${group ? group.name : '收集箱'} · ${todoCount} 项待办`;
}

function openDeleteGroupConfirm() {
  const group = getActiveGroup();
  if (!group || group.id === DEFAULT_GROUP_ID) return;
  state.pendingDeleteGroupId = group.id;
  elements.groupDeleteText.textContent = `删除“${group.name}”，任务移回收集箱？`;
  elements.groupDeleteConfirm.classList.remove('is-hidden');
}

function closeDeleteGroupConfirm() {
  state.pendingDeleteGroupId = null;
  elements.groupDeleteConfirm.classList.add('is-hidden');
}

async function confirmDeleteGroup() {
  if (!state.pendingDeleteGroupId) return;
  await api.deleteGroup(state.pendingDeleteGroupId);
  state.activeGroupId = DEFAULT_GROUP_ID;
  await api.setActiveGroup(DEFAULT_GROUP_ID);
  closeDeleteGroupConfirm();
  await refreshAll();
}

function renderGroups() {
  elements.groupTabs.innerHTML = '';
  renderGroupControls();
  for (const group of state.groups) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'group-tab';
    button.classList.toggle('is-active', group.id === state.activeGroupId);
    button.textContent = `${group.name} ${countOpenTasks(group.id)}`;
    button.title = group.name;
    button.addEventListener('click', async () => {
      state.activeGroupId = group.id;
      await api.setActiveGroup(group.id);
      renderGroups();
      renderTasks();
      elements.input.focus();
    });
    elements.groupTabs.appendChild(button);
  }
}

function renderEmpty() {
  const group = getActiveGroup();
  let text = '这里暂时没有任务。';
  if (state.filter === 'todo') {
    text = `${group ? group.name : '当前分组'}里还没有待办。按 Ctrl+Alt+Space 快速记一条。`;
  }
  if (state.filter === 'overdue') text = '这里没有已经到点的任务。';
  if (state.filter === 'waiting') text = '这里还没有等反馈事项。';
  if (state.filter === 'risk') text = '这里还没有风险事项。';
  elements.list.innerHTML = `<div class="empty-state">${text}</div>`;
}

function renderAttachments(container, task) {
  container.innerHTML = '';
  const attachments = Array.isArray(task.attachments) ? task.attachments : [];
  if (attachments.length === 0) return;

  for (const attachment of attachments) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'attachment-thumb';
    button.title = attachment.name || '打开图片';

    const img = document.createElement('img');
    img.src = attachment.url;
    img.alt = attachment.name || '任务图片';
    img.loading = 'lazy';

    button.appendChild(img);
    button.addEventListener('click', () => api.openAttachment(attachment.path));
    container.appendChild(button);
  }
}

function removeDueReminder(id) {
  state.dueReminders = state.dueReminders.filter((task) => task.id !== id);
  renderReminderPanel();
}

function addDueReminder(task) {
  state.dueReminders = [task, ...state.dueReminders.filter((item) => item.id !== task.id)].slice(0, 5);
  renderReminderPanel();
}

function snoozeTask(task, minutes) {
  const remindAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  api.updateTask(task.id, { remindAt });
  removeDueReminder(task.id);
}

function snoozeTomorrow(task) {
  const target = new Date();
  target.setDate(target.getDate() + 1);
  target.setHours(9, 0, 0, 0);
  api.updateTask(task.id, { remindAt: target.toISOString() });
  removeDueReminder(task.id);
}

function renderReminderPanel() {
  elements.reminderList.innerHTML = '';
  elements.reminderPanel.classList.toggle('is-hidden', state.dueReminders.length === 0);
  if (state.dueReminders.length === 0) return;

  for (const task of state.dueReminders) {
    const item = document.createElement('article');
    item.className = 'reminder-item';

    const title = document.createElement('div');
    title.className = 'reminder-title';
    title.textContent = task.title;

    const actions = document.createElement('div');
    actions.className = 'reminder-actions';

    const actionItems = [
      ['完成', () => { api.updateTask(task.id, { status: 'done' }); removeDueReminder(task.id); }],
      ['+10', () => snoozeTask(task, 10)],
      ['+30', () => snoozeTask(task, 30)],
      ['+1h', () => snoozeTask(task, 60)],
      ['明天', () => snoozeTomorrow(task)],
      ['收起', () => removeDueReminder(task.id)]
    ];

    for (const [label, handler] of actionItems) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', handler);
      actions.appendChild(button);
    }

    item.append(title, actions);
    elements.reminderList.appendChild(item);
  }
}

function renderTasks() {
  updateCount();
  renderGroups();
  const visibleTasks = getVisibleTasks();
  elements.list.innerHTML = '';

  if (visibleTasks.length === 0) {
    renderEmpty();
    return;
  }

  for (const task of visibleTasks) {
    const node = elements.template.content.firstElementChild.cloneNode(true);
    const title = node.querySelector('.task-title');
    const meta = node.querySelector('.task-meta');
    const groupSelect = node.querySelector('.task-group-select');
    const reminderInput = node.querySelector('.task-reminder-input');
    const clearReminderButton = node.querySelector('.clear-reminder');
    const attachmentStrip = node.querySelector('.attachment-strip');
    const completeButton = node.querySelector('.complete-button');
    const pmStatusButton = node.querySelector('.pm-status-task');
    const attachButton = node.querySelector('.attach-task');
    const pinButton = node.querySelector('.pin-task');
    const snoozeButton = node.querySelector('.snooze-task');
    const deleteButton = node.querySelector('.delete-task');

    node.dataset.id = task.id;
    node.classList.toggle('is-done', task.status === 'done');
    node.classList.toggle('is-overdue', isOverdue(task));
    node.classList.toggle('is-waiting', task.pmStatus === 'waiting');
    node.classList.toggle('is-risk', task.pmStatus === 'risk');
    node.classList.toggle('is-highlighted', task.id === state.highlightedId);

    title.value = task.title;
    groupSelect.innerHTML = '';
    for (const group of state.groups) {
      const option = document.createElement('option');
      option.value = group.id;
      option.textContent = group.name;
      option.selected = group.id === (task.groupId || DEFAULT_GROUP_ID);
      groupSelect.appendChild(option);
    }
    reminderInput.value = toDateTimeLocalValue(task.remindAt);
    pmStatusButton.textContent = task.pmStatus === 'risk' ? '险' : task.pmStatus === 'waiting' ? '等' : '待';
    pmStatusButton.title = `当前：${getPmStatusLabel(task.pmStatus)}。点击切换。`;
    pmStatusButton.classList.toggle('is-waiting', task.pmStatus === 'waiting');
    pmStatusButton.classList.toggle('is-risk', task.pmStatus === 'risk');
    pinButton.classList.toggle('is-active', Boolean(task.pinned));

    const reminder = formatReminder(task.remindAt);
    const created = new Date(task.createdAt).toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const imageCount = Array.isArray(task.attachments) && task.attachments.length > 0 ? ` · ${task.attachments.length} 张图片` : '';
    const statusText = task.pmStatus && task.pmStatus !== 'normal' ? ` · ${getPmStatusLabel(task.pmStatus)}` : '';
    meta.textContent = reminder ? `提醒 ${reminder}${statusText}${imageCount}` : `创建 ${created}${statusText}${imageCount}`;
    renderAttachments(attachmentStrip, task);

    completeButton.addEventListener('click', () => {
      const status = task.status === 'done' ? 'todo' : 'done';
      api.updateTask(task.id, { status });
    });

    title.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') title.blur();
      if (event.key === 'Escape') {
        title.value = task.title;
        title.blur();
      }
    });

    title.addEventListener('blur', () => {
      const nextTitle = title.value.trim();
      if (nextTitle && nextTitle !== task.title) {
        api.updateTask(task.id, { title: nextTitle });
      } else {
        title.value = task.title;
      }
    });

    groupSelect.addEventListener('change', () => {
      api.updateTask(task.id, { groupId: groupSelect.value });
    });

    reminderInput.addEventListener('change', () => {
      api.updateTask(task.id, { remindAt: fromDateTimeLocalValue(reminderInput.value) });
    });

    clearReminderButton.addEventListener('click', () => {
      api.updateTask(task.id, { remindAt: null });
    });

    pmStatusButton.addEventListener('click', () => {
      api.updateTask(task.id, { pmStatus: getNextPmStatus(task.pmStatus || 'normal') });
    });

    attachButton.addEventListener('click', async () => {
      await api.attachImagesToTask(task.id);
    });

    pinButton.addEventListener('click', () => {
      api.updateTask(task.id, { pinned: !task.pinned });
    });

    snoozeButton.addEventListener('click', () => {
      const remindAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      api.updateTask(task.id, { remindAt });
    });

    deleteButton.addEventListener('click', () => {
      api.deleteTask(task.id);
    });

    elements.list.appendChild(node);
  }
}

async function createTaskFromInput() {
  const title = elements.input.value.trim();
  if (!title) return;
  const task = await api.createTask({ title, groupId: state.activeGroupId });
  elements.input.value = '';
  if (task) highlightTask(task.id);
}

function highlightTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (task && task.groupId && task.groupId !== state.activeGroupId) {
    state.activeGroupId = task.groupId;
    api.setActiveGroup(task.groupId);
  }
  state.highlightedId = id;
  renderTasks();
  const node = elements.list.querySelector(`[data-id="${CSS.escape(id)}"]`);
  if (node) node.scrollIntoView({ block: 'nearest' });
  window.setTimeout(() => {
    if (state.highlightedId === id) {
      state.highlightedId = null;
      renderTasks();
    }
  }, 2200);
}

async function refreshAll() {
  const [groups, tasks, settingsPayload] = await Promise.all([api.listGroups(), api.listTasks(), api.getSettings()]);
  state.groups = groups;
  state.tasks = tasks;
  state.settings = mergeSettings(settingsPayload && settingsPayload.settings);
  state.shortcutStatus = (settingsPayload && settingsPayload.shortcutStatus) || {};
  if (!state.groups.some((group) => group.id === state.activeGroupId)) {
    state.activeGroupId = state.groups[0]?.id || DEFAULT_GROUP_ID;
  }
  await api.setActiveGroup(state.activeGroupId);
  renderTasks();
  renderSettings();
}

function openGroupEditor(mode) {
  const group = getActiveGroup();
  state.groupEditorMode = mode;
  elements.groupEditor.classList.remove('is-hidden');
  elements.groupNameInput.value = mode === 'rename' && group ? group.name : '';
  elements.groupNameInput.placeholder = mode === 'rename' ? '新的分组名称' : '新分组名称';
  window.setTimeout(() => {
    elements.groupNameInput.focus();
    elements.groupNameInput.select();
  }, 0);
}

function closeGroupEditor() {
  state.groupEditorMode = null;
  elements.groupNameInput.value = '';
  elements.groupEditor.classList.add('is-hidden');
}

async function saveSettingsFromForm() {
  const payload = {
    alwaysOnTop: elements.settingAlwaysOnTop.checked,
    openAtLogin: elements.settingOpenAtLogin.checked,
    opacity: Number(elements.settingOpacity.value) / 100,
    autoCopySelection: elements.settingAutoCopySelection.checked,
    restoreClipboard: elements.settingRestoreClipboard.checked,
    shortcuts: {
      quickInput: elements.shortcutQuickInput.value.trim(),
      clipboardTask: elements.shortcutClipboardTask.value.trim(),
      toggleWindow: elements.shortcutToggleWindow.value.trim()
    }
  };
  const result = await api.updateSettings(payload);
  state.settings = mergeSettings(result && result.settings);
  state.shortcutStatus = (result && result.shortcutStatus) || {};
  renderSettings();
}

function resetShortcutInputs() {
  const defaults = getDefaultSettings().shortcuts;
  elements.shortcutQuickInput.value = defaults.quickInput;
  elements.shortcutClipboardTask.value = defaults.clipboardTask;
  elements.shortcutToggleWindow.value = defaults.toggleWindow;
}

async function init() {
  await refreshAll();
  elements.input.focus();

  api.onTasksChanged((tasks) => {
    state.tasks = tasks;
    renderTasks();
  });

  api.onGroupsChanged((groups) => {
    state.groups = groups;
    if (!state.groups.some((group) => group.id === state.activeGroupId)) {
      state.activeGroupId = state.groups[0]?.id || DEFAULT_GROUP_ID;
    }
    api.setActiveGroup(state.activeGroupId);
    renderTasks();
  });

  api.onSettingsChanged((payload) => {
    state.settings = mergeSettings(payload && payload.settings);
    state.shortcutStatus = (payload && payload.shortcutStatus) || {};
    renderSettings();
  });

  api.onCollapsedChanged((isCollapsed) => {
    state.isCollapsed = Boolean(isCollapsed);
    renderCollapsedState();
  });

  api.onFocusQuickInput(() => {
    elements.input.focus();
    elements.input.select();
  });

  api.onHighlightTask((id) => {
    highlightTask(id);
  });

  api.onReminderDue((task) => {
    addDueReminder(task);
    highlightTask(task.id);
  });

  api.rendererReady();
}

for (const filter of elements.filters) {
  filter.addEventListener('click', () => {
    state.filter = filter.dataset.filter;
    for (const item of elements.filters) {
      item.classList.toggle('is-active', item === filter);
    }
    renderTasks();
  });
}

elements.form.addEventListener('submit', (event) => {
  event.preventDefault();
  createTaskFromInput();
});

elements.addGroup.addEventListener('click', () => openGroupEditor('create'));

elements.renameGroup.addEventListener('click', () => openGroupEditor('rename'));

elements.deleteGroup.addEventListener('click', openDeleteGroupConfirm);

elements.confirmDeleteGroup.addEventListener('click', confirmDeleteGroup);

elements.cancelDeleteGroup.addEventListener('click', closeDeleteGroupConfirm);

elements.groupEditor.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = elements.groupNameInput.value.trim();
  if (!name) return;

  if (state.groupEditorMode === 'rename') {
    const group = getActiveGroup();
    if (group) await api.renameGroup(group.id, name);
    closeGroupEditor();
    return;
  }

  const group = await api.createGroup(name);
  if (group) {
    state.activeGroupId = group.id;
    await api.setActiveGroup(group.id);
    await refreshAll();
  }
  closeGroupEditor();
});

elements.cancelGroupEdit.addEventListener('click', closeGroupEditor);

elements.groupNameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeGroupEditor();
});

elements.addClipboard.addEventListener('click', async () => {
  const task = await api.createTaskFromClipboard(state.activeGroupId);
  if (task) highlightTask(task.id);
});

elements.addImage.addEventListener('click', async () => {
  const tasks = await api.createImageTasksFromFiles(state.activeGroupId);
  if (tasks && tasks[0]) highlightTask(tasks[0].id);
});

elements.pasteImage.addEventListener('click', async () => {
  const task = await api.createImageTaskFromClipboard(state.activeGroupId);
  if (task) highlightTask(task.id);
});

elements.clearCompleted.addEventListener('click', () => {
  api.clearCompleted(state.activeGroupId);
});

elements.dismissReminderPanel.addEventListener('click', () => {
  state.dueReminders = [];
  renderReminderPanel();
});

elements.hideWindow.addEventListener('click', () => {
  api.hideWindow();
});

elements.collapseWindow.addEventListener('click', async () => {
  state.isCollapsed = await api.toggleCollapsed();
  renderCollapsedState();
});

elements.settingsToggle.addEventListener('click', async () => {
  if (state.isCollapsed) {
    state.isCollapsed = await api.toggleCollapsed();
    renderCollapsedState();
  }
  openSettings();
});

elements.closeSettings.addEventListener('click', closeSettings);

elements.settingsPanel.addEventListener('click', (event) => {
  if (event.target === elements.settingsPanel) closeSettings();
});

elements.saveSettings.addEventListener('click', saveSettingsFromForm);

elements.resetShortcuts.addEventListener('click', resetShortcutInputs);

elements.settingAlwaysOnTop.addEventListener('change', saveSettingsFromForm);

elements.settingOpenAtLogin.addEventListener('change', saveSettingsFromForm);

elements.settingOpacity.addEventListener('input', () => {
  elements.opacityValue.textContent = `${elements.settingOpacity.value}%`;
});

elements.settingOpacity.addEventListener('change', saveSettingsFromForm);

elements.settingAutoCopySelection.addEventListener('change', saveSettingsFromForm);

elements.settingRestoreClipboard.addEventListener('change', saveSettingsFromForm);

elements.pinToggle.addEventListener('click', async () => {
  const nextAlwaysOnTop = !state.settings.alwaysOnTop;
  const actual = await api.toggleAlwaysOnTop(nextAlwaysOnTop);
  state.settings = mergeSettings({ ...state.settings, alwaysOnTop: actual });
  renderSettings();
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !elements.settingsPanel.classList.contains('is-hidden')) {
    closeSettings();
    return;
  }
  if (event.key === 'Escape' && state.groupEditorMode) {
    closeGroupEditor();
    return;
  }
  if (event.key === 'Escape' && state.pendingDeleteGroupId) {
    closeDeleteGroupConfirm();
    return;
  }
  if (event.key === 'Escape') {
    elements.input.blur();
  }
});

init();
