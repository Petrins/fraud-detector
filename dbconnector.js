// Database connection utility for fraud detection extension
class FraudDatabase {
  constructor(serverUrl = 'http://localhost/fraud_detector') {
    this.apiUrl = serverUrl;
    this.initPromise = this.testConnection();
    // Add request timeout and retry limits for reliability
    this.requestTimeout = 10000; // 10 seconds
    this.maxRetries = 3;
  }

  // Validate domain input to prevent injection attacks
  validateDomain(domain) {
    if (!domain || typeof domain !== 'string') {
      return false;
    }
    
    // Simple domain validation regex
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    return domainRegex.test(domain);
  }

  // Enhanced fetch with timeout, retries and error handling
  async fetchWithTimeout(url, options = {}, retries = 0) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Handle retry logic
      if (error.name === 'AbortError' && retries < this.maxRetries) {
        console.log(`Request timeout, retrying (${retries + 1}/${this.maxRetries})...`);
        return this.fetchWithTimeout(url, options, retries + 1);
      }
      
      throw error;
    }
  }

  // Test the connection to the database server
  async testConnection() {
    try {
      const response = await fetch(`${this.apiUrl}/dbconnect.php?request=whitelist`, {
        method: 'GET'
      });
      
      if (!response.ok) {
        throw new Error('Database connection failed');
      }
      
      console.log('Database connection successful');
      return true;
    } catch (error) {
      console.error('Database connection error:', error);
      return false;
    }
  }

  // Get domain reputation from database
  async getDomainReputation(domain) {
    // Validate input
    if (!this.validateDomain(domain)) {
      console.error(`Invalid domain format: ${domain}`);
      return { domain, cached: false, error: 'Invalid domain format' };
    }
    
    try {
      const response = await this.fetchWithTimeout(`${this.apiUrl}/dbconnect.php?request=reputation/${encodeURIComponent(domain)}`, {
        method: 'GET'
      });
      
      if (!response.ok) {
        throw new Error('Failed to get domain reputation');
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error getting reputation for ${domain}:`, error);
      return { domain, cached: false };
    }
  }

  // Save domain reputation to database with improved input validation
  async saveDomainReputation(data) {
    // Validate domain
    if (!this.validateDomain(data.domain)) {
      console.error(`Invalid domain format: ${data.domain}`);
      return { success: false, error: 'Invalid domain format' };
    }
    
    // Validate numeric fields
    const numericFields = ['harmless', 'malicious', 'suspicious', 'undetected'];
    for (const field of numericFields) {
      if (data[field] !== undefined && (isNaN(data[field]) || data[field] < 0)) {
        console.error(`Invalid ${field} value: ${data[field]}`);
        return { success: false, error: `Invalid ${field} value` };
      }
    }
    
    // Validate confidence (should be between 0 and 1)
    if (data.confidence !== undefined && (isNaN(data.confidence) || data.confidence < 0 || data.confidence > 1)) {
      console.error(`Invalid confidence value: ${data.confidence}`);
      return { success: false, error: 'Invalid confidence value' };
    }
    
    try {
      const response = await this.fetchWithTimeout(`${this.apiUrl}/dbconnect.php?request=reputation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error('Failed to save domain reputation');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error saving domain reputation:', error);
      return { success: false, error: error.message };
    }
  }

  // Get whitelist domains
  async getWhitelist() {
    try {
      const response = await fetch(`${this.apiUrl}/dbconnect.php?request=whitelist`, {
        method: 'GET'
      });
      
      if (!response.ok) {
        throw new Error('Failed to get whitelist');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting whitelist:', error);
      return [];
    }
  }

  // Add domain to whitelist
  async addToWhitelist(domain, notes = '') {
    try {
      const response = await fetch(`${this.apiUrl}/dbconnect.php?request=whitelist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ domain, notes })
      });
      
      if (!response.ok) {
        throw new Error('Failed to add to whitelist');
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error adding ${domain} to whitelist:`, error);
      return { success: false, error: error.message };
    }
  }

  // Remove domain from whitelist
  async removeFromWhitelist(domain) {
    try {
      const response = await fetch(`${this.apiUrl}/dbconnect.php?request=whitelist/${domain}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to remove from whitelist');
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error removing ${domain} from whitelist:`, error);
      return { success: false, error: error.message };
    }
  }

  // Get blacklist domains
  async getBlacklist() {
    try {
      const response = await fetch(`${this.apiUrl}/dbconnect.php?request=blacklist`, {
        method: 'GET'
      });
      
      if (!response.ok) {
        throw new Error('Failed to get blacklist');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting blacklist:', error);
      return [];
    }
  }

  // Add domain to blacklist
  async addToBlacklist(domain, reason = '') {
    try {
      const response = await fetch(`${this.apiUrl}/dbconnect.php?request=blacklist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ domain, reason })
      });
      
      if (!response.ok) {
        throw new Error('Failed to add to blacklist');
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error adding ${domain} to blacklist:`, error);
      return { success: false, error: error.message };
    }
  }

  // Remove domain from blacklist
  async removeFromBlacklist(domain) {
    try {
      const response = await fetch(`${this.apiUrl}/dbconnect.php?request=blacklist/${domain}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to remove from blacklist');
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error removing ${domain} from blacklist:`, error);
      return { success: false, error: error.message };
    }
  }

  // Update detection statistics
  async updateStats(data) {
    try {
      const response = await fetch(`${this.apiUrl}/dbconnect.php?request=stats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error('Failed to update stats');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error updating stats:', error);
      return { success: false, error: error.message };
    }
  }
  // Bulk import domain reputations with chunking for performance
  async bulkImportReputations(domains) {
    try {
      // Check if we need to chunk the data
      const CHUNK_SIZE = 50; // Process in batches of 50 domains
      
      if (domains.length <= CHUNK_SIZE) {
        // Small enough batch - process directly
        const response = await this.fetchWithTimeout(`${this.apiUrl}/dbconnect.php?request=bulk/reputation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ domains })
        });
        
        if (!response.ok) {
          throw new Error('Failed to import bulk data');
        }
        
        return await response.json();
      } else {
        // Large dataset - process in chunks to avoid timeouts
        const chunks = [];
        let processed = 0;
        let failed = 0;
        
        // Split domains into chunks
        for (let i = 0; i < domains.length; i += CHUNK_SIZE) {
          chunks.push(domains.slice(i, i + CHUNK_SIZE));
        }
        
        console.log(`Processing ${domains.length} domains in ${chunks.length} chunks`);
        
        // Process chunks sequentially to avoid overwhelming the server
        for (let i = 0; i < chunks.length; i++) {
          try {
            const chunk = chunks[i];
            const response = await this.fetchWithTimeout(`${this.apiUrl}/dbconnect.php?request=bulk/reputation`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ domains: chunk })
            });
            
            if (response.ok) {
              const result = await response.json();
              processed += result.count || chunk.length;
            } else {
              failed += chunk.length;
            }
            
            // Add a small delay between chunks to prevent server overload
            if (i < chunks.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          } catch (chunkError) {
            console.error(`Error processing chunk ${i+1}/${chunks.length}:`, chunkError);
            failed += chunks[i].length;
          }
        }
        
        return {
          success: failed === 0,
          total: domains.length,
          processed: processed,
          failed: failed
        };
      }
    } catch (error) {
      console.error('Error bulk importing domains:', error);
      return { success: false, error: error.message };
    }
  }
  // Export browser cache to SQL format with enhanced error handling
  async exportCacheToSQL() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['vtCache'], result => {
        const cache = result.vtCache || {};
        const domains = [];
        const now = Date.now();
        let invalidDomains = 0;
        
        // Process cache data with validation
        for (const domain in cache) {
          if (cache[domain]) {
            // Validate domain format before adding to export list
            if (this.validateDomain(domain)) {
              domains.push({
                domain: domain,
                harmless: parseInt(cache[domain].harmless || 0),
                malicious: parseInt(cache[domain].malicious || 0),
                suspicious: parseInt(cache[domain].suspicious || 0),
                undetected: parseInt(cache[domain].undetected || 0),
                confidence: parseFloat(cache[domain].confidence || 0.6),
                entropy: parseFloat(cache[domain].entropy || 0),
                lexical_diversity: parseFloat(cache[domain].lexical_diversity || 0),
                is_branded: parseInt(cache[domain].is_branded || 0),
                last_checked: Math.floor(now / 1000)
              });
            } else {
              console.warn(`Skipping invalid domain in cache: ${domain}`);
              invalidDomains++;
            }
          }
        }
        
        // Show notification if there were invalid domains
        if (invalidDomains > 0) {
          console.warn(`Skipped ${invalidDomains} invalid domains during export`);
        }
        
        // Export valid domains with retry mechanism
        if (domains.length > 0) {
          // Setup retry mechanism
          const maxRetries = 3;
          let currentRetry = 0;
          
          const attemptExport = () => {
            this.bulkImportReputations(domains)
              .then(result => {
                console.log(`Exported ${domains.length} domains to SQL database`);
                // Store export timestamp for tracking
                chrome.storage.local.set({ 
                  lastExport: { 
                    timestamp: Date.now(),
                    count: domains.length
                  }
                });
                resolve(result);
              })
              .catch(error => {
                currentRetry++;
                console.error(`Export attempt ${currentRetry} failed:`, error);
                
                if (currentRetry < maxRetries) {
                  // Wait with exponential backoff before retrying
                  const backoffTime = Math.pow(2, currentRetry) * 1000;
                  console.log(`Retrying in ${backoffTime/1000} seconds...`);
                  setTimeout(attemptExport, backoffTime);
                } else {
                  console.error(`Export failed after ${maxRetries} attempts`);
                  resolve({ 
                    success: false, 
                    error: error.message,
                    domains_attempted: domains.length
                  });
                }
              });
          };
          
          // Start export process
          attemptExport();
        } else {
          // Nothing to export
          resolve({ success: true, count: 0 });
        }
      });
    });
  }
}

// Export the database connector
window.fraudDatabase = new FraudDatabase();
