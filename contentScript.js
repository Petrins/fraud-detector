// contentScript.js v42: Added "Safe Email" banner with insurance.png icon and tooltip styles
console.log('Fraud Detector contentScript v42 loaded');

let extensionEnabled = true;
let threshold = 0.5;
let whitelist = [];
let blacklist = [];

// Load preferences
chrome.storage.local.get({
  enabled: true,
  threshold: 0.5,
  whitelist: [],
  blacklist: []
}, prefs => {
  extensionEnabled = prefs.enabled;
  threshold = prefs.threshold;
  whitelist = prefs.whitelist;
  blacklist = prefs.blacklist;
}); // <-- This closes the chrome.storage.local.get callback

// Listen for preference changes and reset scan
chrome.storage.onChanged.addListener(changes => {
  let needReset = false;
  if (changes.enabled)      { extensionEnabled = changes.enabled.newValue; needReset = true; }
  if (changes.threshold)    { threshold = changes.threshold.newValue; }
  if (changes.whitelist)    { whitelist = changes.whitelist.newValue; needReset = true; }
  if (changes.blacklist)    { blacklist = changes.blacklist.newValue; needReset = true; }
  if (needReset) {
    // Clear processed content cache
    if (processEmailContainer.processedContent) {
      processEmailContainer.processedContent.clear();
    }
    
    document.querySelectorAll('[data-scanned="true"]').forEach(el => delete el.dataset.scanned);
    document.querySelectorAll('.vt-badge').forEach(el => el.remove());
    document.getElementById('fraud-unified-banner')?.remove();
    
    // Debounce the rescan
    clearTimeout(chrome.storage.onChanged.resetTimer);
    chrome.storage.onChanged.resetTimer = setTimeout(scanEmail, 1000);
  }
});

// Inject CSS if missing
if (!document.getElementById('fraud-style-v42')) {
  const style = document.getElementById('fraud-style-v41') || document.createElement('style');
  style.id = 'fraud-style-v42';
  style.textContent = `
#fraud-unified-banner {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 85%;
  max-width: 400px;
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
  color: #e0e0e0;
  padding: 16px 20px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.6), 0 2px 12px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(16px);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 99999;
  animation: fraudSlideDown 0.5s ease-out forwards;
  overflow: hidden;
  transition: opacity 0.3s, transform 0.4s;
}

#fraud-unified-banner::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="0.5"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>');
  opacity: 0.3;
  pointer-events: none;
  border-radius: 12px;
}

#fraud-unified-banner.safe {
  background: linear-gradient(135deg, #0a1a0a 0%, #1a2a1a 50%, #0f1f0f 100%);
  border: 1px solid rgba(52, 168, 83, 0.3);
  box-shadow: 0 8px 32px rgba(52, 168, 83, 0.15), 0 4px 16px rgba(0, 0, 0, 0.3);
}

#fraud-unified-banner.warning {
  background: linear-gradient(135deg, #1a0a0a 0%, #2a1a1a 50%, #1f0f0f 100%);
  border: 1px solid rgba(231, 76, 60, 0.3);
  box-shadow: 0 8px 32px rgba(231, 76, 60, 0.15), 0 4px 16px rgba(0, 0, 0, 0.3);
}

#fraud-unified-banner.caution {
  background: linear-gradient(135deg, #1a1a0a 0%, #2a2a1a 50%, #1f1f0f 100%);
  border: 1px solid rgba(230, 126, 34, 0.3);
  box-shadow: 0 8px 32px rgba(230, 126, 34, 0.15), 0 4px 16px rgba(0, 0, 0, 0.3);
}

@keyframes fraudSlideDown {
  from { 
    transform: translateX(-50%) translateY(-100%);
    opacity: 0;
  }
  to { 
    transform: translateX(-50%) translateY(0);
    opacity: 1;
  }
}

@keyframes fraudSlideUp {
  from { 
    transform: translateX(-50%) translateY(0);
    opacity: 1;
  }
  to { 
    transform: translateX(-50%) translateY(-100%);
    opacity: 0;
  }
}

.vt-badge {
  margin-left: 6px;
  font-size: 11px;
  padding: 3px 6px;
  border-radius: 4px;
  display: inline-block;
  font-weight: 500;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: all 0.2s;
}

.vt-badge:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
}

.vt-badge-harmless {
  background: #1a2a1a;
  color: #b0f0b0;
  border: 1px solid rgba(100, 255, 100, 0.2);
}

.vt-badge-malicious {
  background: #2a1a1a;
  color: #ff8080;
  border: 1px solid rgba(255, 100, 100, 0.2);
}

.vt-badge-unknown {
  background: #1a1a1a;
  color: #888888;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.fraud-highlight-term {
  background: rgba(255, 200, 0, 0.15);
  outline: 1px dashed rgba(255, 165, 0, 0.4);
  border-radius: 3px;
  cursor: help;
  position: relative;
  display: inline-block;
  padding: 0 2px;
  text-decoration: none !important;
  color: inherit !important;
}

.fraud-highlight-term.high-risk {
  background: rgba(208, 66, 66, 0.15);
  outline: 1px dashed rgba(208, 66, 66, 0.4);
}

.fraud-highlight-term.medium-risk {
  background: rgba(230, 126, 34, 0.15);
  outline: 1px dashed rgba(230, 126, 34, 0.4);
}

.fraud-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(-6px);
  background: rgba(26, 26, 26, 0.95);
  color: #e0e0e0;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 11px;
  white-space: nowrap;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  z-index: 9999;
}

.fraud-highlight-term:hover .fraud-tooltip {
  opacity: 1;
  pointer-events: auto;
}

.safe-circle, .phish-circle {
  width: 44px;
  height: 44px;
  border: 2px solid;
  color: #e0e0e0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.05);
  transition: all 0.3s ease;
  position: relative;
}

.safe-circle {
  border-color: #34a853;
  background: linear-gradient(135deg, rgba(52, 168, 83, 0.15) 0%, rgba(46, 125, 50, 0.25) 100%);
  box-shadow: 0 4px 12px rgba(52, 168, 83, 0.2), inset 0 2px 4px rgba(52, 168, 83, 0.1);
}

.phish-circle {
  border-color: #e74c3c;
  background: linear-gradient(135deg, rgba(231, 76, 60, 0.15) 0%, rgba(192, 57, 43, 0.25) 100%);
  box-shadow: 0 4px 12px rgba(231, 76, 60, 0.2), inset 0 2px 4px rgba(231, 76, 60, 0.1);
}

.phish-circle.caution {
  border-color: #e67e22;
  background: linear-gradient(135deg, rgba(230, 126, 34, 0.15) 0%, rgba(211, 84, 0, 0.25) 100%);
  box-shadow: 0 4px 12px rgba(230, 126, 34, 0.2), inset 0 2px 4px rgba(230, 126, 34, 0.1);
}

.safe-circle img, .phish-circle img {
  width: 24px;
  height: 24px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  position: relative;
}

.banner-title {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  margin: 0 0 12px 0;
  line-height: 1.4;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  letter-spacing: -0.01em;
}

.reputation-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 13px;
  color: #d0d0d0;
  margin-top: 12px;
  padding: 12px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.reputation-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.reputation-item:hover {
  background: linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.reputation-item.caution {
  background: linear-gradient(135deg, rgba(230, 126, 34, 0.15) 0%, rgba(211, 84, 0, 0.2) 100%);
  border: 1px solid rgba(230, 126, 34, 0.3);
  color: #e67e22;
}

.reputation-item.warning {
  background: linear-gradient(135deg, rgba(231, 76, 60, 0.15) 0%, rgba(192, 57, 43, 0.2) 100%);
  border: 1px solid rgba(231, 76, 60, 0.3);
  color: #e74c3c;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #888888;
  font-size: 20px;
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  border-radius: 50%;
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.close-btn:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.risk-meter {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.risk-label {
  font-size: 14px;
  font-weight: 500;
  color: #cccccc;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-size: 12px;
}

.risk-percentage {
  font-size: 15px;
  font-weight: 700;
  color: #ff6b6b;
  padding: 4px 12px;
  background: rgba(255, 107, 107, 0.1);
  border-radius: 20px;
  border: 1px solid rgba(255, 107, 107, 0.2);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
}

.risk-percentage.safe {
  color: #4caf50;
  background: rgba(76, 175, 80, 0.1);
  border: 1px solid rgba(76, 175, 80, 0.2);
}

.risk-percentage.caution {
  color: #ff9800;
  background: rgba(255, 152, 0, 0.1);
  border: 1px solid rgba(255, 152, 0, 0.2);
}

.highlighted-terms {
  margin-top: 12px;
  font-size: 12px;
  color: #cccccc;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.highlighted-terms span {
  display: inline-block;
  margin-right: 8px;
  background: linear-gradient(135deg, rgba(150, 150, 150, 0.15) 0%, rgba(120, 120, 120, 0.2) 100%);
  padding: 4px 10px;
  border-radius: 6px;
  margin-bottom: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-weight: 500;
  transition: all 0.2s ease;
}

.highlighted-terms span:hover {
  background: linear-gradient(135deg, rgba(150, 150, 150, 0.25) 0%, rgba(120, 120, 120, 0.3) 100%);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.term-group {
  margin-bottom: 10px;
  line-height: 1.6;
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.02);
  border-left: 3px solid rgba(255, 255, 255, 0.1);
}

.term-group.high-risk {
  background: rgba(231, 76, 60, 0.05);
  border-left-color: #e74c3c;
}

.term-group.medium-risk {
  background: rgba(230, 126, 34, 0.05);
  border-left-color: #e67e22;
}

.term-group-label {
  font-size: 11px;
  color: #bbbbbb;
  margin-right: 8px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.term {
  display: inline-block;
  margin-right: 8px;
  padding: 3px 8px;
  border-radius: 6px;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.term.high-risk {
  background: rgba(231, 76, 60, 0.15);
  border: 1px solid rgba(231, 76, 60, 0.3);
  color: #e74c3c;
}

.term.medium-risk {
  background: rgba(230, 126, 34, 0.15);
  border: 1px solid rgba(230, 126, 34, 0.3);
  color: #e67e22;
}

.term:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.risk-explanation {
  display: inline-flex;
  position: relative;
  margin-left: 10px;
}

.info-button {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.08) 100%);
  backdrop-filter: blur(8px);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 11px;
  line-height: 1;
  padding: 0;
  cursor: pointer;
  margin-left: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 
    0 2px 8px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.info-button:hover {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.15) 100%);
  border-color: rgba(255, 255, 255, 0.3);
  color: #ffffff;
  transform: scale(1.05);
  box-shadow: 
    0 4px 12px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.explanation-tooltip {
  position: fixed;
  top: 160px;
  left: 50%;
  transform: translateX(-50%);
  min-width: 280px;
  max-width: 380px;
  background: linear-gradient(135deg, rgba(15, 15, 15, 0.98) 0%, rgba(25, 25, 30, 0.98) 100%);
  backdrop-filter: blur(12px);
  color: #ffffff;
  padding: 18px 24px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
  white-space: normal;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.6),
    0 0 0 1px rgba(255, 255, 255, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  opacity: 0;
  pointer-events: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  z-index: 9998;
}

.explanation-tooltip.visible {
  opacity: 1;
  pointer-events: auto;
  animation: tooltipPulse 0.3s ease;
}

@keyframes tooltipPulse {
  0% { 
    transform: translateX(-50%) scale(0.95); 
    opacity: 0;
  }
  50% { 
    transform: translateX(-50%) scale(1.02);
    opacity: 0.8;
  }
  100% { 
    transform: translateX(-50%) scale(1); 
    opacity: 1;
  }
}

.explanation-tooltip::before {
  content: "";
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  border-bottom: 10px solid rgba(15, 15, 15, 0.98);
  filter: drop-shadow(0 -2px 4px rgba(0, 0, 0, 0.3));
}

.tooltip-header {
  font-weight: 600;
  margin-bottom: 10px;
  color: #ffffff;
  font-size: 15px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  letter-spacing: 0.025em;
}

.explanation-tooltip ul {
  margin: 0;
  padding-left: 20px;
  list-style-type: none;
}

.explanation-tooltip li {
  margin-bottom: 8px;
  position: relative;
  padding-left: 0;
}

.explanation-tooltip li::before {
  content: "•";
  color: rgba(255, 255, 255, 0.6);
  font-weight: bold;
  position: absolute;
  left: -16px;
  top: 0;
}

.explanation-tooltip li:last-child {
  margin-bottom: 0;
}

.banner-title {
  font-weight: 500;
`;
  document.head.appendChild(style);
}

// Add these improved styles to fix badge sizing and tooltip placement

