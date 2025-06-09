<?php
// Rate limiting class for API protection
class RateLimiter {
    private $redisClient = null;
    private $useFileCache = false;
    private $cachePath = null;
    private $limits = [];
    
    /**
     * Constructor
     * 
     * @param array $config Configuration with SECURITY.RATE_LIMIT
     * @param bool $useRedis Use Redis if available
     */
    public function __construct($config, $useRedis = true) {
        // Set default limits
        $this->limits = [
            'default' => [
                'requests' => $config['SECURITY']['RATE_LIMIT'] ?? 100,
                'window' => 60, // 1 minute window
            ],
            'bulk' => [
                'requests' => 10,
                'window' => 60, // 1 minute window
            ],
            'whitelist' => [
                'requests' => 50,
                'window' => 60, // 1 minute window
            ]
        ];
        
        // Try to use Redis if available and requested
        if ($useRedis && extension_loaded('redis')) {
            try {
                $this->redisClient = new Redis();
                $this->redisClient->connect(
                    $config['REDIS']['HOST'] ?? '127.0.0.1', 
                    $config['REDIS']['PORT'] ?? 6379
                );
                
                if (!empty($config['REDIS']['AUTH'])) {
                    $this->redisClient->auth($config['REDIS']['AUTH']);
                }
                
                // Test connection
                $this->redisClient->ping();
            } catch (Exception $e) {
                error_log("Redis error: " . $e->getMessage());
                $this->redisClient = null;
            }
        }
        
        // Fallback to file-based caching
        if (!$this->redisClient) {
            $this->useFileCache = true;
            $this->cachePath = __DIR__ . '/cache';
            
            // Create cache directory if it doesn't exist
            if (!file_exists($this->cachePath)) {
                mkdir($this->cachePath, 0755, true);
            }
        }
    }
    
    /**
     * Check if request is allowed under rate limit
     * 
     * @param string $clientId Typically IP address
     * @param string $route API route (default, bulk, whitelist)
     * @return bool True if allowed, false if rate limited
     */
    public function isAllowed($clientId, $route = 'default') {
        // No rate limiting if disabled
        if (empty($this->limits[$route])) {
            $route = 'default';
        }
        
        $limit = $this->limits[$route]['requests'];
        $window = $this->limits[$route]['window'];
        
        // Get current count
        $key = "ratelimit:{$clientId}:{$route}";
        $count = $this->getCount($key);
        
        if ($count >= $limit) {
            return false;
        }
        
        // Increment count
        $this->incrementCount($key, $window);
        return true;
    }
    
    /**
     * Get remaining requests allowed for client
     * 
     * @param string $clientId Typically IP address
     * @param string $route API route
     * @return int Remaining requests allowed
     */
    public function getRemainingRequests($clientId, $route = 'default') {
        if (empty($this->limits[$route])) {
            $route = 'default';
        }
        
        $limit = $this->limits[$route]['requests'];
        $key = "ratelimit:{$clientId}:{$route}";
        $count = $this->getCount($key);
        
        return max(0, $limit - $count);
    }
    
    /**
     * Get current count for key
     * 
     * @param string $key Rate limit key
     * @return int Current count
     */
    private function getCount($key) {
        if ($this->redisClient) {
            return (int) $this->redisClient->get($key) ?: 0;
        } else {
            return $this->getFileCount($key);
        }
    }
    
    /**
     * Increment count for key
     * 
     * @param string $key Rate limit key
     * @param int $window Time window in seconds
     */
    private function incrementCount($key, $window) {
        if ($this->redisClient) {
            $this->redisClient->incr($key);
            $this->redisClient->expire($key, $window);
        } else {
            $this->incrementFileCount($key, $window);
        }
    }
    
    /**
     * Get count from file cache
     * 
     * @param string $key Rate limit key
     * @return int Current count
     */
    private function getFileCount($key) {
        $file = $this->cachePath . '/' . md5($key) . '.count';
        
        if (!file_exists($file)) {
            return 0;
        }
        
        // Read file contents
        $data = @file_get_contents($file);
        if ($data === false) {
            return 0;
        }
        
        $parts = explode('|', $data);
        if (count($parts) !== 2) {
            return 0;
        }
        
        list($expiry, $count) = $parts;
        
        // Check if expired
        if ((int) $expiry < time()) {
            @unlink($file);
            return 0;
        }
        
        return (int) $count;
    }
    
    /**
     * Increment count in file cache
     * 
     * @param string $key Rate limit key
     * @param int $window Time window in seconds
     */
    private function incrementFileCount($key, $window) {
        $file = $this->cachePath . '/' . md5($key) . '.count';
        $count = $this->getFileCount($key) + 1;
        $expiry = time() + $window;
        
        // Write to file
        @file_put_contents($file, $expiry . '|' . $count, LOCK_EX);
    }
}
