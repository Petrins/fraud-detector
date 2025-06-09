<?php
// Connection pooling class for improved database performance
class DbConnectionPool {
    private static $instance = null;
    private $connections = [];
    private $inUseConnections = [];
    private $config;
    private $connectionCount = 0;
    
    // Private constructor for singleton pattern
    private function __construct($config) {
        $this->config = $config;
        
        // Initialize minimum connections
        $minConnections = $this->config['DB_POOL']['MIN_CONNECTIONS'];
        for ($i = 0; $i < $minConnections; $i++) {
            $this->addConnection();
        }
        
        // Register shutdown function to clean up connections
        register_shutdown_function([$this, 'close']);
    }
    
    // Get the singleton instance
    public static function getInstance($config = null) {
        if (self::$instance === null) {
            if ($config === null) {
                throw new Exception("Configuration required for pool initialization");
            }
            self::$instance = new self($config);
        }
        return self::$instance;
    }
    
    // Create a new database connection
    private function createConnection() {
        try {
            $dsn = "mysql:host=" . $this->config['DB_HOST'] . 
                  ";dbname=" . $this->config['DB_NAME'] . 
                  ";port=" . $this->config['DB_PORT'] . 
                  ";charset=" . $this->config['DB_CHARSET'];
            
            $pdo = new PDO($dsn, 
                $this->config['DB_USER'], 
                $this->config['DB_PASS'], 
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_EMULATE_PREPARES => false,
                    PDO::ATTR_PERSISTENT => false,
                    PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES " . $this->config['DB_CHARSET'] . " COLLATE " . $this->config['DB_CHARSET'] . "_unicode_ci"
                ]
            );
            
            $this->connectionCount++;
            return $pdo;
        } catch (PDOException $e) {
            error_log("Connection pool error: " . $e->getMessage());
            throw $e;
        }
    }
    
    // Add a new connection to the pool
    private function addConnection() {
        $maxConnections = $this->config['DB_POOL']['MAX_CONNECTIONS'];
        
        if ($this->connectionCount < $maxConnections) {
            $connection = $this->createConnection();
            $connectionId = uniqid('conn_');
            $this->connections[$connectionId] = [
                'connection' => $connection,
                'created' => time(),
                'last_used' => time()
            ];
            return $connectionId;
        }
        
        return false;
    }
    
    // Get a connection from the pool
    public function getConnection() {
        // First try to reuse an existing idle connection
        if (!empty($this->connections)) {
            $connectionId = array_key_first($this->connections);
            $connection = $this->connections[$connectionId]['connection'];
            $this->connections[$connectionId]['last_used'] = time();
            
            // Move to in-use connections
            $this->inUseConnections[$connectionId] = $this->connections[$connectionId];
            unset($this->connections[$connectionId]);
            
            // Verify connection is still alive
            try {
                $connection->query("SELECT 1");
                return $connection;
            } catch (PDOException $e) {
                // Connection lost, remove and try again
                unset($this->inUseConnections[$connectionId]);
                $this->connectionCount--;
                return $this->getConnection();
            }
        }
        
        // No idle connections, try to create a new one
        $connectionId = $this->addConnection();
        
        if ($connectionId !== false) {
            $connection = $this->connections[$connectionId]['connection'];
            $this->inUseConnections[$connectionId] = $this->connections[$connectionId];
            unset($this->connections[$connectionId]);
            return $connection;
        }
        
        // No more connections available, wait for one to become available
        $timeout = time() + $this->config['DB_POOL']['CONNECTION_TIMEOUT'];
        while (time() < $timeout) {
            usleep(100000); // 100ms
            
            // Try again
            if (!empty($this->connections)) {
                return $this->getConnection();
            }
        }
        
        throw new Exception("Connection pool exhausted. No connections available after waiting timeout.");
    }
    
    // Release a connection back to the pool
    public function releaseConnection($connection) {
        foreach ($this->inUseConnections as $id => $conn) {
            if ($conn['connection'] === $connection) {
                // Move back to available connections
                $this->connections[$id] = $conn;
                $this->connections[$id]['last_used'] = time();
                unset($this->inUseConnections[$id]);
                return true;
            }
        }
        
        return false;
    }
    
    // Clean up old connections that have been idle too long
    public function maintenance() {
        $now = time();
        $idleTimeout = $this->config['DB_POOL']['IDLE_TIMEOUT'];
        
        foreach ($this->connections as $id => $conn) {
            if (($now - $conn['last_used']) > $idleTimeout && count($this->connections) > $this->config['DB_POOL']['MIN_CONNECTIONS']) {
                // Close idle connection if we have more than minimum
                $conn['connection'] = null;
                unset($this->connections[$id]);
                $this->connectionCount--;
            }
        }
    }
    
    // Close all connections in the pool
    public function close() {
        foreach ($this->connections as $id => $conn) {
            $conn['connection'] = null;
        }
        
        foreach ($this->inUseConnections as $id => $conn) {
            $conn['connection'] = null;
        }
        
        $this->connections = [];
        $this->inUseConnections = [];
        $this->connectionCount = 0;
    }
    
    // Get statistics about the connection pool
    public function getStats() {
        return [
            'total' => $this->connectionCount,
            'in_use' => count($this->inUseConnections),
            'idle' => count($this->connections)
        ];
    }
}