// First, create a new style element specifically for these fixes
const fixesStyle = document.createElement('style');
fixesStyle.id = 'fraud-fixes-v43';
fixesStyle.textContent = `
/* Fixed-size badges */
.vt-badge {
  margin-left: 6px;
  font-size: 11px;
  padding: 3px 6px;
  border-radius: 4px;
  display: inline-block;
  font-weight: 500;
  min-width: 80px;
  text-align: center;
  box-sizing: border-box;
  white-space: nowrap;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: all 0.2s;
  position: relative;
  z-index: 9990;
}

/* Improved tooltip positioning that appears below the banner */
.explanation-tooltip {
  position: fixed;
  top: 100px; /* Position below the more compact banner */
  left: 50%;
  transform: translateX(-50%);
  min-width: 280px;
  max-width: 380px;
  background: linear-gradient(135deg, rgba(15, 15, 15, 0.98) 0%, rgba(25, 25, 30, 0.98) 100%);
  backdrop-filter: blur(12px);
  color: #ffffff;
  padding: 18px 24px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
  white-space: normal;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.6),
    0 0 0 1px rgba(255, 255, 255, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  opacity: 0;
  pointer-events: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  z-index: 10000; /* Higher than the banner */
}

.explanation-tooltip.visible {
  opacity: 1;
  pointer-events: auto;
  animation: tooltipPulse 0.3s ease;
}

/* Make info button more visible */
.info-button {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.08) 100%);
  backdrop-filter: blur(8px);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  padding: 0;
  cursor: pointer;
  margin-left: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 
    0 2px 8px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.info-button:hover {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.15) 100%);
  border-color: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
  box-shadow: 
    0 4px 12px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}
`;

// Inject these styles into the document
document.head.appendChild(fixesStyle);

// Update the inbox badge styles to ensure they have a fixed size

// Find the existing style definition for .fraud-inbox-badge
const updatedInboxBadgeStyles = document.createElement('style');
updatedInboxBadgeStyles.id = 'fraud-inbox-badge-styles-v2';
updatedInboxBadgeStyles.textContent = `
.fraud-inbox-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  margin-right: 6px;
  position: relative;
  font-size: 11px;
  font-weight: bold;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  cursor: help;
  flex-shrink: 0; /* Prevent shrinking */
  box-sizing: content-box; /* Ensure padding doesn't affect size */
}

.fraud-inbox-badge .badge-icon {
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

/* Make sure badges don't get distorted in flex containers */
tr[role="row"] {
  contain: layout style;
}

/* Ensure the badge container doesn't get squeezed */
.xW, .time, .y2, .bq9 {
  display: flex !important;
  align-items: center !important;
}
`;

// Inject the updated styles
document.head.appendChild(updatedInboxBadgeStyles);

// Function to update statistics in storage
function updateStatistics(type) {
  chrome.storage.local.get({
    threatsBlocked: 0,
    sitesScanned: 0
  }, (data) => {
    const updates = {};
    
    if (type === 'threatBlocked') {
      updates.threatsBlocked = (data.threatsBlocked || 0) + 1;
      // Also add activity log entry
      addActivityLog('blocked', 'Threat detected and blocked');
    } else if (type === 'siteScanned') {
      updates.sitesScanned = (data.sitesScanned || 0) + 1;
      // Occasionally log scanning activity (not for every email to avoid spam)
      if (updates.sitesScanned % 5 === 0) {
        addActivityLog('safe', `Scanned ${updates.sitesScanned} emails`);
      }
    }
    
    chrome.storage.local.set(updates, () => {
      console.log(`Updated statistics: ${type}`, updates);
    });
  });
}

// Function to add activity log entry
function addActivityLog(type, text) {
  chrome.storage.local.get({activityLog: []}, (data) => {
    const activity = {
      type,
      text,
      timestamp: Date.now()
    };
    
    const log = data.activityLog;
    log.unshift(activity);
    
    // Keep only last 10 activities
    if (log.length > 10) log.splice(10);
    
    chrome.storage.local.set({activityLog: log});
  });
}

// Domain-matching helper
function matchesDomain(host, domain) {
  host = host.toLowerCase();
  domain = domain.toLowerCase();
  return host === domain || host.endsWith('.' + domain);
}

// Fix for tooltip not disappearing with banner

// First, let's update the animation end handler for the banner
// Add this function at the top level of your script
function setupBannerAnimationHandlers(banner) {
  // Remove any existing tooltips when banner animation ends (sliding up)
  banner.addEventListener('animationend', (event) => {
    if (event.animationName === 'fraudSlideUp') {
      // Remove the banner
      banner.remove();
      
      // Also remove any tooltips that might be visible
      document.querySelectorAll('.explanation-tooltip.visible').forEach(tooltip => {
        tooltip.remove();
      });
    }
  });
}

// Fix the close button functionality
function setupBannerCloseButton(banner) {
  const closeBtn = banner.querySelector('.close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Force remove the banner
      banner.style.animation = 'none';
      banner.remove();
      
      // Also remove any tooltips
      document.querySelectorAll('.explanation-tooltip.visible').forEach(tooltip => {
        tooltip.remove();
      });
    });
  }
}

// Add email navigation detection to automatically remove the banner

// Add this function after setupBannerCloseButton
function setupEmailNavigationDetection() {
  // Monitor URL changes to detect when user navigates away from an email
  let lastUrl = location.href;
  
  // Create an observer that will watch for URL changes
  const urlObserver = new MutationObserver(() => {
    const currentUrl = location.href;
    
    // If URL has changed
    if (currentUrl !== lastUrl) {
      console.log("DEBUG: URL changed from", lastUrl, "to", currentUrl);
      
      // Check if we've navigated away from an individual email view
      // Individual emails have URLs like #inbox/thread-id, #sent/thread-id, etc.
      const wasInEmail = lastUrl.includes('#') && lastUrl.split('#')[1].includes('/');
      const isInEmail = currentUrl.includes('#') && currentUrl.split('#')[1].includes('/');
      
      console.log("DEBUG: wasInEmail:", wasInEmail, "isInEmail:", isInEmail);
      
      // If we were viewing an individual email but now we're not (going back to inbox/list view)
      if (wasInEmail && !isInEmail) {
        console.log("DEBUG: Navigation detected - removing banner immediately");
        // Remove banner immediately when leaving email
        const banner = document.getElementById('fraud-unified-banner');
        if (banner) {
          // Remove immediately without animation for instant response
          banner.remove();
          console.log("DEBUG: Banner removed on navigation");
        }
        
        // Also remove any tooltips immediately
        document.querySelectorAll('.explanation-tooltip.visible').forEach(tooltip => {
          tooltip.remove();
        });
      }
      
      // Update our stored URL
      lastUrl = currentUrl;
    }
  });
  
  // Start observing the document with the configured parameters
  urlObserver.observe(document, { subtree: true, childList: true });
  
  // Also listen for browser navigation events
  window.addEventListener('popstate', () => {
    console.log("DEBUG: Popstate event detected");
    setTimeout(() => {
      const currentUrl = location.href;
      const hash = currentUrl.split('#')[1] || '';
      
      // If we're no longer in an individual email, remove banner
      if (!hash.includes('/')) {
        console.log("DEBUG: Popstate - removing banner immediately");
        const banner = document.getElementById('fraud-unified-banner');
        if (banner) {
          banner.remove();
          console.log("DEBUG: Banner removed on popstate");
        }
        
        document.querySelectorAll('.explanation-tooltip.visible').forEach(tooltip => {
          tooltip.remove();
        });
      }
    }, 100);
  });
  
  // Also listen for Gmail's native navigation events
  document.addEventListener('keydown', (e) => {
    // Check for navigation shortcuts like Escape key (which exits an email)
    if (e.key === 'Escape') {
      console.log("DEBUG: Escape key pressed - removing banner immediately");
      // Remove banner immediately when pressing Escape
      const banner = document.getElementById('fraud-unified-banner');
      if (banner) {
        // Remove immediately without animation for instant response
        banner.remove();
        console.log("DEBUG: Banner removed on Escape key");
      }
      
      // Remove tooltips immediately
      document.querySelectorAll('.explanation-tooltip.visible').forEach(tooltip => {
        tooltip.remove();
      });
    }
  });
  
  // Additional: Listen for clicks on Gmail navigation elements
  document.addEventListener('click', (e) => {
    // Check if clicked element might trigger navigation away from email
    const target = e.target;
    if (target && (
      target.matches('[role="button"]') || 
      target.matches('button') ||
      target.matches('.T-I') ||
      target.matches('[jsaction*="go/"]') ||
      target.matches('a[href*="#inbox"]') ||
      target.matches('a[href*="#sent"]') ||
      target.matches('a[href*="#drafts"]') ||
      target.closest('[role="button"]') ||
      target.closest('button')
    )) {
      console.log("DEBUG: Detected potential navigation click");
      // Wait a moment then check if we've left the email
      setTimeout(() => {
        const hash = location.hash.split('#')[1] || '';
        if (!hash.includes('/')) {
          console.log("DEBUG: Click navigation - removing banner immediately");
          const banner = document.getElementById('fraud-unified-banner');
          if (banner) {
            banner.remove();
            console.log("DEBUG: Banner removed on click navigation");
          }
          
          document.querySelectorAll('.explanation-tooltip.visible').forEach(tooltip => {
            tooltip.remove();
          });
        }
      }, 100);
    }
  });
}

// Add inbox scanning functionality to show risk badges on email rows

// Add scroll detection to the setupInboxScanning function to handle pagination

