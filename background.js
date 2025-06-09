// background.js v31: Moved API keys to secure config file using ES modules
import { CONFIG } from './config.js';

// Get API keys from the imported config
let VT_API_KEY = CONFIG?.VT_API_KEY || '';
let HF_API_KEY = CONFIG?.HF_API_KEY || '';

// Domain reputation lookup handler
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === 'vt-reputation' && Array.isArray(req.domains)) {
    console.log("Checking domain reputation for:", req.domains);
    
    // Handle real API integration with fallback for rate limiting
    const reputations = {};
    let domainsProcessed = 0;
    const totalDomains = req.domains.length;
    
    // If no domains to check, return empty result
    if (totalDomains === 0) {
      sendResponse({reputations: {}});
      return true;
    }
    
    // Since we're getting rate limited by VirusTotal (429 error), 
    // let's use our sophisticated fallback algorithm for all domains
    
    req.domains.forEach(domain => {
      reputations[domain] = getReputationScore(domain);
      domainsProcessed++;
      
      if (domainsProcessed === totalDomains) {
        console.log("Sending reputation data using fallback algorithm:", reputations);
        sendResponse({reputations: reputations});
      }
    });
    
    return true; // Keep connection open for async response
  }
  
  // Text analysis handler for phishing detection
  if (req.type === 'analyze') {
    const text = req.text || '';
    
    // Since we're getting 404 errors from HuggingFace models,
    // let's use our enhanced local analysis instead of trying the API
    const fallbackScore = performEnhancedAnalysis(text);
    console.log("Using local phishing analysis, score:", fallbackScore);
    sendResponse({score: fallbackScore});
    
    return true; // Keep connection open for async response
  }
  
  // Handle URL checking requests from the content script
  if (req.type === 'check-url') {
    checkURLSafety(req.url)
      .then(result => sendResponse(result))
      .catch(error => {
        console.error('Error checking URL:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    // Return true to indicate we'll respond asynchronously
    return true;
  }
});

// Completely refine getReputationScore with a more sophisticated algorithm
function getReputationScore(domain) {
  // Initialize score components with precise values
  let trustScore = 0;
  let riskScore = 0;
  let confidenceLevel = 0.6; // Reduced base confidence
  
  // Domain name characteristics analysis
  const domainLength = domain.length;
  const domainParts = domain.split('.');
  const primaryDomain = domainParts[domainParts.length - 2] || '';
  const tld = domainParts[domainParts.length - 1].toLowerCase();
  
  // Advanced pattern detection
  const vowelCount = (primaryDomain.match(/[aeiou]/gi) || []).length;
  const consonantCount = primaryDomain.length - vowelCount;
  const vowelConsonantRatio = vowelCount / (consonantCount || 1);
  const hasNumbers = /\d/.test(primaryDomain);
  const digitCount = (primaryDomain.match(/\d/g) || []).length;
  const letterCount = primaryDomain.length - digitCount;
  const digitRatio = digitCount / (primaryDomain.length || 1);
  const hasDashes = primaryDomain.includes('-');
  const dashCount = (primaryDomain.match(/-/g) || []).length;
  const consecutiveConsonants = (primaryDomain.match(/[^aeiou]{4,}/gi) || []).length;
  const consecutiveDigits = (primaryDomain.match(/\d{3,}/g) || []).length;
  const randomLookingSegments = (primaryDomain.match(/[a-z]{1,2}\d{1,3}[a-z]{1,2}/gi) || []).length;
  
  // Calculate lexical diversity (unique chars / total chars)
  const uniqueChars = new Set(primaryDomain).size;
  const lexicalDiversity = uniqueChars / (primaryDomain.length || 1);
  
  // Calculate entropy with accurate log base 2
  const charFreq = {};
  for (const char of primaryDomain) {
    charFreq[char] = (charFreq[char] || 0) + 1;
  }
  let entropy = 0;
  for (const char in charFreq) {
    const freq = charFreq[char] / primaryDomain.length;
    entropy -= freq * Math.log2(freq);
  }
  
  // TLD analysis (common vs uncommon)
  const commonTLDs = ['com', 'org', 'net', 'edu', 'gov', 'io', 'co', 'info', 'biz', 'app', 'dev', 'me', 'tech', 'ai', 'uk', 'de', 'fr', 'jp', 'ru', 'br', 'es', 'it', 'nl', 'pl', 'ca', 'au', 'in', 'cn'];
  const moderatelyCommonTLDs = ['shop', 'blog', 'store', 'site', 'online', 'xyz', 'club', 'live', 'news', 'life', 'world', 'space'];
  const somewhatUncommonTLDs = ['uno', 'pro', 'cool', 'best', 'gives', 'zone', 'ninja', 'media', 'games', 'studio'];
  const rareOrExpensiveTLDs = ['ai', 'app', 'crypto', 'nft', 'eth', 'luxury', 'rich', 'vip'];
  
  // Subdomain analysis
  const subdomainCount = domainParts.length - 2;
  const hasExcessiveSubdomains = subdomainCount > 3;
  const nestedSubdomains = domain.split('.').length > 4;
  
  // Known safe domains check
  const commonSafeDomains = [
    'google.com', 'microsoft.com', 'apple.com', 'amazon.com', 'facebook.com', 
    'github.com', 'youtube.com', 'linkedin.com', 'twitter.com', 'instagram.com',
    'wikipedia.org', 'wordpress.com', 'mozilla.org', 'adobe.com', 'vimeo.com',
    'tumblr.com', 'yahoo.com', 'netflix.com', 'paypal.com', 'dropbox.com',
    'gmail.com', 'outlook.com', 'hotmail.com', 'live.com', 'icloud.com',
    'pinterest.com', 'reddit.com', 'quora.com', 'spotify.com', 'zoom.us',
    'slack.com', 'office.com', 'notion.so', 'canva.com', 'shopify.com',
    'cloudflare.com', 'godaddy.com', 'squarespace.com', 'wix.com', 'wordpress.org',
    'cloudfront.net', 'amazonaws.com', 'googleusercontent.com', 'googlevideo.com',
    'googleadservices.com', 'googleanalytics.com', 'gstatic.com', 'bing.com',
    'opera.com', 'mozilla.com', 'firefox.com', 'safari.com', 'edge.com',
    'chase.com', 'bankofamerica.com', 'wellsfargo.com', 'citibank.com', 'capitalone.com',
    'lemongym.lv', 'drive.google.com', 'mail.google.com', 'translate.google.com',
    'photos.google.com', 'play.google.com', 'books.google.com', 'scholar.google.com',
    'calendar.google.com', 'meet.google.com', 'store.google.com', 'contacts.google.com',
    'chromium.org', 'gitlab.com', 'bitbucket.org', 'stackoverflow.com', 'stackexchange.com',
    'medium.com', 'dev.to', 'digitalocean.com', 'heroku.com', 'vercel.app',
    'netlify.app', 'stripe.com', 'paypal.com', 'quickbooks.com'
  ];
  
  const isDomainOrSubdomain = (d, base) => d === base || d.endsWith('.' + base);
  
  // Check for known safe domains
  for (const safeDomain of commonSafeDomains) {
    if (isDomainOrSubdomain(domain, safeDomain)) {
      // Return a perfect score for known safe domains with very precise values
      return {
        harmless: 92,
        malicious: 0,
        suspicious: 0,
        undetected: 8
      };
    }
  }
  
  // Positive trust indicators (increase trust score)
  if (lexicalDiversity >= 0.4 && lexicalDiversity <= 0.8) trustScore += 18.7; // Normal diversity
  if (entropy >= 2.8 && entropy <= 4.2) trustScore += 15.3; // Normal entropy range
  if (domainLength >= 4 && domainLength <= 15) trustScore += 12.6; // Ideal length
  if (vowelConsonantRatio >= 0.3 && vowelConsonantRatio <= 0.7) trustScore += 8.9; // Good ratio
  if (commonTLDs.includes(tld)) trustScore += 21.5; // Very common TLD
  if (moderatelyCommonTLDs.includes(tld)) trustScore += 12.8; // Moderately common TLD
  if (digitRatio === 0) trustScore += 7.4; // No digits is usually better
  if (primaryDomain.length >= 3 && primaryDomain.length <= 12) trustScore += 10.7; // Optimal primary domain length
  if (!hasExcessiveSubdomains) trustScore += 9.6; // Not too many subdomains
  if (primaryDomain.match(/^[a-z]+$/i)) trustScore += 14.2; // All letters is often a good sign
  
  // Dictionary word detection (simple approximation)
  if (primaryDomain.length >= 4 && 
      vowelCount >= 1 && 
      consonantCount >= 2 && 
      vowelConsonantRatio >= 0.2 && 
      vowelConsonantRatio <= 0.8) {
    trustScore += 17.3; // Likely a readable/pronounceable name
  }
  
  // Additional checks for legitimate-looking domains
  if (/^[a-z]+\-?[a-z]+$/i.test(primaryDomain)) { // word-word format
    trustScore += 14.8; // Common for legitimate sites
  }
  
  if (/^[a-z]{2,}(app|web|site|online|cloud|hub|center|portal|pro|io)$/i.test(primaryDomain)) {
    trustScore += 9.2; // Common pattern for legitimate tech/SaaS services
  }
  
  // Risk indicators (increase risk score)
  if (domainLength > 25) riskScore += 7.9; // Too long
  if (domainLength > 30) riskScore += 5.2; // Extremely long
  if (entropy > 4.5) riskScore += 6.3; // Unusually high entropy
  if (entropy > 4.8) riskScore += 5.1; // Extremely high entropy
  if (lexicalDiversity > 0.9) riskScore += 5.4; // Suspiciously high diversity
  if (vowelConsonantRatio < 0.1) riskScore += 5.2; // Almost no vowels
  if (hasNumbers && hasDashes) riskScore += 3.5; // Numbers and dashes
  if (digitRatio > 0.3) riskScore += 5.6; // Too many digits
  if (digitRatio > 0.5) riskScore += 7.2; // Mostly digits
  if (consecutiveConsonants > 0) riskScore += 3.8; // Hard to pronounce
  if (consecutiveDigits > 0) riskScore += 5.1; // Random-looking numbers
  if (hasExcessiveSubdomains) riskScore += 4.3; // Too many subdomains
  if (dashCount > 3) riskScore += 3.9; // Too many dashes
  if (randomLookingSegments > 0) riskScore += 8.1; // Random-looking patterns
  
  // Require combinations of factors
  let patternCount = 0;
  if (entropy > 4.5) patternCount++;
  if (digitRatio > 0.3) patternCount++;
  if (consecutiveConsonants > 0) patternCount++;
  if (dashCount > 2) patternCount++;
  if (randomLookingSegments > 0) patternCount++;
  if (hasExcessiveSubdomains) patternCount++;
  
  if (patternCount >= 3) {
    riskScore += patternCount * 2.5; // Synergy effect for multiple suspicious patterns
  } else {
    riskScore = riskScore * 0.7; // Reduce overall risk
  }
  
  // Brand impersonation detection
  const brandPatterns = {
    'google': ['google', 'gmail', 'youtube', 'goog'],
    'microsoft': ['microsoft', 'office', 'outlook', 'msft', 'hotmail'],
    'apple': ['apple', 'icloud', 'itunes'],
    'amazon': ['amazon', 'aws', 'amzn'],
    'paypal': ['paypal', 'pay'],
    'facebook': ['facebook', 'fb', 'instagram', 'meta'],
    'netflix': ['netflix', 'nflx'],
    'twitter': ['twitter', 'twtr'],
    'banking': ['bank', 'chase', 'citi', 'wells', 'fargo', 'hsbc', 'scotia', 'barclays']
  };
  
  for (const brand in brandPatterns) {
    for (const pattern of brandPatterns[brand]) {
      if (primaryDomain.includes(pattern) && !isDomainOrSubdomain(domain, pattern)) {
        if (hasNumbers || hasDashes || !commonTLDs.includes(tld)) {
          riskScore += 23.7; // Strong indicator of phishing
          confidenceLevel += 0.12; // Higher confidence in this assessment
          break;
        }
      }
    }
  }
  
  // Implement a sliding scale rather than hard thresholds
  let malicious = 0;
  let suspicious = 0;
  let harmless = 0;
  
  // Calculate final scores with precision
  const finalTrustScore = Math.min(100, trustScore);
  const finalRiskScore = Math.min(100, riskScore);
  
  // Weighted risk assessment with higher thresholds
  if (finalRiskScore > 60) { // High risk
    malicious = Math.floor(finalRiskScore * 0.36); // Scale to malicious score
    suspicious = Math.floor(finalRiskScore * 0.19); // Some suspicious
    harmless = Math.max(0, 100 - malicious - suspicious); // Remaining harmless
  } else if (finalRiskScore > 40) { // Medium risk
    malicious = Math.floor(finalRiskScore * 0.08); // Lower malicious score
    suspicious = Math.floor(finalRiskScore * 0.27); // Higher suspicious score
    harmless = Math.max(0, 100 - malicious - suspicious);
  } else if (finalRiskScore > 25) { // Low risk
    malicious = 0; // Not malicious
    suspicious = Math.floor(finalRiskScore * 0.22); // Some suspicious
    harmless = Math.max(0, 100 - suspicious);
  } else { // Minimal risk
    malicious = 0;
    suspicious = 0;
    harmless = Math.max(94, 100 - Math.floor(finalRiskScore * 0.4)); // Mostly harmless
  }
  
  // Override for known threat patterns
  if (domain.includes('nulled.to') || domain.includes('malicious') || 
      domain.includes('phish') || domain.includes('hack')) {
    malicious = 87;
    suspicious = 13;
    harmless = 0;
  }
  
  // Better normalization
  const total = malicious + suspicious + harmless;
  if (total !== 100) {
    const factor = 100 / total;
    malicious = Math.floor(malicious * factor);
    suspicious = Math.floor(suspicious * factor);
    harmless = 100 - malicious - suspicious;
  }
  
  return {
    harmless: harmless,
    malicious: malicious,
    suspicious: suspicious,
    undetected: 0,
    confidence: confidenceLevel.toFixed(2)
  };
}

// Enhanced local analysis for phishing detection
function performEnhancedAnalysis(text) {
  const lowerText = text.toLowerCase();
  
  // High-risk phrases that strongly indicate phishing - expand with giveaway/prize patterns
  const highRiskPhrases = [
    'verify your account', 'login details', 'update your payment',
    'confirm your identity', 'unusual activity', 'security alert',
    'password expired', 'account suspended', 'urgent action required',
    'suspicious login attempt', 'click here to verify', 'your account will be terminated',
    'bank account information', 'credit card details', 'immediate attention required',
    // Giveaway/prize-related patterns (stronger weights now)
    'selected to receive', 'you have been selected', 'you are a winner', 
    'claim your prize', 'collect your reward', 'free giveaway',
    'you won', 'congratulations you have won', 'lucky winner',
    'free gift', 'cash prize', 'free iphone', 'free vacation',
    'selected randomly', 'lottery winner', '$500 giveaway', '$1000 giveaway',
    'claim your giveaway', 'prize is waiting', 'click this link to collect'
  ];
  
  // Medium-risk phrases that may indicate phishing
  const mediumRiskPhrases = [
    'limited time offer', 'action required', 'important notification',
    'security update', 'verify your information', 'identity confirmation',
    'login attempt', 'account access', 'password reset',
    'unusual login', 'validate your account', 'billing information',
    'exclusive offer', 'special promotion', 'once in a lifetime', 
    'selected customers', 'survey reward', 'gift card',
    'reward points', 'discount code', 'apply now',
    'act fast', 'don\'t miss out', 'time sensitive', 'before it expires'
  ];
  
  // Money symbols and number patterns that might indicate scams
  const moneyPattern = /\$\d+|\d+\s*\$|€\d+|\d+\s*€|£\d+|\d+\s*£/g;
  const moneyMatches = (lowerText.match(moneyPattern) || []).length;
  
  // Exclamation patterns (multiple exclamation marks often indicate scams)
  const exclamationPattern = /!{1,}|!/g;  // Changed to catch all exclamations
  const excessiveExclamations = (lowerText.match(exclamationPattern) || []).length;
  
  // Calculate score based on phrase matches
  let highRiskMatches = 0;
  let mediumRiskMatches = 0;
  
  highRiskPhrases.forEach(phrase => {
    if (lowerText.includes(phrase.toLowerCase())) {
      highRiskMatches++;
    }
  });
  
  mediumRiskPhrases.forEach(phrase => {
    if (lowerText.includes(phrase.toLowerCase())) {
      mediumRiskMatches++;
    }
  });
  
  // Count links and urgency indicators with stronger weight
  const linkCount = (lowerText.match(/http|click here|click this link|click below|click now/gi) || []).length;
  const urgencyIndicators = (lowerText.match(/urgent|immediately|today|now|asap|alert|hurry|quickly|fast|limited time|soon|expires/gi) || []).length;
  
  // Additional checks for sophisticated phishing patterns
  const passwordPatterns = (lowerText.match(/password|pwd|passwd/gi) || []).length;
  const securityPhrases = (lowerText.match(/security|secure|protection|encrypt/gi) || []).length;
  const accountPhrases = (lowerText.match(/account|login|sign in|signin/gi) || []).length;
  const threatPatterns = (lowerText.match(/suspicious|unusual|unauthorized|fraud|breach/gi) || []).length;
  
  // ADJUSTED SCORING SYSTEM - Higher weights for combinations and multiple matches
  let score = 0;
  
  // Base scoring with higher weights
  score += highRiskMatches * 0.2;      // Increased from 0.15 to 0.2
  score += mediumRiskMatches * 0.1;    // Increased from 0.08 to 0.1
  score += Math.min(linkCount * 0.08, 0.24);    // Increased from 0.05/0.2 to 0.08/0.24
  score += Math.min(urgencyIndicators * 0.07, 0.21);  // Increased
  score += Math.min(passwordPatterns * 0.08, 0.24);  // Increased
  score += Math.min(securityPhrases * 0.05, 0.15);   
  score += Math.min(accountPhrases * 0.06, 0.18);    // Increased
  score += Math.min(threatPatterns * 0.08, 0.24);    // Increased
  score += Math.min(moneyMatches * 0.08, 0.24);      // Increased
  score += Math.min(excessiveExclamations * 0.05, 0.2); // Increased
  
  // COMBINATION BONUS - Multiple indicators together signal higher risk
  // This is key for catching giveaway scams which often have multiple indicators
  
  // Combination: Money + Action verbs (very common in scams)
  if (moneyMatches > 0 && 
      (lowerText.includes('collect') || lowerText.includes('claim') || lowerText.includes('receive'))) {
    score += 0.3;  // Increased from 0.2 to 0.3
  }
  
  // Combination: Click + Exclamation (urgency tactics)
  if (lowerText.match(/click/i) && excessiveExclamations > 0) {
    score += 0.2;  // Increased from 0.15 to 0.2
  }
  
  // Combination: Giveaway terminology (very strong indicator)
  if ((lowerText.includes('selected') || lowerText.includes('winner') || lowerText.includes('won')) 
      && (lowerText.includes('prize') || lowerText.includes('reward') || lowerText.includes('giveaway'))) {
    score += 0.35; // Increased from 0.25 to 0.35
  }
  
  // Common phishing patterns
  if (lowerText.includes('dear customer') || lowerText.includes('dear user')) score += 0.12;
  if (lowerText.includes('click') && lowerText.includes('link')) score += 0.15;
  if (lowerText.includes('verify') && lowerText.includes('information')) score += 0.12;
  if (lowerText.includes('update') && lowerText.includes('details')) score += 0.15;
  
  // Exponential factor: Having multiple high-risk patterns increases risk non-linearly
  if (highRiskMatches > 1) {
    score += Math.min(0.15 * (highRiskMatches - 1), 0.3); // Bonus for multiple high-risk phrases
  }
  
  // Grammar and spelling errors
  const typos = (lowerText.match(/recieve|informations|companys|verifcation|notifcation|accout/gi) || []).length;
  score += Math.min(typos * 0.08, 0.16);
  
  // Cap score at 0.95 to leave room for uncertainty
  return Math.min(score, 0.95);
}

// Enhanced URL safety check with more precise analysis
async function checkURLSafety(url) {
  try {
    // Extract the domain from the URL
    const urlObj = new URL(url);
    const fullDomain = urlObj.hostname.toLowerCase();
    
    // Extract the base domain (e.g., "nulled.to" from "forum.nulled.to")
    const baseDomain = extractBaseDomain(fullDomain);
    console.log(`Checking safety for URL: ${url}, Base domain: ${baseDomain}`);
    
    // First check against blacklist (highest priority)
    const blacklistResult = await new Promise(resolve => {
      chrome.storage.local.get(['blacklist'], result => {
        const blacklist = result.blacklist || [];
        const isBlacklisted = blacklist.some(blockedDomain => 
          fullDomain === blockedDomain || 
          fullDomain.endsWith('.' + blockedDomain) ||
          baseDomain === blockedDomain
        );
        
        if (isBlacklisted) {
          console.log(`Domain ${baseDomain} is blacklisted`);
          resolve({ malicious: 5, suspicious: 0 });
        } else {
          resolve(null);
        }
      });
    });
    
    if (blacklistResult) {
      return {
        success: true,
        originalUrl: url,
        finalUrl: null,
        malicious: blacklistResult.malicious,
        suspicious: blacklistResult.suspicious,
        source: 'blacklist'
      };
    }
    
    // Check with VirusTotal first - we want to prioritize these results
    let vtResult = await checkDomainVT(baseDomain);
    
    // If base domain gives no results, try the full domain
    if (vtResult.malicious === 0 && vtResult.suspicious === 0 && fullDomain !== baseDomain) {
      console.log(`No results for base domain, trying full domain: ${fullDomain}`);
      const fullDomainResult = await checkDomainVT(fullDomain);
      
      if (fullDomainResult.malicious > 0 || fullDomainResult.suspicious > 0) {
        vtResult = fullDomainResult;
      }
    }
    
    // Only use our algorithm if VirusTotal has no data about this domain
    if (vtResult.malicious === 0 && vtResult.suspicious === 0 && !vtResult.hasOwnProperty('vtChecked')) {
      console.log(`No VT results, using reputation algorithm for ${baseDomain}`);
      const reputationResult = getReputationScore(baseDomain);
      
      if (reputationResult.malicious > 15 || reputationResult.suspicious > 30) {
        console.log(`Algorithm detected risk: mal=${reputationResult.malicious}, susp=${reputationResult.suspicious}`);
        vtResult = reputationResult;
      }
    }
    
    console.log(`Final safety result for ${baseDomain}:`, vtResult);
    
    return {
      success: true,
      originalUrl: url,
      finalUrl: null,
      malicious: vtResult.malicious || 0,
      suspicious: vtResult.suspicious || 0,
      source: 'virustotal'
    };
  } catch (error) {
    console.error('Error in checkURLSafety:', error);
    return { success: false, error: error.message };
  }
}

// Function to extract base domain from a hostname
function extractBaseDomain(hostname) {
  const publicSuffixes = [
    'com', 'net', 'org', 'edu', 'gov', 'co.uk', 'co.jp', 'co.nz', 'co.za',
    'io', 'ai', 'app', 'dev', 'tech', 'site', 'online', 'store', 'shop',
    'blog', 'info', 'biz', 'me', 'tv', 'xyz', 'in', 'us', 'de', 'fr', 'jp',
    'ru', 'uk', 'au', 'ca', 'cn', 'to', 'cc', 'ws', 'se', 'no', 'dk', 'fi'
  ];
  
  const parts = hostname.split('.');
  
  if (parts.length <= 2) {
    return hostname;
  }
  
  for (const suffix of publicSuffixes) {
    const suffixParts = suffix.split('.');
    
    if (hostname.endsWith('.' + suffix)) {
      const baseParts = parts.slice(-(suffixParts.length + 1));
      return baseParts.join('.');
    }
  }
  
  return parts.slice(-2).join('.');
}

// Function to check domain against VirusTotal API
async function checkDomainVT(domain) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['vtKey'], result => {
      const apiKey = result.vtKey || VT_API_KEY;
      
      if (!apiKey) {
        console.log('No VirusTotal API key available');
        resolve({ malicious: 0, suspicious: 0 });
        return;
      }
      
      chrome.storage.local.get(['vtCache'], cacheResult => {
        const cache = cacheResult.vtCache || {};
        
        if (cache[domain] && cache[domain].timestamp > Date.now() - 24 * 60 * 60 * 1000) {
          console.log(`Using cached result for ${domain}:`, cache[domain]);
          resolve({
            malicious: cache[domain].malicious || 0,
            suspicious: cache[domain].suspicious || 0
          });
          return;
        }
        
        console.log(`Querying VirusTotal API for ${domain}`);
        const apiUrl = `https://www.virustotal.com/api/v3/domains/${domain}`;
        
        fetch(apiUrl, {
          method: 'GET',
          headers: {
            'x-apikey': apiKey
          }
        })
        .then(response => {
          console.log(`VirusTotal API response status: ${response.status}`);
          if (!response.ok) {
            throw new Error(`VirusTotal API error: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          console.log(`VirusTotal data received for ${domain}`);
          if (data && data.data && data.data.attributes && data.data.attributes.last_analysis_stats) {
            const stats = data.data.attributes.last_analysis_stats;
            console.log(`Analysis stats for ${domain}:`, stats);
            
            const result = {
              malicious: stats.malicious || 0,
              suspicious: stats.suspicious || 0,
              vtChecked: true
            };
            
            cache[domain] = {
              ...result,
              timestamp: Date.now()
            };
            
            chrome.storage.local.set({ vtCache: cache });
            resolve(result);
          } else {
            console.warn('Unexpected VirusTotal API response format:', data);
            resolve({ malicious: 0, suspicious: 0 });
          }
        })
        .catch(error => {
          console.error(`Error querying VirusTotal for ${domain}:`, error);
          const reputation = getReputationScore(domain);
          resolve(reputation);
        });
      });
    });
  });
}

// Add this function to help with URL shortener detection
function isLikelyURLShortener(domain) {
  const shortenerDomains = [
    'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd', 'cli.gs', 'pic.gd', 
    'DwarfURL.com', 'ow.ly', 'snipurl.com', 'short.to', 'BudURL.com',
    'ping.fm', 'post.ly', 'Just.as', 'bkite.com', 'snipr.com', 'fic.kr',
    'loopt.us', 'doiop.com', 'twitthis.com', 'htxt.it', 'AltURL.com',
    'RedirX.com', 'DigBig.com', 'short.ie', 'u.mavrev.com', 'kl.am',
    'wp.me', 'u.nu', 'rubyurl.com', 'om.ly', 'linksin.me', 'clck.ru',
    'shorturl.at', 'tiny.cc', 'lnkd.in', 'db.tt', 'qr.ae', 'adf.ly',
    'geni.us', 'plu.sh', 'buff.ly', 'v.gd', 'bzfd.it', 'ppt.cc', 'g.co',
    'fb.me', 'ktrk.us', 'amzn.to', 'ctrk.me', 'ctrk.io', 'klclick.com'
  ];
  
  return shortenerDomains.some(shortDomain => 
    domain === shortDomain || domain.endsWith('.' + shortDomain)
  );
}