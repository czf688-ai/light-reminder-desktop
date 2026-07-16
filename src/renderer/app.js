const api = window.reminderApi;

const DEFAULT_GROUP_ID = 'inbox';

const state = {
  tasks: [],
  groups: [],
  activeGroupId: DEFAULT_GROUP_ID,
  filter: 'todo',
  sidebarView: 'group',
  isSidebarCollapsed: false,
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
  isCollapsed: false,
  expandedTaskIds: new Set(),
  collapsedLeadTaskIds: new Set(),
  groupClickTimer: null,
  contextGroupId: null,
  draggedTaskId: null,
  searchQuery: ''
};

const elements = {
  form: document.querySelector('#taskForm'),
  input: document.querySelector('#taskInput'),
  list: document.querySelector('#taskList'),
  count: document.querySelector('#taskCount'),
  groupTabs: document.querySelector('#groupTabs'),
  sidebarToggle: document.querySelector('#sidebarToggle'),
  taskSearch: document.querySelector('#taskSearch'),
  groupContextMenu: document.querySelector('#groupContextMenu'),
  groupContextRename: document.querySelector('#groupContextRename'),
  groupContextDelete: document.querySelector('#groupContextDelete'),
  showAllTasks: document.querySelector('#showAllTasks'),
  showCompletedTasks: document.querySelector('#showCompletedTasks'),
  showArchivedTasks: document.querySelector('#showArchivedTasks'),
  showTodoTasks: document.querySelector('#showTodoTasks'),
  showOverdueTasks: document.querySelector('#showOverdueTasks'),
  showRiskTasks: document.querySelector('#showRiskTasks'),
  showWaitingTasks: document.querySelector('#showWaitingTasks'),
  showFavorites: document.querySelector('#showFavorites'),
  showFlagged: document.querySelector('#showFlagged'),
  allTaskCount: document.querySelector('#allTaskCount'),
  completedTaskCount: document.querySelector('#completedTaskCount'),
  archivedTaskCount: document.querySelector('#archivedTaskCount'),
  todoTaskCount: document.querySelector('#todoTaskCount'),
  overdueTaskCount: document.querySelector('#overdueTaskCount'),
  riskTaskCount: document.querySelector('#riskTaskCount'),
  waitingTaskCount: document.querySelector('#waitingTaskCount'),
  favoriteTaskCount: document.querySelector('#favoriteTaskCount'),
  flaggedTaskCount: document.querySelector('#flaggedTaskCount'),
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
  maximizeWindow: document.querySelector('#maximizeWindow'),
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
  testReminder: document.querySelector('#testReminder'),
  openNotificationSettings: document.querySelector('#openNotificationSettings'),
  resetShortcuts: document.querySelector('#resetShortcuts'),
  backupData: document.querySelector('#backupData'),
  restoreData: document.querySelector('#restoreData'),
  exportCsv: document.querySelector('#exportCsv'),
  exportMarkdown: document.querySelector('#exportMarkdown'),
  backupStatus: document.querySelector('#backupStatus'),
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
  elements.renameGroup.disabled = false;
  elements.deleteGroup.disabled = state.activeGroupId === DEFAULT_GROUP_ID;
  if (state.activeGroupId === DEFAULT_GROUP_ID) closeDeleteGroupConfirm();
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

function renderSidebarState() {
  document.body.classList.toggle('is-sidebar-collapsed', state.isSidebarCollapsed);
  elements.sidebarToggle.title = state.isSidebarCollapsed ? '展开侧边栏' : '收起侧边栏';
  elements.sidebarToggle.setAttribute('aria-label', elements.sidebarToggle.title);
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
    if (a.flagged !== b.flagged) return a.flagged ? -1 : 1;
    const aTime = a.remindAt ? Date.parse(a.remindAt) : Number.MAX_SAFE_INTEGER;
    const bTime = b.remindAt ? Date.parse(b.remindAt) : Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) return aTime - bTime;
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

function getVisibleTasks() {
  const isArchiveView = state.sidebarView === 'archived';
  const taskSource = state.sidebarView === 'group'
    ? state.tasks.filter((task) => !task.archivedAt && (task.groupId || DEFAULT_GROUP_ID) === state.activeGroupId)
    : state.tasks.filter((task) => isArchiveView ? Boolean(task.archivedAt) : !task.archivedAt);
  const sorted = sortTasks(taskSource);
  const filtered = state.filter === 'all' ? sorted
    : state.filter === 'overdue' ? sorted.filter((task) => isOverdue(task))
      : state.filter === 'waiting' ? sorted.filter((task) => task.status !== 'done' && task.pmStatus === 'waiting')
        : state.filter === 'risk' ? sorted.filter((task) => task.status !== 'done' && task.pmStatus === 'risk')
          : state.filter === 'favorites' ? sorted.filter((task) => Boolean(task.pinned))
            : state.filter === 'flagged' ? sorted.filter((task) => Boolean(task.flagged))
              : state.filter === 'archived' ? sorted
                : sorted.filter((task) => task.status === state.filter);
  const query = state.searchQuery.trim().toLocaleLowerCase('zh-CN');
  if (!query) return filtered;
  return filtered.filter((task) => [task.title, task.sourceText, task.remindAt]
    .some((value) => String(value || '').toLocaleLowerCase('zh-CN').includes(query)));
}

function updateCount() {
  const group = getActiveGroup();
  const viewLabel = state.sidebarView === 'all' ? '全部任务'
    : state.sidebarView === 'completed' ? '已完成'
      : state.sidebarView === 'archived' ? '归档'
      : state.sidebarView === 'favorites' ? '收藏'
        : state.sidebarView === 'flagged' ? '标记'
        : state.sidebarView === 'labels' ? '标签筛选'
          : (group ? group.name : '收集箱');
  elements.count.textContent = `${viewLabel} · ${getVisibleTasks().length} 项任务`;
}

function updateSidebarCounts() {
  const activeTasks = state.tasks.filter((task) => !task.archivedAt);
  const todoTasks = activeTasks.filter((task) => task.status !== 'done');
  elements.allTaskCount.textContent = String(activeTasks.length);
  elements.completedTaskCount.textContent = String(activeTasks.filter((task) => task.status === 'done').length);
  elements.archivedTaskCount.textContent = String(state.tasks.filter((task) => task.archivedAt).length);
  elements.todoTaskCount.textContent = String(todoTasks.length);
  elements.overdueTaskCount.textContent = String(todoTasks.filter((task) => isOverdue(task)).length);
  elements.riskTaskCount.textContent = String(todoTasks.filter((task) => task.pmStatus === 'risk').length);
  elements.waitingTaskCount.textContent = String(todoTasks.filter((task) => task.pmStatus === 'waiting').length);
  elements.favoriteTaskCount.textContent = String(activeTasks.filter((task) => task.pinned).length);
  elements.flaggedTaskCount.textContent = String(activeTasks.filter((task) => task.flagged).length);

  const activeId = state.sidebarView === 'all' ? 'showAllTasks'
    : state.sidebarView === 'completed' ? 'showCompletedTasks'
      : state.sidebarView === 'archived' ? 'showArchivedTasks'
      : state.sidebarView === 'favorites' ? 'showFavorites'
        : state.sidebarView === 'flagged' ? 'showFlagged'
        : state.sidebarView === 'labels' && state.filter === 'todo' ? 'showTodoTasks'
          : state.sidebarView === 'labels' && state.filter === 'overdue' ? 'showOverdueTasks'
            : state.sidebarView === 'labels' && state.filter === 'waiting' ? 'showWaitingTasks'
              : state.sidebarView === 'labels' && state.filter === 'risk' ? 'showRiskTasks'
        : '';
  for (const element of [
    elements.showAllTasks,
    elements.showCompletedTasks,
    elements.showArchivedTasks,
    elements.showFavorites,
    elements.showFlagged,
    elements.showTodoTasks,
    elements.showOverdueTasks,
    elements.showWaitingTasks,
    elements.showRiskTasks
  ]) {
    element.classList.toggle('is-active', element.id === activeId);
  }
}

function syncFilterButtons() {
  for (const item of elements.filters) {
    item.classList.toggle('is-active', item.dataset.filter === state.filter);
  }
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

async function selectGroup(groupId) {
  state.activeGroupId = groupId;
  state.sidebarView = 'group';
  state.filter = 'todo';
  await api.setActiveGroup(groupId);
  renderTasks();
  elements.input.focus();
}

function closeGroupContextMenu() {
  state.contextGroupId = null;
  elements.groupContextMenu.classList.add('is-hidden');
}

function openGroupContextMenu(group, event) {
  state.contextGroupId = group.id;
  elements.groupContextDelete.disabled = group.id === DEFAULT_GROUP_ID;
  elements.groupContextMenu.style.left = `${Math.min(event.clientX, window.innerWidth - 128)}px`;
  elements.groupContextMenu.style.top = `${Math.min(event.clientY, window.innerHeight - 92)}px`;
  elements.groupContextMenu.classList.remove('is-hidden');
}

function getDraggedTaskId(event) {
  return state.draggedTaskId || (event.dataTransfer && event.dataTransfer.getData('text/plain'));
}

async function moveTaskToGroup(taskId, groupId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task || (task.groupId || DEFAULT_GROUP_ID) === groupId) return;
  await api.updateTask(taskId, { groupId });
}

function getGroupIconClass(group) {
  if (group.id === DEFAULT_GROUP_ID) return 'group-symbol--inbox';
  const iconClasses = [
    'group-symbol--branch',
    'group-symbol--chat',
    'group-symbol--person',
    'group-symbol--collection'
  ];
  const index = Math.max(0, state.groups.findIndex((item) => item.id === group.id) - 1);
  return iconClasses[index % iconClasses.length];
}

function renderGroups() {
  elements.groupTabs.innerHTML = '';
  renderGroupControls();
  for (const group of state.groups) {
    const row = document.createElement('div');
    row.className = 'group-row';
    row.classList.toggle('is-active', state.sidebarView === 'group' && group.id === state.activeGroupId);
    row.classList.toggle('is-renaming', state.sidebarView === 'group' && group.id === state.activeGroupId && state.groupEditorMode === 'rename');
    row.dataset.groupId = group.id;
    row.addEventListener('dragenter', (event) => {
      if (!getDraggedTaskId(event)) return;
      event.preventDefault();
      row.classList.add('is-drop-target');
    });
    row.addEventListener('dragover', (event) => {
      if (!getDraggedTaskId(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      row.classList.add('is-drop-target');
    });
    row.addEventListener('dragleave', (event) => {
      if (!row.contains(event.relatedTarget)) row.classList.remove('is-drop-target');
    });
    row.addEventListener('drop', async (event) => {
      const taskId = getDraggedTaskId(event);
      if (!taskId) return;
      event.preventDefault();
      row.classList.remove('is-drop-target');
      await moveTaskToGroup(taskId, group.id);
    });

    const isInlineEditing = state.groupEditorMode === 'rename' && group.id === state.activeGroupId;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'group-tab';
    button.classList.toggle('is-active', state.sidebarView === 'group' && group.id === state.activeGroupId);
    const icons = ['⌘', '◌', '◍', '◇', '✳'];
    const icon = document.createElement('span');
    icon.className = `group-symbol ${getGroupIconClass(group)}`;
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = group.id === DEFAULT_GROUP_ID ? '▱' : icons[state.groups.findIndex((item) => item.id === group.id) % icons.length];
    const name = document.createElement('span');
    name.className = 'group-name';
    name.textContent = group.name;
    const count = document.createElement('strong');
    count.className = 'group-count';
    count.textContent = String(countOpenTasks(group.id));
    button.replaceChildren(icon, name, count);
    button.title = group.name;
    button.addEventListener('click', () => {
      if (state.groupClickTimer) window.clearTimeout(state.groupClickTimer);
      state.groupClickTimer = window.setTimeout(() => {
        state.groupClickTimer = null;
        selectGroup(group.id);
      }, 210);
    });
    button.addEventListener('dblclick', async (event) => {
      event.preventDefault();
      if (state.groupClickTimer) window.clearTimeout(state.groupClickTimer);
      state.groupClickTimer = null;
      state.activeGroupId = group.id;
      state.sidebarView = 'group';
      await api.setActiveGroup(group.id);
      openGroupEditor('rename');
    });
    button.addEventListener('contextmenu', async (event) => {
      event.preventDefault();
      if (state.groupClickTimer) window.clearTimeout(state.groupClickTimer);
      state.groupClickTimer = null;
      state.activeGroupId = group.id;
      state.sidebarView = 'group';
      await api.setActiveGroup(group.id);
      renderGroups();
      openGroupContextMenu(group, event);
    });

    if (isInlineEditing) {
      const inlineIcon = icon.cloneNode(true);
      const inlineInput = document.createElement('input');
      inlineInput.type = 'text';
      inlineInput.className = 'group-inline-name';
      inlineInput.value = group.name;
      inlineInput.setAttribute('aria-label', '分组名称');
      inlineInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          saveInlineGroupName(inlineInput.value);
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          closeGroupEditor();
        }
      });
      inlineInput.addEventListener('blur', () => saveInlineGroupName(inlineInput.value));
      row.append(inlineIcon, inlineInput, count);
    } else {
      row.appendChild(button);
    }

    if (group.id !== DEFAULT_GROUP_ID) {
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'group-delete-button';
      deleteButton.title = `删除分组 ${group.name}`;
      deleteButton.setAttribute('aria-label', deleteButton.title);
      deleteButton.addEventListener('click', (event) => {
        event.stopPropagation();
        state.activeGroupId = group.id;
        openDeleteGroupConfirm();
      });
      row.appendChild(deleteButton);
    }

    elements.groupTabs.appendChild(row);
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

  for (const attachment of attachments.slice(0, 1)) {
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
  updateSidebarCounts();
  syncFilterButtons();
  renderGroups();
  const visibleTasks = getVisibleTasks();
  elements.list.innerHTML = '';

  if (visibleTasks.length === 0) {
    renderEmpty();
    return;
  }

  for (const [index, task] of visibleTasks.entries()) {
    const node = elements.template.content.firstElementChild.cloneNode(true);
    const title = node.querySelector('.task-title');
    const meta = node.querySelector('.task-meta');
    const groupSelect = node.querySelector('.task-group-select');
    const reminderInput = node.querySelector('.task-reminder-input');
    const clearReminderButton = node.querySelector('.clear-reminder');
    const attachmentStrip = node.querySelector('.task-thumbnail');
    const detailsButton = node.querySelector('.toggle-task-details');
    const completeButton = node.querySelector('.complete-button');
    const pmStatusButton = node.querySelector('.pm-status-task');
    const attachButton = node.querySelector('.attach-task');
    const favoriteButton = node.querySelector('.favorite-task');
    const flagButton = node.querySelector('.flag-task');
    const snoozeButton = node.querySelector('.snooze-task');
    const deleteButton = node.querySelector('.delete-task');

    node.dataset.id = task.id;
    node.draggable = true;
    node.classList.toggle('is-done', task.status === 'done');
    node.classList.toggle('is-overdue', isOverdue(task));
    node.classList.toggle('is-waiting', task.pmStatus === 'waiting');
    node.classList.toggle('is-risk', task.pmStatus === 'risk');
    node.classList.toggle('is-highlighted', task.id === state.highlightedId);
    const isLeadTask = Boolean(task.flagged);
    const isLeadExpanded = state.expandedTaskIds.has(task.id);
    node.classList.toggle('is-lead-task', isLeadTask);
    node.classList.toggle('is-expanded', state.expandedTaskIds.has(task.id) || isLeadExpanded);

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
    pmStatusButton.dataset.statusLabel = task.pmStatus === 'risk'
      ? '风险'
      : task.pmStatus === 'waiting' ? '等反馈' : '待办';
    pmStatusButton.title = `当前：${getPmStatusLabel(task.pmStatus)}。点击切换。`;
    pmStatusButton.classList.toggle('is-waiting', task.pmStatus === 'waiting');
    pmStatusButton.classList.toggle('is-risk', task.pmStatus === 'risk');
    favoriteButton.classList.toggle('is-active', Boolean(task.pinned));
    favoriteButton.textContent = task.pinned ? '★' : '☆';
    favoriteButton.title = task.pinned ? '取消收藏任务' : '收藏任务';
    favoriteButton.setAttribute('aria-label', favoriteButton.title);
    flagButton.classList.toggle('is-active', Boolean(task.flagged));
    flagButton.title = task.flagged ? '取消标记任务' : '标记并置顶任务';
    flagButton.setAttribute('aria-label', flagButton.title);
    snoozeButton.classList.toggle('is-archive-action', Boolean(task.archivedAt) || task.status === 'done');
    if (task.archivedAt) {
      snoozeButton.textContent = '恢复';
      snoozeButton.title = '恢复到已完成';
      snoozeButton.setAttribute('aria-label', snoozeButton.title);
    } else if (task.status === 'done') {
      snoozeButton.textContent = '归档';
      snoozeButton.title = '归档此已完成任务';
      snoozeButton.setAttribute('aria-label', snoozeButton.title);
    }
    const isExpanded = state.expandedTaskIds.has(task.id) || isLeadExpanded;
    detailsButton.setAttribute('aria-expanded', String(isExpanded));
    detailsButton.textContent = isExpanded ? '收起' : '•••';
    detailsButton.title = isExpanded ? '收起任务操作' : '展开任务操作';
    detailsButton.setAttribute('aria-label', detailsButton.title);

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

    node.addEventListener('dragstart', (event) => {
      if (event.target.closest('button, input, select, .task-details, .attachment-thumb')) {
        event.preventDefault();
        return;
      }
      state.draggedTaskId = task.id;
      node.classList.add('is-dragging');
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', task.id);
      }
    });

    node.addEventListener('dragend', () => {
      state.draggedTaskId = null;
      node.classList.remove('is-dragging');
      document.querySelectorAll('.group-row.is-drop-target').forEach((item) => {
        item.classList.remove('is-drop-target');
      });
    });

    completeButton.addEventListener('click', () => {
      const status = task.status === 'done' ? 'todo' : 'done';
      api.updateTask(task.id, { status, archivedAt: status === 'todo' ? null : task.archivedAt });
    });

    detailsButton.addEventListener('click', () => {
      if (state.expandedTaskIds.has(task.id)) {
        state.expandedTaskIds.delete(task.id);
      } else {
        state.expandedTaskIds.add(task.id);
      }
      renderTasks();
      const activeTask = elements.list.querySelector(`[data-id="${task.id}"]`);
      if (activeTask) activeTask.scrollIntoView({ block: 'nearest' });
    });

    title.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        title.blur();
      }
      if (event.key === 'Escape') {
        title.value = task.title;
        title.blur();
      }
    });

    title.addEventListener('focus', () => {
      title.style.height = 'auto';
      title.style.height = `${title.scrollHeight}px`;
    });

    title.addEventListener('input', () => {
      title.style.height = 'auto';
      title.style.height = `${title.scrollHeight}px`;
    });

    title.addEventListener('blur', () => {
      const nextTitle = title.value.trim();
      if (nextTitle && nextTitle !== task.title) {
        api.updateTask(task.id, { title: nextTitle });
      } else {
        title.value = task.title;
      }
      title.style.height = '';
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

    favoriteButton.addEventListener('click', () => {
      api.updateTask(task.id, { pinned: !task.pinned });
    });

    flagButton.addEventListener('click', () => {
      api.updateTask(task.id, { flagged: !task.flagged });
    });

    snoozeButton.addEventListener('click', () => {
      if (task.archivedAt) {
        api.updateTask(task.id, { archivedAt: null });
        return;
      }
      if (task.status === 'done') {
        api.updateTask(task.id, { archivedAt: new Date().toISOString() });
        return;
      }
      const remindAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      api.updateTask(task.id, { remindAt });
    });

    deleteButton.addEventListener('click', () => {
      state.expandedTaskIds.delete(task.id);
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
    state.sidebarView = 'group';
    state.filter = 'todo';
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
  if (mode === 'rename') {
    elements.groupEditor.classList.add('is-hidden');
    renderGroups();
    window.setTimeout(() => {
      const input = document.querySelector('.group-inline-name');
      if (input) {
        input.focus();
        input.select();
      }
    }, 0);
    return;
  }
  elements.groupEditor.classList.remove('is-hidden');
  elements.groupNameInput.value = '';
  elements.groupNameInput.placeholder = '新分组名称';
  renderGroups();
  window.setTimeout(() => {
    elements.groupNameInput.focus();
    elements.groupNameInput.select();
  }, 0);
}

function closeGroupEditor() {
  state.groupEditorMode = null;
  elements.groupNameInput.value = '';
  elements.groupEditor.classList.add('is-hidden');
  renderGroups();
}

async function saveInlineGroupName(value) {
  if (state.groupEditorMode !== 'rename') return;
  const group = getActiveGroup();
  const nextName = String(value || '').trim();
  if (group && nextName && nextName !== group.name) {
    await api.renameGroup(group.id, nextName);
  }
  closeGroupEditor();
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
  renderSidebarState();
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
    renderTasks();
  });
}

elements.showAllTasks.addEventListener('click', () => {
  state.sidebarView = 'all';
  state.filter = 'all';
  renderTasks();
});

elements.showCompletedTasks.addEventListener('click', () => {
  state.sidebarView = 'completed';
  state.filter = 'done';
  renderTasks();
});

elements.showArchivedTasks.addEventListener('click', () => {
  state.sidebarView = 'archived';
  state.filter = 'archived';
  renderTasks();
});

elements.showFavorites.addEventListener('click', () => {
  state.sidebarView = 'favorites';
  state.filter = 'favorites';
  renderTasks();
});

elements.showFlagged.addEventListener('click', () => {
  state.sidebarView = 'flagged';
  state.filter = 'flagged';
  renderTasks();
});

elements.showTodoTasks.addEventListener('click', () => {
  state.sidebarView = 'labels';
  state.filter = 'todo';
  renderTasks();
});

elements.showOverdueTasks.addEventListener('click', () => {
  state.sidebarView = 'labels';
  state.filter = 'overdue';
  renderTasks();
});

elements.showWaitingTasks.addEventListener('click', () => {
  state.sidebarView = 'labels';
  state.filter = 'waiting';
  renderTasks();
});

elements.showRiskTasks.addEventListener('click', () => {
  state.sidebarView = 'labels';
  state.filter = 'risk';
  renderTasks();
});

elements.sidebarToggle.addEventListener('click', () => {
  state.isSidebarCollapsed = !state.isSidebarCollapsed;
  renderSidebarState();
});

elements.form.addEventListener('submit', (event) => {
  event.preventDefault();
  createTaskFromInput();
});

elements.addGroup.addEventListener('click', () => openGroupEditor('create'));

elements.renameGroup.addEventListener('click', () => openGroupEditor('rename'));

elements.deleteGroup.addEventListener('click', openDeleteGroupConfirm);

elements.confirmDeleteGroup.addEventListener('click', confirmDeleteGroup);

elements.cancelDeleteGroup.addEventListener('click', closeDeleteGroupConfirm);

elements.groupContextRename.addEventListener('click', async () => {
  const groupId = state.contextGroupId;
  closeGroupContextMenu();
  if (!groupId) return;
  state.activeGroupId = groupId;
  state.sidebarView = 'group';
  await api.setActiveGroup(groupId);
  openGroupEditor('rename');
});

elements.groupContextDelete.addEventListener('click', async () => {
  const groupId = state.contextGroupId;
  closeGroupContextMenu();
  if (!groupId || groupId === DEFAULT_GROUP_ID) return;
  state.activeGroupId = groupId;
  state.sidebarView = 'group';
  await api.setActiveGroup(groupId);
  openDeleteGroupConfirm();
});

document.addEventListener('click', (event) => {
  if (!elements.groupContextMenu.contains(event.target)) closeGroupContextMenu();
});

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

elements.collapseWindow.addEventListener('click', () => api.minimizeWindow());

elements.maximizeWindow.addEventListener('click', () => api.toggleMaximizeWindow());

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

elements.testReminder.addEventListener('click', async () => {
  const result = await api.testReminder();
  const originalText = elements.testReminder.textContent;
  elements.testReminder.textContent = result && result.delivered ? '通知正常' : '系统通知被关闭';
  elements.testReminder.title = result && result.error ? result.error : '';
  window.setTimeout(() => {
    elements.testReminder.textContent = originalText;
    elements.testReminder.title = '';
  }, 2200);
});

elements.openNotificationSettings.addEventListener('click', () => {
  api.openNotificationSettings();
});

elements.resetShortcuts.addEventListener('click', resetShortcutInputs);

elements.taskSearch.addEventListener('input', () => {
  state.searchQuery = elements.taskSearch.value;
  renderTasks();
});

elements.backupData.addEventListener('click', async () => {
  elements.backupStatus.textContent = '正在准备备份…';
  const result = await api.backupData();
  elements.backupStatus.textContent = result && result.ok
    ? '备份完成。'
    : result && result.error ? result.error : '';
});

elements.restoreData.addEventListener('click', async () => {
  elements.backupStatus.textContent = '正在恢复数据…';
  const result = await api.restoreData();
  elements.backupStatus.textContent = result && result.ok
    ? '恢复完成，已自动保留恢复前备份。'
    : result && result.error ? result.error : '';
  if (result && result.ok) {
    await refreshAll();
    renderSettings();
  }
});

async function exportTasks(format) {
  elements.backupStatus.textContent = '正在导出任务…';
  const result = await api.exportTasks(format);
  elements.backupStatus.textContent = result && result.ok
    ? '导出完成。'
    : result && result.error ? result.error : '';
}

elements.exportCsv.addEventListener('click', () => exportTasks('csv'));
elements.exportMarkdown.addEventListener('click', () => exportTasks('markdown'));

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
  if (event.key === 'Escape' && state.contextGroupId) {
    closeGroupContextMenu();
    return;
  }
  if (event.key === 'Escape') {
    elements.input.blur();
  }
});

init();