function setupInboxScanning() {
  console.log("Setting up inbox scanning");
  
  // Keep track of scanned emails to avoid duplicates
  const scannedEmailIds = new Set();
  
  // Function to scan the inbox for unscanned emails
  function scanInbox() {
    // CHANGE ONLY THIS LINE: Update isInboxView check to handle URLs like #section_query/.../p2
    const isInboxView = /^#(inbox|starred|snoozed|sent|drafts|all|spam|trash|imp|mbox|label|section_query)/.test(window.location.hash) && 
                       (!window.location.hash.includes('/') || window.location.hash.includes('/p'));
    
    if (!isInboxView) return;
    
    // Find all email rows that haven't been scanned yet
    const emailRows = document.querySelectorAll('tr[role="row"]:not([data-risk-scanned="true"])');
    
    if (emailRows.length === 0) return;
    
    console.log(`Scanning ${emailRows.length} new emails in inbox view`);
    
    emailRows.forEach(row => {
      // Mark as scanned to avoid processing again
      row.dataset.riskScanned = "true";
      
      // Try to find a unique identifier for this email
      const idElement = row.querySelector('[data-thread-id]');
      const emailId = idElement ? idElement.getAttribute('data-thread-id') : null;
      
      if (emailId && scannedEmailIds.has(emailId)) {
        return; // Skip if already scanned
      }
      
      if (emailId) {
        scannedEmailIds.add(emailId);
      }
      
      // Find the sender name/email
      const senderElement = row.querySelector('[email]') || 
                           row.querySelector('[data-hovercard-id]');
      
      if (!senderElement) return;
      
      // Extract sender information
      let senderEmail = '';
      let senderDomain = '';
      
      if (senderElement.hasAttribute('email')) {
        senderEmail = senderElement.getAttribute('email');
      } else if (senderElement.hasAttribute('data-hovercard-id')) {
        senderEmail = senderElement.getAttribute('data-hovercard-id');
      }
      
      if (senderEmail && senderEmail.includes('@')) {
        senderDomain = senderEmail.split('@')[1].toLowerCase();
        assessSenderRisk(row, senderDomain, senderEmail);
      }
      
      // Also scan subject line for quick risk assessment
      const subjectElement = row.querySelector('.xT .y6') || 
                            row.querySelector('.zA .bog');
      
      if (subjectElement) {
        const subjectText = subjectElement.textContent.trim();
        if (subjectText) {
          assessSubjectRisk(row, subjectText);
        }
      }
    });
  }
  
  function assessSenderRisk(row, senderDomain, senderEmail) {
    // Check domain against known safe domains
    const trustedSenderDomains = [
      'microsoft.com', 'office365.com', 'outlook.com', 'live.com',
      'google.com', 'gmail.com', 'apple.com', 'icloud.com',
      'amazon.com', 'chase.com', 'bankofamerica.com', 'wellsfargo.com',
      'paypal.com', 'twitter.com', 'facebook.com', 'linkedin.com',
      'adobe.com', 'dropbox.com', 'github.com', 'slack.com',
      'zoom.us', 'shopify.com', 'spotify.com', 'netflix.com',
      'steam.com', 'steampowered.com', 'minecraft.net', 'roblox.com',
      'ea.com', 'ubisoft.com'
    ];
    
    // First check whitelist/blacklist configuration
    const isWhitelisted = whitelist.some(domain => 
      senderDomain === domain || senderDomain.endsWith('.' + domain));
    
    const isBlacklisted = blacklist.some(domain => 
      senderDomain === domain || senderDomain.endsWith('.' + domain));
    
    if (isBlacklisted) {
      addRiskBadgeToEmail(row, 'high', 'Sender domain is blocklisted');
      return;
    }
    
    if (isWhitelisted) {
      addRiskBadgeToEmail(row, 'safe', 'Sender domain is trusted');
      return;
    }
    
    const isTrusted = trustedSenderDomains.some(domain => 
      senderDomain === domain || senderDomain.endsWith('.' + domain));
    
    if (isTrusted) {
      addRiskBadgeToEmail(row, 'safe', 'Verified sender');
      return;
    }
    
    // For unknown domains, check with domain reputation algorithm
    chrome.runtime.sendMessage({
      type: 'vt-reputation',
      domains: [senderDomain]
    }, response => {
      if (response && response.reputations && response.reputations[senderDomain]) {
        const reputation = response.reputations[senderDomain];
        
        // Store the risk level on the row for persistence
        let riskLevel = 'unknown';
        let tooltipText = 'Unknown sender';
        
        if (reputation.malicious > 0) {
          riskLevel = 'high';
          tooltipText = 'Malicious domain detected';
        } else if (reputation.suspicious > 0) {
          riskLevel = 'medium';
          tooltipText = 'Suspicious domain';
        } else if (reputation.harmless > 0) {
          riskLevel = 'safe';
          tooltipText = 'No threats detected';
        }
        
        // Store data attributes for badge persistence
        row.dataset.riskLevel = riskLevel;
        row.dataset.riskTooltip = tooltipText;
        
        addRiskBadgeToEmail(row, riskLevel, tooltipText);
      } else {
        // Store data attributes for badge persistence
        row.dataset.riskLevel = 'unknown';
        row.dataset.riskTooltip = 'Unverified sender';
        
        addRiskBadgeToEmail(row, 'unknown', 'Unverified sender');
      }
    });
  }
  
  function assessSubjectRisk(row, subject) {
    const lowerSubject = subject.toLowerCase();
    
    // High-risk keywords in subject line
    const highRiskPatterns = [
      'urgent', 'action required', 'account suspended', 'verify', 'password',
      'login', 'security alert', 'unusual activity', 'update your', 'limited time',
      'payment', 'won', 'winner', 'prize', 'claim', 'free gift', 'giveaway',
      '$500', '$1000', 'congratulations you'
    ];
    
    // Look for high-risk patterns in subject
    for (const pattern of highRiskPatterns) {
      if (lowerSubject.includes(pattern)) {
        // Don't overwrite a higher risk badge if it's already there
        const existingBadge = row.querySelector('.fraud-inbox-badge');
        if (!existingBadge || !existingBadge.classList.contains('high')) {
          addRiskBadgeToEmail(row, 'medium', 'Suspicious subject line');
        }
        return;
      }
    }
    
    // Add this at the end of the function
    // Store the fact that this row was processed by subject risk
    if (!row.dataset.riskLevel) {
      row.dataset.subjectScanned = "true";
    }
  }
  
  function addRiskBadgeToEmail(row, riskLevel, tooltipText) {
    // Keep track of this badge's details for persistence
    row.dataset.riskLevel = riskLevel;
    row.dataset.riskTooltip = tooltipText;
    
    // Remove any existing badges
    const existingBadge = row.querySelector('.fraud-inbox-badge');
    if (existingBadge) {
      // If existing badge has higher risk level, don't downgrade it
      if (riskLevel === 'unknown' || 
          (riskLevel === 'medium' && existingBadge.classList.contains('high')) ||
          (riskLevel === 'safe' && (existingBadge.classList.contains('high') || existingBadge.classList.contains('medium')))) {
        return;
      }
      existingBadge.remove();
    }
    
    // Find the correct place to inject the badge - near the date
    let targetElement = row.querySelector('.xW');
    
    if (!targetElement) {
      // Alternative selectors for different Gmail layouts
      targetElement = row.querySelector('.time');
      
      if (!targetElement) {
        // If still not found, try another common element
        targetElement = row.querySelector('.y2') || row.querySelector('.bq9');
        
        if (!targetElement) {
          return; // Can't find a place to add the badge
        }
      }
    }
    
    // Create the badge
    const badge = document.createElement('div');
    badge.className = `fraud-inbox-badge ${riskLevel}`;
    
    // Set the badge icon based on risk level
    if (riskLevel === 'safe') {
      badge.innerHTML = `<span class="badge-icon">✓</span>`;
    } else if (riskLevel === 'medium') {
      badge.innerHTML = `<span class="badge-icon">!</span>`;
    } else if (riskLevel === 'high') {
      badge.innerHTML = `<span class="badge-icon">⚠</span>`;
    } else {
      badge.innerHTML = `<span class="badge-icon">?</span>`;
    }
    
    // Add tooltip
    const tooltip = document.createElement('span');
    tooltip.className = 'fraud-badge-tooltip';
    tooltip.textContent = tooltipText;
    badge.appendChild(tooltip);
    
    // Create a wrapper if needed to maintain layout
    if (targetElement.style.display !== 'flex') {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'display: flex; align-items: center; flex-shrink: 0;';
      wrapper.appendChild(badge);
      
      // Insert the wrapper before the target element
      if (targetElement.parentNode) {
        targetElement.parentNode.insertBefore(wrapper, targetElement);
      }
    } else {
      // Insert the badge directly
      if (targetElement.parentNode) {
        targetElement.parentNode.insertBefore(badge, targetElement);
      }
    }
  }
  
  function checkForMissingBadges() {
    // Only run if we're in an inbox view
    if (!/^#(inbox|starred|snoozed|sent|drafts|all|spam|trash|imp|mbox|label)/.test(window.location.hash) || 
        window.location.hash.includes('/')) {
      return;
    }

    // Look for rows with risk data but missing badges
    const rowsWithRiskData = document.querySelectorAll('tr[role="row"][data-risk-level]:not(:has(.fraud-inbox-badge))');
    
    if (rowsWithRiskData.length > 0) {
      console.log(`Repairing ${rowsWithRiskData.length} badges that disappeared`);
      
      rowsWithRiskData.forEach(row => {
        // Extract stored badge data
        const riskLevel = row.dataset.riskLevel;
        const tooltipText = row.dataset.riskTooltip || 'Risk detected';
        
        // Find where to insert the badge
        let targetElement = row.querySelector('.xW');
        
        if (!targetElement) {
          // Alternative selectors for different Gmail layouts
          targetElement = row.querySelector('.time');
          
          if (!targetElement) {
            // If still not found, try another common element
            targetElement = row.querySelector('.y2') || row.querySelector('.bq9');
            
            if (!targetElement) {
              return; // Can't find a place to add the badge
            }
          }
        }
        
        // Recreate the badge
        const badge = document.createElement('div');
        badge.className = `fraud-inbox-badge ${riskLevel}`;
        badge.style.cssText = 'visibility: visible !important; opacity: 1 !important;';
        
        // Set the badge icon based on risk level
        if (riskLevel === 'safe') {
          badge.innerHTML = `<span class="badge-icon">✓</span>`;
        } else if (riskLevel === 'medium') {
          badge.innerHTML = `<span class="badge-icon">!</span>`;
        } else if (riskLevel === 'high') {
          badge.innerHTML = `<span class="badge-icon">⚠</span>`;
        } else {
          badge.innerHTML = `<span class="badge-icon">?</span>`;
        }
        
        // Add tooltip
        const tooltip = document.createElement('span');
        tooltip.className = 'fraud-badge-tooltip';
        tooltip.textContent = tooltipText;
        badge.appendChild(tooltip);
        
        // Create a wrapper with stronger styles to ensure it stays visible
        const wrapper = document.createElement('div');
        wrapper.className = 'fraud-badge-wrapper';
        wrapper.style.cssText = 'display: flex !important; align-items: center !important; margin-right: 6px !important; visibility: visible !important; opacity: 1 !important;';
        wrapper.appendChild(badge);
        
        try {
          // Insert before the target element
          if (targetElement.parentNode) {
            targetElement.parentNode.insertBefore(wrapper, targetElement);
          }
        } catch (e) {
          console.error('Error reinserting badge:', e);
        }
      });
    }
  }

  // Add this new function to handle scroll events for pagination
  let scrollTimer;
  function handleScroll() {
    // Clear existing timer
    clearTimeout(scrollTimer);
    
    // Set new timer to debounce scroll events
    scrollTimer = setTimeout(() => {
      // After scrolling stops, check for newly loaded emails
      console.log("Checking for new emails after scrolling");
      
      // Look for all unscanned email rows - these would be new from pagination
      const newEmailRows = document.querySelectorAll('tr[role="row"]:not([data-risk-scanned="true"])');
      
      if (newEmailRows.length > 0) {
        console.log(`Found ${newEmailRows.length} new emails after scrolling/pagination`);
        scanInbox(); // Scan inbox which will process the new rows
      }
      
      // Also check for any badges that need repair
      checkForMissingBadges();
    }, 300); // 300ms debounce
  }
  
  // Set up scroll event listeners
  window.addEventListener('scroll', handleScroll, { passive: true });
  
  // Also look for Gmail's internal scroll containers
  const scrollContainers = document.querySelectorAll('div[role="main"], .AO, .Tm');
  scrollContainers.forEach(container => {
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
    }
  });
  
  // Add pagination button click detection (Gmail's "Older" button)
  function checkForPaginationButtons() {
    const paginationButtons = document.querySelectorAll('[role="button"], button, .T-I');
    paginationButtons.forEach(button => {
      if (!button.dataset.paginationMonitored) {
        button.dataset.paginationMonitored = "true";
        button.addEventListener('click', () => {
          // After clicking a button that might load more emails, wait a bit then scan
          setTimeout(scanInbox, 1000);
        });
      }
    });
  }
  
  // Set up MutationObserver to detect when pagination buttons might be added
  const paginationObserver = new MutationObserver(mutations => {
    checkForPaginationButtons();
  });
  
  paginationObserver.observe(document.body, { childList: true, subtree: true });
  
  // Initial check for pagination buttons
  checkForPaginationButtons();

  // Rest of the original function
  const inboxObserver = new MutationObserver(() => {
    scanInbox();
  });
  
  // Start observing the inbox for changes
  inboxObserver.observe(document.body, { childList: true, subtree: true });
  
  // Initial scan
  scanInbox();
  
  // Re-scan when URL changes (e.g., switching folders)
  let lastUrl = location.href;
  
  setInterval(() => {
    // Check for URL changes
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      
      // Clear scanned emails cache when changing views
      scannedEmailIds.clear();
      
      // Wait a moment for the DOM to update
      setTimeout(scanInbox, 500);
    }
    
    // Also check for and repair missing badges
    checkForMissingBadges();
    
    // Added: periodically scan for new emails (handles cases where MutationObserver misses something)
    const newEmailRows = document.querySelectorAll('tr[role="row"]:not([data-risk-scanned="true"])');
    if (newEmailRows.length > 0) {
      console.log(`Periodic check found ${newEmailRows.length} unprocessed emails`);
      scanInbox();
    }
  }, 1000);
  
  // Clean up function to remove all event listeners when needed
  function cleanup() {
    window.removeEventListener('scroll', handleScroll);
    scrollContainers.forEach(container => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
    });
    inboxObserver.disconnect();
    paginationObserver.disconnect();
  }
  
  // Return cleanup function for potential future use
  return { cleanup, scanInbox };
}

// Add specific CSS styles for the inbox badges
const inboxBadgeStyles = document.createElement('style');
inboxBadgeStyles.id = 'fraud-inbox-badge-styles';
inboxBadgeStyles.textContent = `
.fraud-inbox-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  margin-right: 6px;
  position: relative;
  font-size: 11px;
  font-weight: bold;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  cursor: help;
}

.fraud-inbox-badge.safe {
  background-color: #128c15;
  color: white;
}

.fraud-inbox-badge.medium {
  background-color: #e67e22;
  color: white;
}

.fraud-inbox-badge.high {
  background-color: #e74c3c;
  color: white;
}

.fraud-inbox-badge.unknown {
  background-color: #7f8c8d;
  color: white;
}

.fraud-badge-tooltip {
  position: absolute;
  background: rgba(26, 26, 26, 0.95);
  color: #e0e0e0;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 11px;
  white-space: nowrap;
  bottom: 25px;
  left: 50%;
  transform: translateX(-50%);
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s, visibility 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  z-index: 9999;
  font-weight: normal;
  pointer-events: none;
}

.fraud-badge-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-width: 4px;
  border-style: solid;
  border-color: rgba(26, 26, 26, 0.95) transparent transparent transparent;
}

.fraud-inbox-badge:hover .fraud-badge-tooltip {
  opacity: 1;
  visibility: visible;
}

/* Adjust badge position for different Gmail themes */
.gmail-classic .fraud-inbox-badge {
  margin-top: -2px;
}

.gmail-new .fraud-inbox-badge {
  margin-top: 0;
}
`;

document.head.appendChild(inboxBadgeStyles);

// Add stronger CSS to force badge visibility
const persistentBadgeStyle = document.createElement('style');
persistentBadgeStyle.id = 'fraud-persistent-badge-style';
persistentBadgeStyle.textContent = `
.fraud-inbox-badge, .fraud-badge-wrapper {
  visibility: visible !important;
  opacity: 1 !important;
  display: flex !important;
  z-index: 999 !important;
}

/* Force Gmail to show our badge containers */
.xW, .time, .y2, .bq9, .fraud-badge-wrapper {
  display: flex !important;
  align-items: center !important;
  visibility: visible !important;
  opacity: 1 !important;
}

/* Make badge more visible and prevent it from being hidden */
.fraud-inbox-badge {
  position: relative !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  min-width: 18px !important;
  min-height: 18px !important;
  width: 18px !important;
  height: 18px !important;
  border-radius: 50% !important;
  font-size: 11px !important;
  font-weight: bold !important;
  margin-right: 6px !important;
  z-index: 999 !important;
}
`;
document.head.appendChild(persistentBadgeStyle);

