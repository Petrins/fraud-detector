// popup.js v6 - Enhanced with statistics and activity tracking
const tabs = document.querySelectorAll('.tab');
tabs.forEach(t => t.addEventListener('click', () => {
  tabs.forEach(x=>x.classList.remove('active'));
  t.classList.add('active');
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('panel-'+t.dataset.tab).classList.add('active');
}));

const toggle = document.getElementById('enableToggle');
const wlList = document.getElementById('whitelist');
const blList = document.getElementById('blacklist');
const wlInput = document.getElementById('wl-input');
const blInput = document.getElementById('bl-input');
const addWl = document.getElementById('add-wl');
const addBl = document.getElementById('add-bl');

// Statistics elements
const threatsBlockedEl = document.getElementById('threatsBlocked');
const sitesScannedEl = document.getElementById('sitesScanned');
const trustedDomainsEl = document.getElementById('trustedDomains');
const blockedDomainsEl = document.getElementById('blockedDomains');
const activityLogEl = document.getElementById('activityLog');

// Activity log management
function addActivity(type, text) {
  const activity = {
    type,
    text,
    timestamp: Date.now()
  };
  
  chrome.storage.local.get({activityLog: []}, (data) => {
    const log = data.activityLog;
    log.unshift(activity);
    // Keep only last 10 activities
    if (log.length > 10) log.splice(10);
    
    chrome.storage.local.set({activityLog: log}, () => {
      renderActivityLog(log);
    });
  });
}

function renderActivityLog(activities) {
  if (!activities || activities.length === 0) {
    activityLogEl.innerHTML = `
      <div class="activity-item">
        <div class="activity-icon safe">
          <i class="fas fa-shield-alt"></i>
        </div>
        <div class="activity-details">
          <div class="activity-text">Extension initialized</div>
          <div class="activity-time">Ready for protection</div>
        </div>
      </div>
    `;
    return;
  }

  activityLogEl.innerHTML = activities.map(activity => {
    const iconClass = activity.type === 'blocked' ? 'danger' : 
                     activity.type === 'warning' ? 'warning' : 'safe';
    const icon = activity.type === 'blocked' ? 'fas fa-ban' :
                activity.type === 'warning' ? 'fas fa-exclamation-triangle' : 
                'fas fa-shield-alt';
    
    const timeAgo = getTimeAgo(activity.timestamp);
    
    return `
      <div class="activity-item">
        <div class="activity-icon ${iconClass}">
          <i class="${icon}"></i>
        </div>
        <div class="activity-details">
          <div class="activity-text">${activity.text}</div>
          <div class="activity-time">${timeAgo}</div>
        </div>
      </div>
    `;
  }).join('');
}

function getTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

function updateStatistics() {
  chrome.storage.local.get({
    whitelist: [], 
    blacklist: [], 
    threatsBlocked: 0, 
    sitesScanned: 0
  }, (data) => {
    threatsBlockedEl.textContent = data.threatsBlocked || 0;
    sitesScannedEl.textContent = data.sitesScanned || 0;
    trustedDomainsEl.textContent = data.whitelist.length;
    blockedDomainsEl.textContent = data.blacklist.length;
  });
}

function renderList(container, items) {
  container.innerHTML = '';
  if (items.length === 0) {
    container.innerHTML = '<div class="empty-list">No domains added</div>';
    return;
  }
  
  items.forEach((d,i)=>{
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `<span>${d}</span><span class="remove" data-index="${i}">×</span>`;
    div.querySelector('.remove').addEventListener('click', () => removeItem(container.id, i));
    container.appendChild(div);
  });
}

function removeItem(listId, index) {
  const key = listId;
  chrome.storage.local.get({whitelist:[],blacklist:[]}, data => {
    const arr = data[key];
    const removedDomain = arr[index];
    arr.splice(index,1);
    chrome.storage.local.set({[key]:arr},()=> {
      renderList(listId==='whitelist'?wlList:blList, arr);
      updateStatistics();
      addActivity('safe', `Removed ${removedDomain} from ${key === 'whitelist' ? 'trusted' : 'blocked'} domains`);
    });
  });
}

function addEntry(key, value) {
  if (!value) return;
  chrome.storage.local.get({whitelist:[],blacklist:[]}, data => {
    const arr = data[key];
    if (!arr.includes(value)) {
      arr.push(value);
      chrome.storage.local.set({[key]:arr}, () => {
        renderList(key==='whitelist'?wlList:blList, arr);
        updateStatistics();
        addActivity('safe', `Added ${value} to ${key === 'whitelist' ? 'trusted' : 'blocked'} domains`);
        if(key==='whitelist') wlInput.value=''; else blInput.value='';
      });
    }
  });
}

window.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get({
    enabled: true,
    whitelist: [],
    blacklist: [],
    activityLog: [],
    threatsBlocked: 0,
    sitesScanned: 0
  }, data => {
    toggle.checked = data.enabled;
    renderList(wlList, data.whitelist);
    renderList(blList, data.blacklist);
    renderActivityLog(data.activityLog);
    updateStatistics();
  });
  
  toggle.addEventListener('change', () => {
    chrome.storage.local.set({enabled: toggle.checked});
    addActivity('safe', toggle.checked ? 'Protection enabled' : 'Protection disabled');
  });
  
  addWl.addEventListener('click', () => addEntry('whitelist', wlInput.value.trim()));
  addBl.addEventListener('click', () => addEntry('blacklist', blInput.value.trim()));
  
  // Add enter key support for inputs
  wlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addEntry('whitelist', wlInput.value.trim());
  });
  
  blInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addEntry('blacklist', blInput.value.trim());
  });
  
  // Update statistics every 30 seconds
  setInterval(updateStatistics, 30000);
});
