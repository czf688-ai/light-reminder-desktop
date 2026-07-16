const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('reminderApi', {
  listTasks: () => ipcRenderer.invoke('tasks:list'),
  createTask: (input) => ipcRenderer.invoke('tasks:create', input),
  updateTask: (id, patch) => ipcRenderer.invoke('tasks:update', id, patch),
  deleteTask: (id) => ipcRenderer.invoke('tasks:delete', id),
  clearCompleted: (groupId) => ipcRenderer.invoke('tasks:clearCompleted', groupId),
  createTaskFromClipboard: (groupId) => ipcRenderer.invoke('clipboard:createTask', groupId),
  createTaskFromSelection: (groupId) => ipcRenderer.invoke('clipboard:createTaskFromSelection', groupId),
  listGroups: () => ipcRenderer.invoke('groups:list'),
  createGroup: (name) => ipcRenderer.invoke('groups:create', name),
  renameGroup: (id, name) => ipcRenderer.invoke('groups:rename', id, name),
  deleteGroup: (id) => ipcRenderer.invoke('groups:delete', id),
  setActiveGroup: (id) => ipcRenderer.invoke('groups:setActive', id),
  createImageTasksFromFiles: (groupId) => ipcRenderer.invoke('images:createTasksFromFiles', groupId),
  createImageTaskFromClipboard: (groupId) => ipcRenderer.invoke('images:createTaskFromClipboard', groupId),
  attachImagesToTask: (taskId) => ipcRenderer.invoke('tasks:attachImages', taskId),
  openAttachment: (attachmentPath) => ipcRenderer.invoke('attachments:open', attachmentPath),
  rendererReady: () => ipcRenderer.invoke('renderer:ready'),
  hideWindow: () => ipcRenderer.invoke('window:hide'),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggleMaximize'),
  toggleCollapsed: () => ipcRenderer.invoke('window:toggleCollapsed'),
  toggleAlwaysOnTop: (value) => ipcRenderer.invoke('window:toggleAlwaysOnTop', value),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
  testReminder: () => ipcRenderer.invoke('reminders:test'),
  openNotificationSettings: () => ipcRenderer.invoke('settings:openNotificationSettings'),
  backupData: () => ipcRenderer.invoke('data:backup'),
  restoreData: () => ipcRenderer.invoke('data:restore'),
  exportTasks: (format) => ipcRenderer.invoke('data:exportTasks', format),
  onTasksChanged: (callback) => {
    const listener = (_event, tasks) => callback(tasks);
    ipcRenderer.on('tasks:changed', listener);
    return () => ipcRenderer.removeListener('tasks:changed', listener);
  },
  onGroupsChanged: (callback) => {
    const listener = (_event, groups) => callback(groups);
    ipcRenderer.on('groups:changed', listener);
    return () => ipcRenderer.removeListener('groups:changed', listener);
  },
  onSettingsChanged: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('settings:changed', listener);
    return () => ipcRenderer.removeListener('settings:changed', listener);
  },
  onFocusQuickInput: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('quick-input:focus', listener);
    return () => ipcRenderer.removeListener('quick-input:focus', listener);
  },
  onHighlightTask: (callback) => {
    const listener = (_event, id) => callback(id);
    ipcRenderer.on('task:highlight', listener);
    return () => ipcRenderer.removeListener('task:highlight', listener);
  },
  onReminderDue: (callback) => {
    const listener = (_event, task) => callback(task);
    ipcRenderer.on('reminders:due', listener);
    return () => ipcRenderer.removeListener('reminders:due', listener);
  },
  onCollapsedChanged: (callback) => {
    const listener = (_event, isCollapsed) => callback(isCollapsed);
    ipcRenderer.on('window:collapsedChanged', listener);
    return () => ipcRenderer.removeListener('window:collapsedChanged', listener);
  }
});