// Call the setupInboxScanning function when the script loads
// Add this line after setupEmailNavigationDetection() call:
setupInboxScanning();

// Function to check if the email is from a trusted sender
function isFromTrustedSender(container) {
  // Try to find sender information in the email header
  const possibleSenderElements = [
    ...container.querySelectorAll('span[email]'), // Gmail format
    ...container.querySelectorAll('[data-hovercard-id]'), // Another Gmail format
    ...container.querySelectorAll('a[href^="mailto:"]') // Generic mailto links
  ];
  
  // Extract all potential sender domains
  const senderDomains = [];
  
  possibleSenderElements.forEach(element => {
    let email = '';
    
    if (element.hasAttribute('email')) {
      // Direct email attribute
      email = element.getAttribute('email');
    } else if (element.hasAttribute('data-hovercard-id')) {
      // Email from hovercard
      email = element.getAttribute('data-hovercard-id');
    } else if (element.href && element.href.startsWith('mailto:')) {
      // Mailto link
      email = element.href.substring(7); // Remove 'mailto:'
    }
    
    // Extract domain from email if found
    if (email && email.includes('@')) {
      const domain = email.split('@')[1].toLowerCase();
      senderDomains.push(domain);
    }
  });
  
  console.log("Detected sender domains:", senderDomains);
  
  // Check if any sender domain is in our trusted list
  const trustedSenderDomains = [
    'microsoft.com', 'office365.com', 'outlook.com', 'live.com',
    'google.com', 'gmail.com', 'apple.com', 'icloud.com',
    'amazon.com', 'chase.com', 'bankofamerica.com', 'wellsfargo.com',
    'paypal.com', 'twitter.com', 'facebook.com', 'linkedin.com',
    'adobe.com', 'dropbox.com', 'github.com', 'slack.com',
    'zoom.us', 'shopify.com', 'spotify.com', 'netflix.com',
    'steam.com', 'steampowered.com', 'minecraft.net', 'roblox.com',
    'ea.com', 'ubisoft.com'
  ];
  
  // Return true if any sender domain matches our trusted list
  return senderDomains.some(domain => 
    trustedSenderDomains.some(trusted => domain === trusted || domain.endsWith('.' + trusted))
  );
}

// Main email scanning function with debounce protection
function scanEmail() {
  console.log("DEBUG: scanEmail called, extensionEnabled:", extensionEnabled, "location.hash:", window.location.hash);
  
  if (!extensionEnabled) return;
  
  // Prevent multiple scans happening in quick succession
  if (scanEmail.isScanning) return;
  scanEmail.isScanning = true;
  
  setTimeout(() => {
    scanEmail.isScanning = false;
  }, 2000); // Increased debounce period to 2000ms
  
  console.log("Running scanEmail", {extensionEnabled, isEmailView: window.location.hash});
  
  // Check if we're viewing an individual email (URLs with forward slash indicate specific email)
  const hash = window.location.hash;
  const isIndividualEmail = hash && hash.includes('/');
  if (!isIndividualEmail) {
    console.log("DEBUG: Not viewing individual email, exiting scanEmail. Hash:", hash);
    return;
  }
  
  // Remove any existing banner before starting new scan
  const existingBanner = document.getElementById('fraud-unified-banner');
  if (existingBanner) {
    existingBanner.remove();
  }
  
  // Find email content areas that haven't been scanned yet
  // Only look for actual email content containers, not all divs
  // Try multiple selectors to find Gmail email content
  let emailContainers = document.querySelectorAll('div[role="main"] .ii.gt div:not([data-scanned="true"]), div[role="main"] .adn div:not([data-scanned="true"])');
  
  // If no containers found with the primary selector, try alternative selectors
  if (emailContainers.length === 0) {
    console.log("DEBUG: Primary selectors found no containers, trying alternatives");
    emailContainers = document.querySelectorAll('div[role="main"] div:not([data-scanned="true"])');
    console.log("DEBUG: Alternative selector found", emailContainers.length, "containers");
  }
  
  console.log("DEBUG: Found", emailContainers.length, "potential email containers");
  
  // For performance optimization, we'll process containers in batches
  const containers = Array.from(emailContainers).filter(container => {
    // Only process containers that actually contain email content
    const text = container.innerText || '';
    return text.length > 20 && container.querySelectorAll('a[href]').length > 0;
  });
  
  console.log("DEBUG: After filtering, processing", containers.length, "containers");
  
  // Process containers in batches with smart prioritization
  processBatch(containers);
  
  function processBatch(containers) {
    if (containers.length === 0) return;
    
    // Process containers in batches of 3 for better performance
    const batchSize = 3;
    const currentBatch = containers.slice(0, batchSize);
    const remainingContainers = containers.slice(batchSize);
    
    // Process current batch immediately
    for (const container of currentBatch) {
      // Mark as scanned to avoid duplicate processing
      container.dataset.scanned = "true";
      
      // Add visual indicator for large emails
      const emailText = container.innerText || '';
      
      // Add loading indicator for large emails
      if (emailText.length > 10000) {
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'fraud-scanning-indicator';
        loadingIndicator.textContent = 'Scanning for security threats...';
        loadingIndicator.style.cssText = `
          position: absolute;
          top: 10px;
          right: 10px;
          background: rgba(0,0,0,0.7);
          color: white;
          padding: 6px 12px;
          font-size: 12px;
          border-radius: 4px;
          z-index: 1000;
        `;
        container.style.position = 'relative';
        container.appendChild(loadingIndicator);
        
        // Remove indicator after scan completes or times out
        setTimeout(() => loadingIndicator.remove(), 5000);
      }
      
      // Process container
      processEmailContainer(container);
    }
    
    // Schedule the next batch with a delay if there are remaining containers
    if (remainingContainers.length > 0) {
      setTimeout(() => {
        processBatch(remainingContainers);
      }, 300); // Delay between batches
    }
  }
  
  // Helper function to process a single email container
  function processEmailContainer(container) {
    console.log("DEBUG: processEmailContainer called for container with text length:", container.innerText?.length);
    
    // Check if this specific content has already been processed
    const contentHash = container.innerText.substring(0, 100); // Use first 100 chars as identifier
    if (processEmailContainer.processedContent && processEmailContainer.processedContent.has(contentHash)) {
      console.log("Skipping already processed email content");
      return;
    }
    
    // Initialize the Set if it doesn't exist
    if (!processEmailContainer.processedContent) {
      processEmailContainer.processedContent = new Set();
    }
    
    // Mark this content as processed
    processEmailContainer.processedContent.add(contentHash);
    
    // Clean up old entries to prevent memory leaks (keep only last 50)
    if (processEmailContainer.processedContent.size > 50) {
      const entries = Array.from(processEmailContainer.processedContent);
      processEmailContainer.processedContent = new Set(entries.slice(-25));
    }
    
    // Extract links from email
    const links = container.querySelectorAll('a[href]');
    console.log("DEBUG: Found", links.length, "links in email container");
    
    if (!links.length) {
      console.log("DEBUG: No links found, exiting processEmailContainer");
      return;
    }
    
    // Collect domains for analysis
    const domains = new Set();
    links.forEach(link => {
      try {
        const url = new URL(link.href);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          domains.add(url.hostname);
        }
      } catch (e) {
        // Invalid URL, skip
      }
    });
    
    console.log("Found domains:", Array.from(domains));
    
    if (!domains.size) return;
    
    // Filter out whitelisted domains
    const domainsToCheck = Array.from(domains).filter(domain => {
      return !whitelist.some(wlDomain => matchesDomain(domain, wlDomain));
    });
    
    // Check for blacklisted domains
    const blacklistedDomains = Array.from(domains).filter(domain => {
      return blacklist.some(blDomain => matchesDomain(domain, blDomain));
    });
    
    console.log("Domains to check:", domainsToCheck, "Blacklisted:", blacklistedDomains);
    
    // Extract text for phishing analysis
    const emailText = container.innerText || '';
    let phishingScore = 0;
    let highlightedTerms = [];

    // Check if the email is from a trusted sender
    const isTrustedSender = isFromTrustedSender(container);
    console.log("Is from trusted sender:", isTrustedSender);

    // If the email is from a trusted sender, we still scan but apply a trust factor
    let trustFactor = isTrustedSender ? 0.3 : 1.0; // Reduce score by 70% for trusted senders

    // If there are blacklisted domains, show warning immediately
    if (blacklistedDomains.length > 0) {
      // Update statistics for blocked threat
      updateStatistics('threatBlocked');
      
      // Still analyze the content to get the risk score
      if (emailText.length > 50) {
        analyzeEmailContent(container, emailText, (score, terms, metrics) => {
          phishingScore = score * trustFactor;
          highlightedTerms = terms;
          showWarningBanner(container, "Blacklisted domains detected", blacklistedDomains, phishingScore, highlightedTerms, metrics, isTrustedSender);
        });
      } else {
        showWarningBanner(container, "Blacklisted domains detected", blacklistedDomains, 0.9 * trustFactor, [], null, isTrustedSender);
      }
      return;
    }
    
    // If there are suspicious domains to check, query reputation
    if (domainsToCheck.length > 0) {
      console.log("Sending reputation request for domains:", domainsToCheck);
      
      // First analyze the content to get the risk score
      if (emailText.length > 50) {
        analyzeEmailContent(container, emailText, (score, terms, metrics) => {
          // Apply trust factor to the phishing score
          phishingScore = score * trustFactor;
          highlightedTerms = terms;

          // Log the original score and adjusted score
          console.log(`Original phishing score: ${score}, After trust factor: ${phishingScore}`);
          
          // Then check domain reputation
          chrome.runtime.sendMessage({
            type: 'vt-reputation',
            domains: domainsToCheck
          }, response => {
            console.log("Got reputation response:", response);
            if (response && response.reputations) {
              const suspiciousDomains = [];
              
              // Check for suspicious domains based on reputation
              for (const domain in response.reputations) {
                const rep = response.reputations[domain];
                if (rep.malicious > 0 || rep.suspicious > 0) {
                  suspiciousDomains.push(domain);
                }
              }
              
              // Determine overall risk and show appropriate banner
              if (suspiciousDomains.length > 0) {
                // Update statistics for threat detected
                updateStatistics('threatBlocked');
                
                // High risk: Multiple suspicious domains or high phishing score
                if (suspiciousDomains.length >= 2 || phishingScore >= 0.7 || 
                    (metrics && metrics.highRiskCount >= 2)) {
                  showWarningBanner(container, "High-risk suspicious content detected", 
                                    suspiciousDomains, phishingScore, highlightedTerms, metrics, isTrustedSender);
                }
                // Medium risk: Few suspicious domains or medium phishing score
                else {
                  showWarningBanner(container, "Potentially risky content detected", 
                                    suspiciousDomains, Math.max(phishingScore, 0.4), 
                                    highlightedTerms, metrics, isTrustedSender);
                }
              }
              // No suspicious domains, but content analysis indicates risk
              else if (phishingScore > threshold) {
                // Update statistics for threat detected
                updateStatistics('threatBlocked');
                
                if (phishingScore >= 0.7 || (metrics && metrics.highRiskCount >= 2)) {
                  showWarningBanner(container, "High-risk content detected", [], 
                                    phishingScore, highlightedTerms, metrics, isTrustedSender);
                } else {
                  showWarningBanner(container, "Medium-risk content detected", [], 
                                    phishingScore, highlightedTerms, metrics, isTrustedSender);
                }
              }
              // Safe email
              else {
                // Update statistics for site scanned
                updateStatistics('siteScanned');
                showSafeBanner(container, phishingScore, isTrustedSender);
              }
              
              // Reputation badges for links have been disabled
            }
          });
        });
      } else {
        // For very short emails, just check domain reputation
        chrome.runtime.sendMessage({
          type: 'vt-reputation',
          domains: domainsToCheck
        }, response => {
          if (response && response.reputations) {
            const suspiciousDomains = [];
            
            // Check for suspicious domains based on reputation
            for (const domain in response.reputations) {
              const rep = response.reputations[domain];
              if (rep.malicious > 0 || rep.suspicious > 0) {
                suspiciousDomains.push(domain);
              }
            }
            
            if (suspiciousDomains.length > 0) {
              // Update statistics for threat detected
              updateStatistics('threatBlocked');
              showWarningBanner(container, "Suspicious domains detected", suspiciousDomains, 0, [], null, isTrustedSender);
            } else {
              // Show safe email banner for short emails with no suspicious domains
              updateStatistics('siteScanned');
              showSafeBanner(container, 0, isTrustedSender);
            }
            
            // Reputation badges for links have been disabled
          }
        });
      }
    } else if (emailText.length > 50) {
      // If no suspicious domains but email is long enough, still analyze content
      analyzeEmailContent(container, emailText, (score, terms, metrics) => {
        if (score * trustFactor > threshold) {
          // Update statistics for threat detected
          updateStatistics('threatBlocked');
          // Show warning banner with the risk percentage and highlighted terms
          showWarningBanner(container, "Suspicious email content detected", [], score * trustFactor, terms, metrics, isTrustedSender);
        } else {
          // Update statistics for site scanned
          updateStatistics('siteScanned');
          // Show safe email banner with safety percentage based on the score
          showSafeBanner(container, score * trustFactor, isTrustedSender);
        }
      });
    } else {
      // Very short email with no suspicious domains is likely safe
      updateStatistics('siteScanned');
      showSafeBanner(container, 0.05, isTrustedSender); // Use a small non-zero value to ensure percentage is shown
    }
  }
}

