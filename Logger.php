<?php
// Advanced logging system with rotation and different log levels
class Logger {
    // Log levels
    const ERROR = 0;
    const WARNING = 1;
    const INFO = 2;
    const DEBUG = 3;
    
    private static $instance = null;
    private $config = [];
    private $logFile = null;
    private $logLevel = self::ERROR;
    
    /**
     * Constructor
     * 
     * @param array $config Configuration with logging settings
     */
    private function __construct($config) {
        $this->config = $config;
        
        // Set log level based on config
        $this->setLogLevel($config['LOGGING']['LEVEL'] ?? 'ERROR');
        
        // Set log file
        $this->logFile = $config['LOGGING']['FILE'] ?? __DIR__ . '/logs/app.log';
        
        // Create directory if it doesn't exist
        $dir = dirname($this->logFile);
        if (!file_exists($dir)) {
            mkdir($dir, 0755, true);
        }
        
        // Rotate log if needed
        $this->rotateLogIfNeeded();
    }
    
    /**
     * Get singleton instance
     * 
     * @param array $config Configuration array
     * @return Logger Instance
     */
    public static function getInstance($config = null) {
        if (self::$instance === null) {
            if ($config === null) {
                throw new Exception("Configuration required for logger initialization");
            }
            self::$instance = new self($config);
        }
        return self::$instance;
    }
    
    /**
     * Convert log level string to constant
     * 
     * @param string $level Log level name
     */
    private function setLogLevel($level) {
        switch (strtoupper($level)) {
            case 'DEBUG':
                $this->logLevel = self::DEBUG;
                break;
            case 'INFO':
                $this->logLevel = self::INFO;
                break;
            case 'WARNING':
                $this->logLevel = self::WARNING;
                break;
            case 'ERROR':
            default:
                $this->logLevel = self::ERROR;
                break;
        }
    }
    
    /**
     * Log a message at ERROR level
     * 
     * @param string $message Message to log
     * @param array $context Additional context
     */
    public function error($message, array $context = []) {
        $this->log(self::ERROR, $message, $context);
    }
    
    /**
     * Log a message at WARNING level
     * 
     * @param string $message Message to log
     * @param array $context Additional context
     */
    public function warning($message, array $context = []) {
        $this->log(self::WARNING, $message, $context);
    }
    
    /**
     * Log a message at INFO level
     * 
     * @param string $message Message to log
     * @param array $context Additional context
     */
    public function info($message, array $context = []) {
        $this->log(self::INFO, $message, $context);
    }
    
    /**
     * Log a message at DEBUG level
     * 
     * @param string $message Message to log
     * @param array $context Additional context
     */
    public function debug($message, array $context = []) {
        $this->log(self::DEBUG, $message, $context);
    }
    
    /**
     * Log a message with level
     * 
     * @param int $level Log level
     * @param string $message Message to log
     * @param array $context Additional context
     */
    public function log($level, $message, array $context = []) {
        // Skip if logging disabled or level too low
        if (!$this->config['LOGGING']['ENABLED'] || $level > $this->logLevel) {
            return;
        }
        
        // Get level name for the log
        $levelName = $this->getLevelName($level);
        
        // Format message
        $formatted = sprintf(
            "[%s] [%s] %s %s\n",
            date('Y-m-d H:i:s'),
            $levelName,
            $message,
            !empty($context) ? json_encode($context) : ''
        );
        
        // Write to file with locking
        file_put_contents($this->logFile, $formatted, FILE_APPEND | LOCK_EX);
        
        // Rotate if needed after write
        $this->rotateLogIfNeeded();
    }
    
    /**
     * Get name for log level
     * 
     * @param int $level Log level constant
     * @return string Level name
     */
    private function getLevelName($level) {
        switch ($level) {
            case self::DEBUG:
                return 'DEBUG';
            case self::INFO:
                return 'INFO';
            case self::WARNING:
                return 'WARNING';
            case self::ERROR:
                return 'ERROR';
            default:
                return 'UNKNOWN';
        }
    }
    
    /**
     * Rotate log if it's too large
     */
    private function rotateLogIfNeeded() {
        if (!file_exists($this->logFile)) {
            return;
        }
        
        $maxSize = $this->config['LOGGING']['ROTATE_SIZE'] ?? 10485760; // 10MB default
        
        if (filesize($this->logFile) >= $maxSize) {
            $newName = $this->logFile . '.' . date('Y-m-d-H-i-s') . '.bak';
            rename($this->logFile, $newName);
            
            // Clean up old log files (keep only last 5)
            $this->cleanupOldLogs();
        }
    }
    
    /**
     * Clean up old log files
     */
    private function cleanupOldLogs() {
        $dir = dirname($this->logFile);
        $baseFile = basename($this->logFile);
        
        // Get all backup log files
        $files = glob($dir . '/' . $baseFile . '.*.bak');
        
        // Sort by name (which includes timestamp)
        usort($files, function($a, $b) {
            return strcmp($b, $a); // Reverse order to get newest first
        });
        
        // Keep only the 5 most recent files
        for ($i = 5; $i < count($files); $i++) {
            @unlink($files[$i]);
        }
    }
}
