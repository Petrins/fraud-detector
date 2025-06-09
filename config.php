<?php
// Database configuration file - NOT to be tracked in version control
// Add this file to .gitignore

$CONFIG = [
    // Database connection settings
    'DB_HOST' => 'localhost',
    'DB_NAME' => 'fraud_detector',
    'DB_USER' => 'root',
    'DB_PASS' => '',
    'DB_PORT' => 3306,
    'DB_CHARSET' => 'utf8mb4',
    
    // Connection pool settings
    'DB_POOL' => [
        'MIN_CONNECTIONS' => 2,
        'MAX_CONNECTIONS' => 10,
        'CONNECTION_TIMEOUT' => 30, // seconds
        'IDLE_TIMEOUT' => 300 // seconds
    ],
    
    // Encryption and security
    'ENCRYPTION_KEY' => 'your-secure-encryption-key-here', // Used for encrypting sensitive data
    'ENCRYPTION_METHOD' => 'aes-256-cbc', // Encryption algorithm
    
    // API keys (stored securely)
    'API_KEYS' => [
        'VT_API_KEY' => '70e8e9199ea99ccaf1ac21de0f0032dcb3b21a737a17f2d124bbc2a6dec513a2',
        'HF_API_KEY' => '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'
    ],
    
    // Security settings
    'SECURITY' => [
        'RATE_LIMIT' => 100, // Maximum requests per minute
        'MAX_PAYLOAD_SIZE' => 1048576, // 1MB
        'TOKEN_LIFETIME' => 3600, // JWT token lifetime in seconds
        'ALLOWED_ORIGINS' => ['chrome-extension://*'], // CORS allowed origins
        'REQUIRE_AUTH' => true, // Require authentication for API calls
        'HASH_ALGO' => 'argon2id' // Password hashing algorithm
    ],
    
    // Performance settings
    'PERFORMANCE' => [
        'CACHE_TTL' => 86400, // Cache lifetime in seconds (24 hours)
        'CHUNK_SIZE' => 50, // Chunk size for bulk operations
        'MAX_EXECUTION_TIME' => 30 // Maximum execution time in seconds
    ],
    
    // Logging configuration
    'LOGGING' => [
        'ENABLED' => true,
        'LEVEL' => 'ERROR', // ERROR, WARNING, INFO, DEBUG
        'FILE' => __DIR__ . '/logs/app.log',
        'ROTATE_SIZE' => 10485760 // 10MB
    ]
];