// Show banner for safe emails
function showSafeBanner(container, riskScore, trustedSender) {
  console.log("DEBUG: showSafeBanner called with riskScore:", riskScore, "trustedSender:", trustedSender);
  
  // Check if we're still viewing an individual email before showing the banner
  const hash = window.location.hash;
  const isIndividualEmail = hash && hash.includes('/');
  if (!isIndividualEmail) {
    console.log("DEBUG: Not showing safe banner - not viewing individual email. Hash:", hash);
    return; // Don't show banner if we've already navigated away
  }

  // If a banner is already showing and has been shown for less than 5 seconds, don't show a new one
  const existingBanner = document.getElementById('fraud-unified-banner');
  if (existingBanner) {
    const bannerTimestamp = parseInt(existingBanner.dataset.timestamp || '0');
    if (Date.now() - bannerTimestamp < 5000) {
      console.log("Skipping safe banner - existing banner is too recent");
      return;
    }
    existingBanner.remove();
  }
  
  console.log("Showing safe email banner, Risk Score:", riskScore);
  
  const banner = document.createElement('div');
  banner.id = 'fraud-unified-banner';
  banner.className = 'safe';
  banner.dataset.timestamp = Date.now().toString();
  
  // Set initial style to ensure it's visible (override animation)
  banner.style.transform = 'translateX(-50%) translateY(0)';
  banner.style.opacity = '1';
  
  // Always calculate a safety percentage - ensure it's never 0% or 100%
  const effectiveRisk = Math.max(0.05, Math.min(riskScore, 0.95));
  const safePercentage = Math.round((1 - effectiveRisk) * 100);
  
  // Add explanation for safe emails
  const safeExplanation = `<div class="risk-explanation">
    <button class="info-button" title="Analysis details">i</button>
    <div class="explanation-tooltip">
      <div class="tooltip-header">Why this email appears safe:</div>
      <ul>
        <li>No suspicious domains detected</li>
        <li>No high-risk phishing phrases found</li>
        <li>Content analysis indicates safe communication</li>
        <li>Email patterns match legitimate correspondence</li>
      </ul>
    </div>
  </div>`;
  
  banner.innerHTML = `
    <div class="row">
      <div class="safe-circle">
        <img src="${chrome.runtime.getURL('images/insurance.png')}" alt="Safe" />
      </div>
      <button class="close-btn">×</button>
    </div>
    <div class="banner-title">This email appears safe</div>
    <div class="risk-meter">
      <span class="risk-label">Safety Assessment:</span>
      <span class="risk-percentage safe">${safePercentage}% safe</span>
      ${safeExplanation}
    </div>
  `;
  
  document.body.appendChild(banner);
  setupBannerAnimationHandlers(banner);
  setupBannerCloseButton(banner);
  
  // Improved tooltip event handling
  const infoButton = banner.querySelector('.info-button');
  if (infoButton) {
    let clickListener = null;
    let escapeListener = null;
    
    infoButton.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // Find if we already have a tooltip visible for this button
      const existingTooltip = document.querySelector(`.explanation-tooltip[data-for-banner="${banner.id}"]`);
      const tooltipVisible = !!existingTooltip;
      
      // Toggle state - if visible, hide it; if hidden, show it
      if (tooltipVisible) {
        // Hide the tooltip
        existingTooltip.remove();
        infoButton.style.backgroundColor = '';
        
        // Clean up any event listeners
        if (clickListener) {
          document.removeEventListener('click', clickListener);
          clickListener = null;
        }
        if (escapeListener) {
          document.removeEventListener('keydown', escapeListener);
          escapeListener = null;
        }
      } else {
        // First, close any other open tooltips
        document.querySelectorAll('.explanation-tooltip.visible').forEach(t => t.remove());
        
        // Create and show new tooltip
        const tooltipWrapper = banner.querySelector('.explanation-tooltip');
        const tooltip = document.createElement('div');
        tooltip.className = 'explanation-tooltip visible';
        tooltip.dataset.forBanner = banner.id;
        
        // Copy content from template if it exists, otherwise use default content
        if (tooltipWrapper) {
          tooltip.innerHTML = tooltipWrapper.innerHTML;
        } else {
          // Use default content based on banner type
          tooltip.innerHTML = `
            <div class="tooltip-header">Why this email appears safe:</div>
            <ul>
              <li>No suspicious domains detected</li>
              <li>No high-risk phishing phrases found</li>
              <li>Content analysis indicates safe communication</li>
              <li>Email patterns match legitimate correspondence</li>
            </ul>
          `;
        }
        
        document.body.appendChild(tooltip);
        infoButton.style.backgroundColor = 'rgba(255, 255, 255, 0.4)';
        
        // Position the tooltip below the banner
        const bannerRect = banner.getBoundingClientRect();
        tooltip.style.top = (bannerRect.bottom + 20) + 'px';
        
        // Set up click handler to close tooltip when clicking outside
        clickListener = (event) => {
          if (event.target !== infoButton && !tooltip.contains(event.target)) {
            tooltip.remove();
            infoButton.style.backgroundColor = '';
            document.removeEventListener('click', clickListener);
            clickListener = null;
          }
        };
        
        // Add with a small delay to prevent immediate closure
        setTimeout(() => {
          document.addEventListener('click', clickListener);
        }, 100);
        
        // Handle Escape key to close tooltip
        escapeListener = (event) => {
          if (event.key === 'Escape') {
            tooltip.remove();
            infoButton.style.backgroundColor = '';
            document.removeEventListener('keydown', escapeListener);
            escapeListener = null;
          }
        };
        document.addEventListener('keydown', escapeListener);
        
        const bannerObserver = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && 
                Array.from(mutation.removedNodes).includes(banner)) {
              tooltip.remove();
              bannerObserver.disconnect();
              
              // Clean up event listeners
              if (clickListener) {
                document.removeEventListener('click', clickListener);
                clickListener = null;
              }
              if (escapeListener) {
                document.removeEventListener('keydown', escapeListener);
                escapeListener = null;
              }
            }
          });
        });
        
        bannerObserver.observe(document.body, { childList: true });
      }
    });
  }
}

// Show warning banner for suspicious domains
function showWarningBanner(container, message, domains, riskScore, highlightedTerms, riskMetrics, trustedSender) {
  console.log("DEBUG: showWarningBanner called with message:", message, "domains:", domains, "riskScore:", riskScore);
  
  // Check if we're still viewing an individual email before showing the banner
  const hash = window.location.hash;
  const isIndividualEmail = hash && hash.includes('/');
  if (!isIndividualEmail) {
    console.log("DEBUG: Not showing warning banner - not viewing individual email. Hash:", hash);
    return; // Don't show banner if we've already navigated away
  }

  // If a banner is already showing and has been shown for less than 5 seconds, don't show a new one
  const existingBanner = document.getElementById('fraud-unified-banner');
  if (existingBanner) {
    const bannerTimestamp = parseInt(existingBanner.dataset.timestamp || '0');
    if (Date.now() - bannerTimestamp < 5000) {
      console.log("Skipping warning banner - existing banner is too recent");
      return;
    }
    existingBanner.remove();
  }
  
  console.log("Showing warning banner, Risk Score:", riskScore, "Domains:", domains, "Risk Metrics:", riskMetrics);
  
  const banner = document.createElement('div');
  banner.id = 'fraud-unified-banner';
  banner.dataset.timestamp = Date.now().toString();
  
  // Determine risk level based on score, domains, highlighted terms and trusted status
  let riskLevel = 'warning'; // High risk (red) by default

  // For emails from trusted senders, we need strong evidence to mark as high risk
  if ((trustedSender && riskScore < 0.75) || 
      (riskScore <= 0.6) || 
      (domains.length < 2 && (!riskMetrics || riskMetrics.highRiskCount < 2))) {
    riskLevel = 'caution';
  }
  
  banner.className = riskLevel;
  
  // Set initial style to ensure it's visible (override animation)
  banner.style.transform = 'translateX(-50%) translateY(0)';
  banner.style.opacity = '1';
  
  // Ensure we always have a risk score to display 
  // Adjust risk score display based on trusted status
  let effectiveRiskScore;
  const isTrustedEmail = banner.dataset.trustedSender === 'true';

  // For trusted senders, we display lower risk percentages
  if (isTrustedEmail) {
    // For trusted emails, cap the displayed risk at 65% even for warning level
    effectiveRiskScore = Math.min(riskScore * 1.1, 0.65);
  } else if (riskLevel === 'warning') {
    // For untrusted emails with warning level, show higher risk (minimum 65%)
    effectiveRiskScore = Math.max(0.65, Math.min(riskScore || 0.7, 0.95));
  } else if (riskLevel === 'caution') {
    // For caution level, show moderate risk (35-65%)
    effectiveRiskScore = Math.max(0.35, Math.min(riskScore || 0.5, 0.65));
  } else {
    // Default
    effectiveRiskScore = Math.max(0.05, Math.min(riskScore || 0.2, 0.95));
  }

  const riskPercentage = Math.round(effectiveRiskScore * 100);
  
  // Generate explanation text based on risk factors
  let explanationText = '';
  const reasons = [];
  
  if (domains && domains.length > 0) {
    if (domains.length > 1) {
      reasons.push(`Contains ${domains.length} suspicious domains`);
    } else {
      reasons.push(`Contains a suspicious domain (${domains[0]})`);
    }
  }
  
  if (riskMetrics) {
    if (riskMetrics.highRiskCount > 0) {
      reasons.push(`Contains ${riskMetrics.highRiskCount} high-risk phrases`);
    }
    if (riskMetrics.mediumRiskCount > 0) {
      reasons.push(`Contains ${riskMetrics.mediumRiskCount} suspicious phrases`);
    }
  }
  
  // Add generic risk reasons
  if (riskLevel === 'warning') {
    reasons.push("Uses language patterns common in phishing attempts");
    reasons.push("Contains urgent or threatening content");
  } else if (riskLevel === 'caution') {
    reasons.push("Contains language that requests sensitive information");
  }
  
  if (reasons.length > 0) {
    explanationText = `<div class="risk-explanation">
      <button class="info-button" title="Why this email appears risky">i</button>
      <div class="explanation-tooltip">
        <div class="tooltip-header">Risk factors detected:</div>
        <ul>
          ${reasons.map(reason => `<li>${reason}</li>`).join('')}
        </ul>
      </div>
    </div>`;
  }
  
  // Create HTML for highlighted terms, grouping by risk level
  let highlightedTermsHTML = '';
  
  if (riskMetrics && (riskMetrics.highRiskCount > 0 || riskMetrics.mediumRiskCount > 0)) {
    const highRiskHTML = riskMetrics.highRiskCount > 0 ? 
      `<div class="term-group high-risk">
        <span class="term-group-label">High risk:</span>
        ${highlightedTerms.slice(0, riskMetrics.highRiskCount).map(term => 
          `<span class="term high-risk">${term}</span>`).join('')}
      </div>` : '';
      
    const mediumRiskHTML = riskMetrics.mediumRiskCount > 0 ? 
      `<div class="term-group medium-risk">
        <span class="term-group-label">Medium risk:</span>
        ${highlightedTerms.slice(riskMetrics.highRiskCount).map(term => 
          `<span class="term medium-risk">${term}</span>`).join('')}
      </div>` : '';
    
    highlightedTermsHTML = `
      <div class="highlighted-terms">
        ${highRiskHTML}
        ${mediumRiskHTML}
      </div>
    `;
  } else if (highlightedTerms && highlightedTerms.length > 0) {
    // Fallback if no metrics provided
    highlightedTermsHTML = `
      <div class="highlighted-terms">
        Suspicious terms: ${highlightedTerms.map(term => `<span class="term">${term}</span>`).join('')}
      </div>
    `;
  }
  
  // Use appropriate icon based on risk level
  const iconSrc = riskLevel === 'caution' 
    ? chrome.runtime.getURL('images/caution.png') 
    : chrome.runtime.getURL('images/exclamation.png');
  
  // Set appropriate message based on risk level
  let titleMessage = message;
  if (!message || message === '') {
    titleMessage = riskLevel === 'caution' 
      ? 'This email contains potentially risky content' 
      : 'This email contains suspicious content';
  }
  
  banner.innerHTML = `
    <div class="row">
      <div class="phish-circle ${riskLevel}">
        <img src="${iconSrc}" alt="${riskLevel === 'caution' ? 'Caution' : 'Warning'}" />
      </div>
      <button class="close-btn">×</button>
    </div>
    <div class="banner-title">${titleMessage}</div>
    <div class="risk-meter">
      <span class="risk-label">Risk Assessment:</span>
      <span class="risk-percentage ${riskLevel}">${riskPercentage}% ${riskLevel === 'caution' ? 'risky' : 'suspicious'}</span>
      ${explanationText}
    </div>
    ${highlightedTermsHTML}
    ${domains && domains.length > 0 ? 
      `<div class="reputation-row">
        ${domains.map(d => `<div class="reputation-item ${riskLevel}">${d}</div>`).join('')}
      </div>` : 
      ''
    }
  `;
  
  document.body.appendChild(banner);
  setupBannerAnimationHandlers(banner);
  setupBannerCloseButton(banner);
  
  // Improved tooltip event handling
  const infoButton = banner.querySelector('.info-button');
  if (infoButton) {
    let clickListener = null;
    let escapeListener = null;
    
    infoButton.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // Find if we already have a tooltip visible for this button
      const existingTooltip = document.querySelector(`.explanation-tooltip[data-for-banner="${banner.id}"]`);
      const tooltipVisible = !!existingTooltip;
      
      // Toggle state - if visible, hide it; if hidden, show it
      if (tooltipVisible) {
        // Hide the tooltip
        existingTooltip.remove();
        infoButton.style.backgroundColor = '';
        
        // Clean up any event listeners
        if (clickListener) {
          document.removeEventListener('click', clickListener);
          clickListener = null;
        }
        if (escapeListener) {
          document.removeEventListener('keydown', escapeListener);
          escapeListener = null;
        }
      } else {
        // First, close any other open tooltips
        document.querySelectorAll('.explanation-tooltip.visible').forEach(t => t.remove());
        
        // Create and show new tooltip
        const tooltipWrapper = banner.querySelector('.explanation-tooltip');
        const tooltip = document.createElement('div');
        tooltip.className = 'explanation-tooltip visible';
        tooltip.dataset.forBanner = banner.id;
        
        // Copy content from template if it exists, otherwise use default content
        if (tooltipWrapper) {
          tooltip.innerHTML = tooltipWrapper.innerHTML;
        } else {
          // Use default content based on banner type
          tooltip.innerHTML = `
            <div class="tooltip-header">Risk factors detected:</div>
            <ul>
              <li>Contains suspicious language patterns</li>
              <li>May include requests for sensitive information</li>
              <li>Shows indicators common in phishing attempts</li>
            </ul>
          `;
        }
        
        document.body.appendChild(tooltip);
        infoButton.style.backgroundColor = 'rgba(255, 255, 255, 0.4)';
        
        // Position the tooltip below the banner
        const bannerRect = banner.getBoundingClientRect();
        tooltip.style.top = (bannerRect.bottom + 20) + 'px';
        
        // Set up click handler to close tooltip when clicking outside
        clickListener = (event) => {
          if (event.target !== infoButton && !tooltip.contains(event.target)) {
            tooltip.remove();
            infoButton.style.backgroundColor = '';
            document.removeEventListener('click', clickListener);
            clickListener = null;
          }
        };
        
        // Add with a small delay to prevent immediate closure
        setTimeout(() => {
          document.addEventListener('click', clickListener);
        }, 100);
        
        // Handle Escape key to close tooltip
        escapeListener = (event) => {
          if (event.key === 'Escape') {
            tooltip.remove();
            infoButton.style.backgroundColor = '';
            document.removeEventListener('keydown', escapeListener);
            escapeListener = null;
          }
        };
        document.addEventListener('keydown', escapeListener);
        
        const bannerObserver = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && 
                Array.from(mutation.removedNodes).includes(banner)) {
              tooltip.remove();
              bannerObserver.disconnect();
              
              // Clean up event listeners
              if (clickListener) {
                document.removeEventListener('click', clickListener);
                clickListener = null;
              }
              if (escapeListener) {
                document.removeEventListener('keydown', escapeListener);
                escapeListener = null;
              }
            }
          });
        });
        
        bannerObserver.observe(document.body, { childList: true });
      }
    });
  }
}

// Add reputation badge to links - DISABLED
// This function has been disabled to remove badges next to links
/*
function addReputationBadge(link, reputation) {
  // Don't add badges to links that already have them
  if (link.querySelector('.vt-badge')) return;
  
  const badge = document.createElement('span');
  
  // Only add badges to links with meaningful reputation data
  if (reputation && (reputation.malicious > 0 || reputation.suspicious > 0)) {
    badge.className = 'vt-badge vt-badge-malicious';
    // Set text based on severity
    if (reputation.malicious > 1) {
      badge.textContent = `${reputation.malicious} threats`;
    } else if (reputation.malicious === 1) {
      badge.textContent = `1 threat detected`;
    } else {
      badge.textContent = `Suspicious`;
    }
  } else if (reputation && reputation.harmless > 0) {
    badge.className = 'vt-badge vt-badge-harmless';
    badge.textContent = 'Verified safe';
  } else {
    // Don't show unknown badges - they're not helpful
    return;
  }
  
  // Ensure badge doesn't break layout by being too large
  const linkParent = link.parentElement;
  if (linkParent) {
    const linkRect = link.getBoundingClientRect();
    
    // Only append badge if link is large enough to accommodate it
    if (linkRect.width > 100) {
      link.appendChild(badge);
    }
  } else {
    link.appendChild(badge);
  }
}
*/

// Smart Link Preview feature - shows expanded URL and safety info when hovering over links
function setupSmartLinkPreviews() {
  // Custom CSS for smart link previews
  const linkPreviewStyles = document.createElement('style');
  linkPreviewStyles.id = 'fraud-link-preview-styles';
  linkPreviewStyles.textContent = `
    .fraud-link-preview {
      position: absolute;
      max-width: 400px;
      background: rgba(26, 26, 26, 0.97);
      color: #e0e0e0;
      padding: 14px 18px;
      border-radius: 6px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
      font-size: 13px;
      z-index: 9999;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      border: 1px solid rgba(255, 255, 255, 0.1);
      white-space: normal;
      line-height: 1.5;
      word-break: break-all;
    }
    
    .fraud-link-preview.visible {
      opacity: 1;
    }
    
    .fraud-link-preview-title {
      font-weight: 600;
      margin-bottom: 6px;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .fraud-link-preview-domain {
      font-size: 12px;
      color: #bbbbbb;
      margin-bottom: 10px;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .fraud-link-preview-status {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 10px;
    }
    
    .fraud-link-preview-icon {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: bold;
    }
    
    .fraud-link-preview-icon.loading {
      border: 2px solid rgba(255, 255, 255, 0.2);
      border-top: 2px solid #ffffff;
      animation: fraud-spin 1s linear infinite;
    }
    
    .fraud-link-preview-icon.safe {
      background-color: #128c15;
      color: white;
    }
    
    .fraud-link-preview-icon.unsafe {
      background-color: #e74c3c;
      color: white;
    }
    
    .fraud-link-preview-icon.unknown {
      background-color: #7f8c8d;
      color: white;
    }
    
    .fraud-link-redirect {
      font-size: 12px;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .fraud-link-redirect-label {
      font-weight: 600;
      display: block;
      margin-bottom: 4px;
    }
    
    .fraud-link-redirect-final {
      color: #bbbbbb;
      word-break: break-all;
    }
    
    @keyframes fraud-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(linkPreviewStyles);
  
  // Create a single preview element that we'll reuse for all links
  const linkPreview = document.createElement('div');
  linkPreview.className = 'fraud-link-preview';
  linkPreview.innerHTML = `
    <div class="fraud-link-preview-title"></div>
    <div class="fraud-link-preview-domain"></div>
    <div class="fraud-link-preview-status">
      <div class="fraud-link-preview-icon loading"></div>
      <span class="fraud-link-preview-text">Checking link safety...</span>
    </div>
    <div class="fraud-link-redirect" style="display:none">
      <span class="fraud-link-redirect-label">Redirects to:</span>
      <div class="fraud-link-redirect-final"></div>
    </div>
  `;
  document.body.appendChild(linkPreview);
  
  // Track links we've already processed
  const processedLinks = new Map();
  
  // Debounce function to avoid excessive API calls
  let hoverTimer;
  
  // Function to add hover listeners to all links in email
  function addLinkPreviewListeners() {
    // Find all links in the email
    const links = document.querySelectorAll('a[href]');
    
    links.forEach(link => {
      // Skip if already processed or if it's not a valid link
      if (link.dataset.smartPreview || !link.href || link.href.startsWith('mailto:') || link.href.startsWith('javascript:')) {
        return;
      }
      
      // Mark as processed
      link.dataset.smartPreview = "true";
      
      // Mouse enter - show preview after a short delay
      link.addEventListener('mouseenter', event => {
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => {
          showLinkPreview(link);
        }, 300); // 300ms delay before showing preview
      });
      
      // Mouse leave - hide preview
      link.addEventListener('mouseleave', event => {
        clearTimeout(hoverTimer);
        hideLinkPreview();
      });
      
      // Mouse move - position the preview
      link.addEventListener('mousemove', event => {
        positionLinkPreview(event);
      });
    });
  }
  
  // Function to show link preview
  function showLinkPreview(link) {
    const url = link.href;
    
    // Set initial content
    const titleElement = linkPreview.querySelector('.fraud-link-preview-title');
    const domainElement = linkPreview.querySelector('.fraud-link-preview-domain');
    const statusIcon = linkPreview.querySelector('.fraud-link-preview-icon');
    const statusText = linkPreview.querySelector('.fraud-link-preview-text');
    const redirectContainer = linkPreview.querySelector('.fraud-link-redirect');
    const redirectFinal = linkPreview.querySelector('.fraud-link-redirect-final');
    
    // Reset UI elements
    titleElement.textContent = link.textContent || url;
    redirectContainer.style.display = 'none';
    
    try {
      const urlObj = new URL(url);
      domainElement.textContent = urlObj.hostname;
    } catch (e) {
      domainElement.textContent = "Invalid URL";
    }
    
    // Show loading state
    statusIcon.className = 'fraud-link-preview-icon loading';
    statusText.textContent = 'Checking link safety...';
    
    // Show the preview
    linkPreview.classList.add('visible');
    
    // Check if we've already processed this URL
    if (processedLinks.has(url)) {
      const cachedResult = processedLinks.get(url);
      updatePreviewWithResults(cachedResult);
    } else {
      // Check the URL
      checkLinkSafety(url).then(result => {
        // Cache the result
        processedLinks.set(url, result);
        updatePreviewWithResults(result);
      });
    }
    
    // Helper function to update preview with results
    function updatePreviewWithResults(result) {
      // Update status
      statusIcon.className = `fraud-link-preview-icon ${result.status}`;
      statusText.textContent = result.message;
      
      // Show final destination if it's different
      if (result.finalUrl && result.finalUrl !== url) {
        redirectContainer.style.display = 'block';
        redirectFinal.textContent = result.finalUrl;
        
        // Try to get the domain from the final URL
        try {
          const finalUrlObj = new URL(result.finalUrl);
          const originalUrlObj = new URL(url);
          
          // Highlight that the domain is different
          if (finalUrlObj.hostname !== originalUrlObj.hostname) {
            redirectFinal.innerHTML = `<strong>${finalUrlObj.hostname}</strong>${finalUrlObj.pathname}${finalUrlObj.search}`;
          }
        } catch (e) {
          // Invalid URL format, just show the full URL
        }
      }
    }
  }
  
  // Function to hide link preview
  function hideLinkPreview() {
    linkPreview.classList.remove('visible');
  }
  
  // Function to position the preview near the cursor
  function positionLinkPreview(event) {
    const x = event.clientX + 15;
    const y = event.clientY + 15;
    
    // Adjust position to stay within viewport
    const rect = linkPreview.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let adjustedX = x;
    let adjustedY = y;
    
    // Adjust horizontally if needed
    if (x + rect.width > viewportWidth - 20) {
      adjustedX = x - rect.width - 10;
    }
    
    // Adjust vertically if needed
    if (y + rect.height > viewportHeight - 20) {
      adjustedY = y - rect.height - 10;
    }
    
    linkPreview.style.left = `${adjustedX}px`;
    linkPreview.style.top = `${adjustedY}px`;
  }
  
  // Function to check link safety and get final destination
  async function checkLinkSafety(url) {
    // Default result object
    const result = {
      status: 'unknown',
      message: 'Could not verify link',
      finalUrl: null
    };
    
    try {
      // First check local blacklist
      let isBlacklisted = false;
      try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        
        // Check if domain is in blacklist
        isBlacklisted = blacklist.some(blacklistDomain => 
          matchesDomain(domain, blacklistDomain)
        );
        
        if (isBlacklisted) {
          result.status = 'unsafe';
          result.message = 'Blocklisted domain detected';
          return result;
        }
        
        // Check if domain is in whitelist - if so, mark as safe immediately
        const isWhitelisted = whitelist.some(whitelistDomain => 
          matchesDomain(domain, whitelistDomain)
        );
        
        if (isWhitelisted) {
          result.status = 'safe';
          result.message = 'Trusted domain';
          return result;
        }
      } catch (e) {
        console.error('Error checking blacklist:', e);
      }
      
      // Send message to background script to check URL
      return new Promise(resolve => {
        chrome.runtime.sendMessage({
          type: 'check-url',
          url: url
        }, response => {
          if (response && response.success) {
            // Set status and message based on scan results
            if (response.malicious > 0) {
              result.status = 'unsafe';
              result.message = `Unsafe: ${response.malicious} threat detection${response.malicious > 1 ? 's' : ''}`;
            } else if (response.suspicious > 0) {
              result.status = 'unsafe';
              result.message = 'Suspicious link detected';
            } else {
              result.status = 'safe';
              result.message = 'No threats detected';
            }
            
            // Set the final URL if available
            if (response.finalUrl) {
              result.finalUrl = response.finalUrl;
            }
            
            resolve(result);
          } else {
            resolve(result);
          }
        });
      });
    } catch (error) {
      console.error('Error checking link:', error);
      return result;
    }
  }
  
  // Set up a mutation observer to handle dynamically added links
  const observer = new MutationObserver(() => {
    addLinkPreviewListeners();
  });
  
  // Start observing the document
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Initial scan
  addLinkPreviewListeners();
}

// Analyze email content for phishing indicators with optimized performance
function analyzeEmailContent(container, text, callback) {
  // Constants for progressive analysis
  const TEXT_CHUNK_SIZE = 5000; // Characters per chunk
  const MAX_TEXT_LENGTH = 50000; // Maximum text length to analyze
  const ANALYSIS_DELAY = 10; // ms between chunks to allow UI thread to breathe
  
  console.log(`Analyzing email content of length ${text.length} characters`);
  
  // Skip analysis if there's no text to analyze
  if (!text || text.length < 20) {
    callback(0.1, [], { highRiskCount: 0, mediumRiskCount: 0, lowRiskCount: 0 });
    return;
  }

  // Truncate extremely long emails to prevent performance issues
  const truncatedText = text.length > MAX_TEXT_LENGTH ? 
                        text.substring(0, MAX_TEXT_LENGTH) + "..." : 
                        text;

  // For very large emails, show a processing indicator
  let processingIndicator = null;
  if (text.length > TEXT_CHUNK_SIZE * 2) {
    processingIndicator = document.createElement('div');
    processingIndicator.className = 'fraud-processing-indicator';
    processingIndicator.textContent = 'Analyzing for security threats...';
    processingIndicator.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(0,0,0,0.7);
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
    `;
    container.appendChild(processingIndicator);
  }

  // Implement progressive analysis for large texts
  if (truncatedText.length > TEXT_CHUNK_SIZE) {
    progressiveAnalysis(truncatedText, (score, terms, metrics) => {
      // Remove indicator when analysis is complete
      if (processingIndicator) {
        processingIndicator.remove();
      }
      callback(score, terms, metrics);
    });
  } else {
    // For smaller texts, analyze immediately
    const result = performLocalAnalysis(truncatedText);
    callback(result.score, result.terms, result.metrics);
  }
  
  // Progressive analysis function
  function progressiveAnalysis(fullText, finalCallback) {
    // Split text into manageable chunks
    const chunks = [];
    for (let i = 0; i < fullText.length; i += TEXT_CHUNK_SIZE) {
      chunks.push(fullText.substring(i, i + TEXT_CHUNK_SIZE));
    }
    
    // Initialize result accumulators
    let combinedTerms = [];
    let highRiskCount = 0;
    let mediumRiskCount = 0;
    let lowRiskCount = 0;
    let totalRiskScore = 0;
    
    // Process chunks with small delays to prevent UI blocking
    processNextChunk(0);
    
    function processNextChunk(index) {
      if (index >= chunks.length) {
        // All chunks processed, calculate final score and call back
        const finalScore = Math.min(0.95, totalRiskScore / chunks.length);
        finalCallback(finalScore, combinedTerms, {
          highRiskCount,
          mediumRiskCount,
          lowRiskCount
        });
        return;
      }
      
      // If we're partway through processing and the user has navigated away, abort
      if (!document.body.contains(container)) {
        console.log('Email container no longer in DOM, aborting analysis');
        if (processingIndicator) processingIndicator.remove();
        return;
      }
      
      // Process this chunk
      setTimeout(() => {
        const chunk = chunks[index];
        const result = performLocalAnalysis(chunk);
        
        // Update accumulators
        totalRiskScore += result.score;
        combinedTerms = [...combinedTerms, ...result.terms];
        highRiskCount += result.metrics.highRiskCount;
        mediumRiskCount += result.metrics.mediumRiskCount;
        lowRiskCount += result.metrics.lowRiskCount;
        
        // Update processing indicator if it exists
        if (processingIndicator) {
          const progress = Math.round((index + 1) / chunks.length * 100);
          processingIndicator.textContent = `Analyzing: ${progress}% complete`;
        }
        
        // Process next chunk
        processNextChunk(index + 1);
      }, ANALYSIS_DELAY);
    }
  }
  
  // Perform local analysis on a text segment
  function performLocalAnalysis(text) {
    // Initialize pattern matching
    const highRiskPatterns = [
      /\b(verify|confirm|validate|update)\s+.{0,20}\s+(account|password|identity|login|credential)/gi,
      /\b(unusual|suspicious)\s+.{0,20}\s+(activity|login|sign-?in)/gi,
      /\b(payment|transfer|transaction)\s+.{0,10}\s+(canceled|declined|rejected)/gi,
      /\b(urgent|immediate|limited\s+time)\s+.{0,15}\s+(action|response|attention)/gi
    ];
    
    const mediumRiskPatterns = [
      /\b(click|open)\s+.{0,20}\s+(link|attachment)\s+.{0,20}\s+(verify|confirm)/gi,
      /\b(limited|one\s+time)\s+.{0,10}\s+(offer|opportunity|deal)/gi,
      /\b(won|winner|prize|reward|bonus)\s+.{0,15}\s+(lottery|contest|competition|selected)/gi,
      /\bsecurity\s+.{0,10}\s+(breach|violation|incident)/gi
    ];
    
    const lowRiskPatterns = [
      /\b(free|discount|save|offer|special)\s+.{0,10}\s+(trial|membership|subscription)/gi,
      /\b(exclusive|limited|special)\s+.{0,10}\s+(access|invitation|preview)/gi,
      /\b(please|kindly|attention)\s+.{0,15}\s+(review|consider|read)/gi
    ];
    
    // Perform analysis
    const matches = {
      high: [],
      medium: [],
      low: []
    };
    
    // Check for high risk patterns
    highRiskPatterns.forEach(pattern => {
      const patternMatches = text.match(pattern);
      if (patternMatches) {
        matches.high = [...matches.high, ...patternMatches];
      }
    });
    
    // Check for medium risk patterns
    mediumRiskPatterns.forEach(pattern => {
      const patternMatches = text.match(pattern);
      if (patternMatches) {
        matches.medium = [...matches.medium, ...patternMatches];
      }
    });
    
    // Check for low risk patterns
    lowRiskPatterns.forEach(pattern => {
      const patternMatches = text.match(pattern);
      if (patternMatches) {
        matches.low = [...matches.low, ...patternMatches];
      }
    });
    
    // Calculate risk score based on matches
    const highRiskWeight = 0.3;
    const mediumRiskWeight = 0.15;
    const lowRiskWeight = 0.05;
    
    const uniqueHighMatches = [...new Set(matches.high)];
    const uniqueMediumMatches = [...new Set(matches.medium)];
    const uniqueLowMatches = [...new Set(matches.low)];
    
    const highRiskScore = Math.min(0.9, uniqueHighMatches.length * highRiskWeight);
    const mediumRiskScore = Math.min(0.6, uniqueMediumMatches.length * mediumRiskWeight);
    const lowRiskScore = Math.min(0.3, uniqueLowMatches.length * lowRiskWeight);
    
    // Calculate total risk score
    const combinedScore = Math.min(0.95, highRiskScore + mediumRiskScore + lowRiskScore);
    
    // Prepare matched terms with risk levels
    const terms = [
      ...uniqueHighMatches.map(term => ({ text: term, level: 'high' })),
      ...uniqueMediumMatches.map(term => ({ text: term, level: 'medium' })),
      ...uniqueLowMatches.map(term => ({ text: term, level: 'low' }))
    ];
    
    // Fallback to API analysis for more comprehensive detection
    try {
      chrome.runtime.sendMessage({
        type: 'analyze',
        text: text.substring(0, 1000) // Only send the first 1000 chars to the API
      }, response => {
        // This response will arrive asynchronously, but we already have the basic analysis
        if (response && response.score) {
          console.log('API analysis returned score:', response.score);
          // We could update the UI here if needed
        }
      });
    } catch (e) {
      console.error('Error calling API for analysis:', e);
    }
    
    return {
      score: combinedScore,
      terms,
      metrics: {
        highRiskCount: uniqueHighMatches.length,
        mediumRiskCount: uniqueMediumMatches.length,
        lowRiskCount: uniqueLowMatches.length
      }
    };
  }
}

// Add a simple floating inbox health indicator
function setupFloatingHealthIndicator() {
  // Create styles for the floating indicator without affecting existing elements
  const floatingIndicatorStyle = document.createElement('style');
  floatingIndicatorStyle.id = 'fraud-floating-indicator-style';
  floatingIndicatorStyle.textContent = `
    #fraud-floating-indicator {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #7f8c8d;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.3);
      cursor: pointer;
      z-index: 9999;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      border: 2px solid rgba(255, 255, 255, 0.9);
      transition: transform 0.2s;
    }
    
    #fraud-floating-indicator:hover {
      transform: scale(1.1);
    }
    
    #fraud-floating-indicator.safe {
      background: #128c15;
    }
    
    #fraud-floating-indicator.medium {
      background: #e67e22;
    }
    
    #fraud-floating-indicator.high {
      background: #e74c3c;
      animation: pulseThreat 2s infinite;
    }
    
    /* Pulsing animation for the threat indicator */
    @keyframes pulseThreat {
      0% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.7); }
      70% { box-shadow: 0 0 0 10px rgba(231, 76, 60, 0); }
      100% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0); }
    }
    
    #fraud-delete-threats-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(to right, #c0392b, #e74c3c);
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px 12px;
      margin-top: 15px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      width: 100%;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    }
    
    #fraud-delete-threats-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.3);
      background: linear-gradient(to right, #e74c3c, #c0392b);
    }
    
    #fraud-delete-threats-btn:active {
      transform: translateY(0);
      box-shadow: 0 2px 3px rgba(0,0,0,0.3);
    }
    
    #fraud-delete-threats-btn .btn-icon {
      margin-right: 8px;
      font-size: 14px;
    }
    
    #fraud-delete-threats-btn:disabled {
      background: #95a5a6;
      cursor: not-allowed;
      opacity: 0.7;
    }
    
    /* Animation for the delete button when new threats appear */
    @keyframes pulseButton {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
    
    .pulse-animation {
      animation: pulseButton 1s ease-in-out;
    }
    
    /* Styles for the popup */
    #fraud-floating-popup {
      position: fixed;
      bottom: 70px;
      right: 20px;
      width: 240px;
      background: rgba(25, 25, 25, 0.95);
      color: #e0e0e0;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      z-index: 9998;
      display: none;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    /* IMPORTANT: This style makes the popup visible when it has the 'visible' class */
    #fraud-floating-popup.visible {
      display: block;
    }
    
    /* Style for the stat grid */
    .fraud-popup-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 10px;
    }
    
    .fraud-stat-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    
    .fraud-stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px 4px;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.08);
    }
    
    .fraud-stat-value {
      font-size: 16px;
      font-weight: bold;
    }
    
    .fraud-stat-label {
      font-size: 11px;
      color: #aaaaaa;
      margin-top: 3px;
    }
    
    .fraud-stat-item.high {
      background: rgba(231, 76, 60, 0.2);
    }
    
    .fraud-stat-item.medium {
      background: rgba(230, 126, 34, 0.2);
    }
    
    .fraud-stat-item.safe {
      background: rgba(18, 140, 21, 0.2);
    }
  `;
  document.head.appendChild(floatingIndicatorStyle);
  
  // Create the floating indicator
  const floatingIndicator = document.createElement('div');
  floatingIndicator.id = 'fraud-floating-indicator';
  floatingIndicator.textContent = '0';
  document.body.appendChild(floatingIndicator);
  
  // Create the popup
  const popup = document.createElement('div');
  popup.id = 'fraud-floating-popup';
  popup.innerHTML = `
    <div class="fraud-popup-title">Inbox Safety Summary</div>
    <div class="fraud-stat-grid">
      <div class="fraud-stat-item high">
        <div class="fraud-stat-value" id="fraud-high-count">0</div>
        <div class="fraud-stat-label">Threats</div>
      </div>
      <div class="fraud-stat-item medium">
        <div class="fraud-stat-value" id="fraud-medium-count">0</div>
        <div class="fraud-stat-label">Warnings</div>
      </div>
      <div class="fraud-stat-item safe">
        <div class="fraud-stat-value" id="fraud-safe-count">0</div>
        <div class="fraud-stat-label">Safe</div>
      </div>
    </div>
    <button id="fraud-delete-threats-btn" disabled>
      <span class="btn-icon">🗑️</span>
      Delete All Threats
    </button>
  `;
  document.body.appendChild(popup);
  
  // Track previous threat count to detect new threats
  let previousThreatCount = 0;
  
  // Toggle popup on click
  floatingIndicator.addEventListener('click', () => {
    popup.classList.toggle('visible');
  });
  
  // Hide popup when clicking outside
  document.addEventListener('click', (e) => {
    if (!popup.contains(e.target) && e.target !== floatingIndicator) {
      popup.classList.remove('visible');
    }
  });
  
  // Handle "Delete All Threats" button
  const deleteThreatsBtn = document.getElementById('fraud-delete-threats-btn');
  deleteThreatsBtn.addEventListener('click', () => {
    // Get all email rows with high risk
    const threatenedEmails = document.querySelectorAll('tr[role="row"][data-risk-level="high"]');
    
    if (threatenedEmails.length === 0) return;
    
    console.log(`Deleting ${threatenedEmails.length} threatening emails`);
    
    // Provide visual feedback
    deleteThreatsBtn.textContent = "Deleting...";
    deleteThreatsBtn.disabled = true;
    
    // Find Gmail's "Delete" button and click it for each email
    try {
      // Check if we need to select the emails first
      threatenedEmails.forEach(email => {
        // Try to find and click the checkbox to select the email
        const checkbox = email.querySelector('input[type="checkbox"], div[role="checkbox"]');
        if (checkbox) {
          checkbox.click();
        }
      });
      
      // Find and click Gmail's delete button after selecting the emails
      setTimeout(() => {
        // Look for Gmail's delete button (this selector may change with Gmail updates)
        const gmailDeleteBtn = document.querySelector('.T-I.J-J5-Ji.nX.T-I-ax7');
        if (gmailDeleteBtn) {
          gmailDeleteBtn.click();
          
          // Reset button state after a moment
          setTimeout(() => {
            deleteThreatsBtn.innerHTML = '<span class="btn-icon">🗑️</span> Delete All Threats';
            deleteThreatsBtn.disabled = false;
            // Update stats after deletion
            updateStats();
          }, 1000);
        } else {
          console.log("Couldn't find Gmail's delete button");
          deleteThreatsBtn.innerHTML = '<span class="btn-icon">🗑️</span> Delete All Threats';
          deleteThreatsBtn.disabled = false;
        }
      }, 300);
    } catch (e) {
      console.error("Error deleting threats:", e);
      deleteThreatsBtn.innerHTML = '<span class="btn-icon">🗑️</span> Delete All Threats';
      deleteThreatsBtn.disabled = false;
    }
  });
  
  // Update statistics periodically
  function updateStats() {
    const stats = {
      high: document.querySelectorAll('tr[role="row"] .fraud-inbox-badge.high').length,
      medium: document.querySelectorAll('tr[role="row"] .fraud-inbox-badge.medium').length,
      safe: document.querySelectorAll('tr[role="row"] .fraud-inbox-badge.safe').length
    };
    
    // Update counts in popup
    document.getElementById('fraud-high-count').textContent = stats.high;
    document.getElementById('fraud-medium-count').textContent = stats.medium;
    document.getElementById('fraud-safe-count').textContent = stats.safe;
    
    // Update indicator
    const total = stats.high + stats.medium + stats.safe;
    floatingIndicator.textContent = total;
    
    // Update indicator color based on highest threat level
    if (stats.high > 0) {
      floatingIndicator.className = 'high';
    } else if (stats.medium > 0) {
      floatingIndicator.className = 'medium';
    } else if (stats.safe > 0) {
      floatingIndicator.className = 'safe';
    } else {
      floatingIndicator.className = '';
    }
    
    // Update delete button state
    const deleteBtn = document.getElementById('fraud-delete-threats-btn');
    if (stats.high > 0) {
      deleteBtn.disabled = false;
      
      // Add pulse animation if new threats detected
      if (stats.high > previousThreatCount) {
        deleteBtn.classList.add('pulse-animation');
        setTimeout(() => {
          deleteBtn.classList.remove('pulse-animation');
        }, 1000);
      }
    } else {
      deleteBtn.disabled = true;
    }
    
    // Store current threat count for next comparison
    previousThreatCount = stats.high;
  }
  
  // Initial update and set interval
  setTimeout(updateStats, 1000);
  setInterval(updateStats, 5000);
}

// Fix the safe box in the popup HTML - there was an incorrect class name with a period
function fixSafeBoxStyling() {
  const popup = document.getElementById('fraud-floating-popup');
  if (popup) {
    // Fix the HTML for the popup
    popup.innerHTML = `
      <div class="fraud-popup-title">Inbox Safety Summary</div>
      <div class="fraud-stat-grid">
        <div class="fraud-stat-item high">
          <div class="fraud-stat-value" id="fraud-high-count">0</div>
          <div class="fraud-stat-label">Threats</div>
        </div>
        <div class="fraud-stat-item medium">
          <div class="fraud-stat-value" id="fraud-medium-count">0</div>
          <div class="fraud-stat-label">Warnings</div>
        </div>
        <div class="fraud-stat-item safe">
          <div class="fraud-stat-value" id="fraud-safe-count">0</div>
          <div class="fraud-stat-label">Safe</div>
        </div>
      </div>
      <button id="fraud-delete-threats-btn" disabled>Delete All Threats</button>
    `;
    
    // Reattach the delete button event listener
    const deleteThreatsBtn = document.getElementById('fraud-delete-threats-btn');
    if (deleteThreatsBtn) {
      deleteThreatsBtn.addEventListener('click', () => {
        const threatenedEmails = document.querySelectorAll('tr[role="row"][data-risk-level="high"]');
        if (threatenedEmails.length === 0) return;
        
        console.log(`Deleting ${threatenedEmails.length} threatening emails`);
        deleteThreatsBtn.textContent = "Deleting...";
        deleteThreatsBtn.disabled = true;
        
        try {
          threatenedEmails.forEach(email => {
            const checkbox = email.querySelector('input[type="checkbox"], div[role="checkbox"]');
            if (checkbox) {
              checkbox.click();
            }
          });
          
          setTimeout(() => {
            const gmailDeleteBtn = document.querySelector('.T-I.J-J5-Ji.nX.T-I-ax7');
            if (gmailDeleteBtn) {
              gmailDeleteBtn.click();
              setTimeout(() => {
                deleteThreatsBtn.textContent = "Delete All Threats";
                deleteThreatsBtn.disabled = false;
                // Update stats after deletion
                if (typeof updateStats === 'function') updateStats();
              }, 1000);
            } else {
              console.log("Couldn't find Gmail's delete button");
              deleteThreatsBtn.textContent = "Delete All Threats";
              deleteThreatsBtn.disabled = false;
            }
          }, 300);
        } catch (e) {
          console.error("Error deleting threats:", e);
          deleteThreatsBtn.textContent = "Delete All Threats";
          deleteThreatsBtn.disabled = false;
        }
      });
    }
  }
}

// Run this fix right after setupFloatingHealthIndicator is called
setTimeout(fixSafeBoxStyling, 1500);

// Replace only the popup styling with an improved design
// First, remove any existing style elements that might conflict
const oldStyles = document.querySelectorAll('#fraud-enhanced-popup-styles, #fraud-popup-images-v1, #fraud-optimized-images');
oldStyles.forEach(style => style.remove());

// Create a unified popup styling
const improvedPopupStyles = document.createElement('style');
improvedPopupStyles.id = 'fraud-improved-popup-styles-v1';
improvedPopupStyles.textContent = `
  /* Modern floating popup with flat design */
  #fraud-floating-popup {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 280px;
    background: linear-gradient(to bottom, #252525, #1a1a1a);
    color: #e0e0e0;
    border-radius: 10px;
    padding: 18px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.35);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    z-index: 9998;
    display: none;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: transform 0.3s, opacity 0.3s;
  }
  
  #fraud-floating-popup.visible {
    display: block;
    animation: fraud-fade-in 0.3s ease;
  }
  
  @keyframes fraud-fade-in {
    from { opacity: 0.7; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  /* Header with icon */
  .fraud-popup-title {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 14px;
    color: #ffffff;
    display: flex;
    align-items: center;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    position: relative;
  }
  
  /* Insurance icon with better positioning */
  .fraud-popup-title:before {
    content: '';
    display: inline-block;
    width: 20px;
    height: 20px;
    background-image: url('${chrome.runtime.getURL('images/insurance.png')}');
    background-size: contain;
    background-position: center;
    background-repeat: no-repeat;
    margin-right: 10px;
    flex-shrink: 0;
  }
  
  /* Improved stat grid */
  .fraud-stat-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 16px;
  }
  
  /* Better stat items */
  .fraud-stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 12px 4px;
    border-radius: 8px;
    transition: transform 0.2s, box-shadow 0.2s;
    min-height: 70px;
  }
  
  .fraud-stat-value {
    font-size: 22px;
    font-weight: 700;
    margin-bottom: 6px;
  }
  
  .fraud-stat-label {
    font-size: 12px;
    color: #bbbbbb;
  }
  
  /* Stat item colors */
  .fraud-stat-item.high {
    background: linear-gradient(135deg, rgba(231, 76, 60, 0.15) 0%, rgba(192, 57, 43, 0.22) 100%);
    border: 1px solid rgba(231, 76, 60, 0.3);
  }
  
  .fraud-stat-item.high .fraud-stat-value {
    color: #e74c3c;
  }
  
  .fraud-stat-item.medium {
    background: linear-gradient(135deg, rgba(230, 126, 34, 0.15) 0%, rgba(211, 84, 0, 0.22) 100%);
    border: 1px solid rgba(230, 126, 34, 0.3);
  }
  
  .fraud-stat-item.medium .fraud-stat-value {
    color: #e67e22;
  }
  
  .fraud-stat-item.safe {
    background: linear-gradient(135deg, rgba(46, 204, 113, 0.15) 0%, rgba(39, 174, 96, 0.22) 100%);
    border: 1px solid rgba(46, 204, 113, 0.3);
  }
  
  .fraud-stat-item.safe .fraud-stat-value {
    color: #2ecc71;
  }
  
  /* Delete button with bin icon */
  #fraud-delete-threats-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(to right, #d63031, #e84393);
    color: white;
    width: 100%;
    border: none;
    border-radius: 8px;
    padding: 0;
    height: 42px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    overflow: hidden;
  }
  
  #fraud-delete-threats-btn:before {
    content: '';
    position: absolute;
    left: 16px;
    top: 50%;
    transform: translateY(-50%);
    width: 18px;
    height: 18px;
    background-image: url('${chrome.runtime.getURL('images/bin.png')}');
    background-size: contain;
    background-position: center;
    background-repeat: no-repeat;
  }
  
  #fraud-delete-threats-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 10px rgba(0,0,0,0.4);
  }
  
  #fraud-delete-threats-btn:active {
    transform: translateY(0);
  }
  
  #fraud-delete-threats-btn:disabled {
    background: linear-gradient(to right, #718093, #95a5a6);
    transform: none;
    box-shadow: none;
    cursor: not-allowed;
    opacity: 0.7;
  }
  
  /* Animation for count changes */
  @keyframes countPulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.15); color: white; }
    100% { transform: scale(1); }
  }
  
  .count-changed {
    animation: countPulse 0.5s ease;
  }
`;

document.head.appendChild(improvedPopupStyles);

// Function to update the popup HTML structure while preserving functionality
function enhancePopupAppearance() {
  const popup = document.getElementById('fraud-floating-popup');
  if (!popup) return;
  
  const deleteBtn = document.getElementById('fraud-delete-threats-btn');
  if (deleteBtn) {
    // Remove emoji and clean up text
    deleteBtn.textContent = "Delete All Threats";
  }
}

// Run once to update popup appearance
setTimeout(enhancePopupAppearance, 500);

// Start the observer and initial scan
const scanObserver = new MutationObserver((mutations) => {
  // Only trigger scan if we see significant DOM changes in email content areas
  let shouldScan = false;
  
  mutations.forEach(mutation => {
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      // Check if added nodes contain email content
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Look for Gmail's email content containers
          if (node.matches && (
            node.matches('.ii.gt') || 
            node.matches('.adn') || 
            node.matches('[role="main"]') ||
            node.querySelector('.ii.gt, .adn')
          )) {
            shouldScan = true;
          }
        }
      });
    }
  });
  
  if (shouldScan) {
    // Debounce the scan call
    clearTimeout(scanObserver.timer);
    scanObserver.timer = setTimeout(scanEmail, 500);
  }
});

scanObserver.observe(document.body, { 
  childList: true, 
  subtree: true,
  // Reduce the scope to avoid too many mutations
  attributeFilter: ['class', 'role']
});

scanEmail();
setupEmailNavigationDetection();
setupInboxScanning();
setupFloatingHealthIndicator();
setupSmartLinkPreviews();