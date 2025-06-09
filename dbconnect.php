<?php
// Enhanced security for database connections

// Load configuration from config.php (not tracked in version control)
require_once('config.php');

// Load enhanced components
require_once('DbConnectionPool.php');
require_once('Logger.php');
require_once('RateLimiter.php');
require_once('bulkOperations.php');

// Initialize logger
$logger = Logger::getInstance($CONFIG);

// Initialize rate limiter
$rateLimiter = new RateLimiter($CONFIG);

// Include the connection pool class
require_once('DbConnectionPool.php');

// Get connection from pool with improved security and performance
function getConnection() {
    global $CONFIG;
    
    try {
        // Get connection from pool
        $pool = DbConnectionPool::getInstance($CONFIG);
        $conn = $pool->getConnection();
        
        // Run connection maintenance periodically (5% chance)
        if (mt_rand(1, 100) <= 5) {
            $pool->maintenance();
        }
        
        return $conn;
    } catch(Exception $e) {
        // Log error but don't expose details to client
        error_log("Database connection error: " . $e->getMessage());
        return null;
    }
}

// Release connection back to the pool
function releaseConnection($conn) {
    global $CONFIG;
    
    try {
        if ($conn) {
            $pool = DbConnectionPool::getInstance($CONFIG);
            $pool->releaseConnection($conn);
        }
    } catch(Exception $e) {
        error_log("Error releasing connection: " . $e->getMessage());
    }
}

// Transaction wrapper with automatic retry on deadlock
function withTransaction($callback, $maxRetries = 3) {
    $conn = getConnection();
    if (!$conn) {
        return ['success' => false, 'error' => 'Database connection error'];
    }
    
    $retryCount = 0;
    $result = null;
    
    while ($retryCount < $maxRetries) {
        try {
            $conn->beginTransaction();
            $result = $callback($conn);
            $conn->commit();
            break; // Success, exit retry loop
        } catch (PDOException $e) {
            // Rollback transaction
            if ($conn->inTransaction()) {
                $conn->rollBack();
            }
            
            // Check if it's a deadlock error (MySQL error 1213)
            if ($e->getCode() == 1213 && $retryCount < $maxRetries - 1) {
                $waitTime = 100000 * pow(2, $retryCount); // Exponential backoff
                error_log("Deadlock detected, retrying (attempt " . ($retryCount + 1) . ")");
                usleep($waitTime);
                $retryCount++;
            } else {
                error_log("Transaction error: " . $e->getMessage());
                $result = ['success' => false, 'error' => 'Database transaction error'];
                break;
            }
        } catch (Exception $e) {
            // Rollback on any other exception
            if ($conn && $conn->inTransaction()) {
                $conn->rollBack();
            }
            error_log("Transaction error: " . $e->getMessage());
            $result = ['success' => false, 'error' => 'An error occurred during transaction'];
            break;
        }
    }
    
    // Return connection to the pool
    releaseConnection($conn);
    
    return $result;
}

// Set headers for CORS and JSON response
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, DELETE");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

// Security function to log database activity
function logDatabaseActivity($table, $identifier, $action) {
    try {
        // Get client IP with proxy support
        $ip = isset($_SERVER['HTTP_X_FORWARDED_FOR']) ? 
              $_SERVER['HTTP_X_FORWARDED_FOR'] : $_SERVER['REMOTE_ADDR'];
              
        // Log to file with timestamp and request details
        $logEntry = date('Y-m-d H:i:s') . " | " . 
                   $ip . " | " . 
                   $table . " | " . 
                   $identifier . " | " . 
                   $action . " | " .
                   $_SERVER['REQUEST_METHOD'] . " " . $_SERVER['REQUEST_URI'];
                   
        error_log($logEntry . PHP_EOL, 3, __DIR__ . '/db_activity.log');
    } catch (Exception $e) {
        // Silent fail - don't block main functionality if logging fails
        error_log("Failed to write security log: " . $e->getMessage());
    }
}

// Get request method and route
$method = $_SERVER['REQUEST_METHOD'];
$request = isset($_GET['request']) ? $_GET['request'] : '';

// Get client IP with proxy support
$clientIP = isset($_SERVER['HTTP_X_FORWARDED_FOR']) ? 
           $_SERVER['HTTP_X_FORWARDED_FOR'] : $_SERVER['REMOTE_ADDR'];

// Check rate limit - use different limits for different endpoints
$routeType = 'default';
if (strpos($request, 'bulk') === 0) {
    $routeType = 'bulk';
} else if (strpos($request, 'whitelist') === 0 || strpos($request, 'blacklist') === 0) {
    $routeType = 'whitelist';
}

// Check if client is rate limited
if (!$rateLimiter->isAllowed($clientIP, $routeType)) {
    // Add rate limit headers
    header('X-RateLimit-Limit: ' . $CONFIG['SECURITY']['RATE_LIMIT']);
    header('X-RateLimit-Remaining: 0');
    header('Retry-After: 60');
    
    // Log rate limit event
    $logger->warning("Rate limit exceeded", [
        'ip' => $clientIP,
        'method' => $method,
        'request' => $request,
        'route_type' => $routeType
    ]);
    
    // Send 429 Too Many Requests status
    http_response_code(429);
    echo json_encode(["error" => "Rate limit exceeded. Please try again later."]);
    exit;
}

// Add rate limit headers
$remaining = $rateLimiter->getRemainingRequests($clientIP, $routeType);
header('X-RateLimit-Limit: ' . $CONFIG['SECURITY']['RATE_LIMIT']);
header('X-RateLimit-Remaining: ' . $remaining);

// Handle the request based on method and route
switch($method) {
    case 'GET':
        if (strpos($request, 'reputation/') === 0) {
            // Get domain reputation
            $domain = substr($request, 11); // Remove 'reputation/' prefix
            getDomainReputation($domain);
        } elseif ($request == 'whitelist') {
            // Get whitelist
            getWhitelist();
        } elseif ($request == 'blacklist') {
            // Get blacklist
            getBlacklist();
        } elseif ($request == 'stats') {
            // Get statistics
            getStats();
        } else {
            // Invalid request
            echo json_encode(["error" => "Invalid request"]);
        }
        break;
        
    case 'POST':
        // Get POST data
        $data = json_decode(file_get_contents("php://input"), true);
        
        if ($request == 'reputation') {
            // Save domain reputation
            saveDomainReputation($data);
        } elseif ($request == 'whitelist') {
            // Add to whitelist
            addToWhitelist($data);
        } elseif ($request == 'blacklist') {
            // Add to blacklist
            addToBlacklist($data);
        } elseif ($request == 'stats') {
            // Update statistics
            updateStats($data);
        } elseif ($request == 'bulk/reputation') {
            // Bulk save domain reputations
            bulkSaveReputations($data);
        } else {
            // Invalid request
            echo json_encode(["error" => "Invalid request"]);
        }
        break;
        
    case 'DELETE':
        if (strpos($request, 'whitelist/') === 0) {
            // Remove from whitelist
            $domain = substr($request, 10); // Remove 'whitelist/' prefix
            removeFromWhitelist($domain);
        } elseif (strpos($request, 'blacklist/') === 0) {
            // Remove from blacklist
            $domain = substr($request, 10); // Remove 'blacklist/' prefix
            removeFromBlacklist($domain);
        } else {
            // Invalid request
            echo json_encode(["error" => "Invalid request"]);
        }
        break;
        
    default:
        // Method not allowed
        echo json_encode(["error" => "Method not allowed"]);
        break;
}

// Function to get domain reputation
function getDomainReputation($domain) {
    $conn = getConnection();
    
    try {
        $stmt = $conn->prepare("SELECT * FROM domain_reputation WHERE domain = :domain");
        $stmt->bindParam(':domain', $domain);
        $stmt->execute();
        
        if ($stmt->rowCount() > 0) {
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            // Check if the data is still valid (not older than 24 hours)
            if ($result['last_checked'] > (time() - 86400)) {
                echo json_encode([
                    "domain" => $result['domain'],
                    "harmless" => (int)$result['harmless'],
                    "malicious" => (int)$result['malicious'],
                    "suspicious" => (int)$result['suspicious'],
                    "undetected" => (int)$result['undetected'],
                    "confidence" => (float)$result['confidence'],
                    "entropy" => (float)$result['entropy'],
                    "cached" => true
                ]);
            } else {
                echo json_encode(["domain" => $domain, "cached" => false]);
            }
        } else {
            echo json_encode(["domain" => $domain, "cached" => false]);
        }
    } catch(PDOException $e) {
        echo json_encode(["error" => $e->getMessage()]);
    }
}

// Function to save domain reputation with enhanced security and validation
function saveDomainReputation($data) {
    global $CONFIG;
    $conn = getConnection();
    
    // Check for missing connection
    if (!$conn) {
        error_log("Database connection failed in saveDomainReputation");
        echo json_encode(["success" => false, "error" => "Database connection error"]);
        return;
    }
    
    // Validate required fields
    if (empty($data['domain'])) {
        echo json_encode(["success" => false, "error" => "Domain is required"]);
        return;
    }
    
    // Validate domain format
    if (!filter_var('http://' . $data['domain'], FILTER_VALIDATE_URL)) {
        echo json_encode(["success" => false, "error" => "Invalid domain format"]);
        return;
    }
    
    // Check payload size (prevent DoS)
    if (strlen(json_encode($data)) > $CONFIG['SECURITY']['MAX_PAYLOAD_SIZE']) {
        echo json_encode(["success" => false, "error" => "Payload too large"]);
        return;
    }
    
    try {
        // Begin transaction for integrity
        $conn->beginTransaction();
        
        $stmt = $conn->prepare("INSERT INTO domain_reputation 
            (domain, harmless, malicious, suspicious, undetected, confidence, entropy, lexical_diversity, is_branded, last_checked) 
            VALUES (:domain, :harmless, :malicious, :suspicious, :undetected, :confidence, :entropy, :lexical_diversity, :is_branded, :last_checked)
            ON DUPLICATE KEY UPDATE
            harmless = VALUES(harmless),
            malicious = VALUES(malicious),
            suspicious = VALUES(suspicious),
            undetected = VALUES(undetected),
            confidence = VALUES(confidence),
            entropy = VALUES(entropy),
            lexical_diversity = VALUES(lexical_diversity),
            is_branded = VALUES(is_branded),
            last_checked = VALUES(last_checked)");
        
        // Sanitize and validate numeric inputs
        $domain = filter_var($data['domain'], FILTER_SANITIZE_STRING); 
        $harmless = isset($data['harmless']) ? intval($data['harmless']) : 0;
        $malicious = isset($data['malicious']) ? intval($data['malicious']) : 0;
        $suspicious = isset($data['suspicious']) ? intval($data['suspicious']) : 0;
        $undetected = isset($data['undetected']) ? intval($data['undetected']) : 0;
        $confidence = isset($data['confidence']) ? floatval($data['confidence']) : 0.0;
        $entropy = isset($data['entropy']) ? floatval($data['entropy']) : 0.0;
        $lexical_diversity = isset($data['lexical_diversity']) ? floatval($data['lexical_diversity']) : 0.0;
        $is_branded = isset($data['is_branded']) ? intval($data['is_branded']) : 0;
        $timestamp = time();
        
        // Bind parameters with appropriate types
        $stmt->bindParam(':domain', $domain, PDO::PARAM_STR);
        $stmt->bindParam(':harmless', $harmless, PDO::PARAM_INT);
        $stmt->bindParam(':malicious', $malicious, PDO::PARAM_INT);
        $stmt->bindParam(':suspicious', $suspicious, PDO::PARAM_INT);
        $stmt->bindParam(':undetected', $undetected, PDO::PARAM_INT);
        $stmt->bindParam(':confidence', $confidence);
        $stmt->bindParam(':entropy', $entropy);
        $stmt->bindParam(':lexical_diversity', $lexical_diversity);
        $stmt->bindParam(':is_branded', $is_branded, PDO::PARAM_INT);
        $stmt->bindParam(':last_checked', $timestamp, PDO::PARAM_INT);
        
        $stmt->execute();
        $conn->commit();
        
        // Add to audit log for security tracking
        logDatabaseActivity("domain_reputation", $domain, "update");
        
        echo json_encode(["success" => true, "domain" => $domain]);
    } catch(PDOException $e) {
        // Roll back transaction on error
        if ($conn->inTransaction()) {
            $conn->rollBack();
        }
        error_log("Database error in saveDomainReputation: " . $e->getMessage());
        echo json_encode(["success" => false, "error" => "An error occurred while saving data"]);
    }
}

// Function to get whitelist
function getWhitelist() {
    $conn = getConnection();
    
    try {
        $stmt = $conn->prepare("SELECT domain FROM whitelist");
        $stmt->execute();
        
        $domains = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $domains[] = $row['domain'];
        }
        
        echo json_encode($domains);
    } catch(PDOException $e) {
        echo json_encode(["error" => $e->getMessage()]);
    }
}

// Function to add to whitelist
function addToWhitelist($data) {
    $conn = getConnection();
    
    try {
        $stmt = $conn->prepare("INSERT IGNORE INTO whitelist (domain, notes) VALUES (:domain, :notes)");
        $stmt->bindParam(':domain', $data['domain']);
        $stmt->bindParam(':notes', $data['notes'] ?? null);
        $stmt->execute();
        
        echo json_encode(["success" => true]);
    } catch(PDOException $e) {
        echo json_encode(["error" => $e->getMessage()]);
    }
}

// Function to remove from whitelist
function removeFromWhitelist($domain) {
    $conn = getConnection();
    
    try {
        $stmt = $conn->prepare("DELETE FROM whitelist WHERE domain = :domain");
        $stmt->bindParam(':domain', $domain);
        $stmt->execute();
        
        echo json_encode(["success" => true]);
    } catch(PDOException $e) {
        echo json_encode(["error" => $e->getMessage()]);
    }
}

// Similar functions for blacklist
function getBlacklist() {
    $conn = getConnection();
    
    try {
        $stmt = $conn->prepare("SELECT domain FROM blacklist");
        $stmt->execute();
        
        $domains = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $domains[] = $row['domain'];
        }
        
        echo json_encode($domains);
    } catch(PDOException $e) {
        echo json_encode(["error" => $e->getMessage()]);
    }
}

function addToBlacklist($data) {
    $conn = getConnection();
    
    try {
        $stmt = $conn->prepare("INSERT IGNORE INTO blacklist (domain, reason) VALUES (:domain, :reason)");
        $stmt->bindParam(':domain', $data['domain']);
        $stmt->bindParam(':reason', $data['reason'] ?? null);
        $stmt->execute();
        
        echo json_encode(["success" => true]);
    } catch(PDOException $e) {
        echo json_encode(["error" => $e->getMessage()]);
    }
}

function removeFromBlacklist($domain) {
    $conn = getConnection();
    
    try {
        $stmt = $conn->prepare("DELETE FROM blacklist WHERE domain = :domain");
        $stmt->bindParam(':domain', $domain);
        $stmt->execute();
        
        echo json_encode(["success" => true]);
    } catch(PDOException $e) {
        echo json_encode(["error" => $e->getMessage()]);
    }
}

// Function to update statistics
function updateStats($data) {
    $conn = getConnection();
    
    try {
        $stmt = $conn->prepare("INSERT INTO detection_stats (date, high_risk, medium_risk, safe)
            VALUES (:date, :high_risk, :medium_risk, :safe)
            ON DUPLICATE KEY UPDATE
            high_risk = high_risk + VALUES(high_risk),
            medium_risk = medium_risk + VALUES(medium_risk),
            safe = safe + VALUES(safe)");
        
        $stmt->bindParam(':date', $data['date']);
        $stmt->bindParam(':high_risk', $data['high_risk']);
        $stmt->bindParam(':medium_risk', $data['medium_risk']);
        $stmt->bindParam(':safe', $data['safe']);
        
        $stmt->execute();
        
        echo json_encode(["success" => true]);
    } catch(PDOException $e) {
        echo json_encode(["error" => $e->getMessage()]);
    }
}

// Function for bulk saving reputations
function bulkSaveReputations($data) {
    global $logger;
    
    // Log the bulk operation
    $logger->info("Starting bulk domain reputation import", [
        'count' => count($data['domains'] ?? [])
    ]);
    
    // Call the optimized implementation
    bulkSaveReputationsBatch($data);
}

// Function to get statistics
function getStats() {
    $conn = getConnection();
    
    try {
        $stmt = $conn->prepare("SELECT * FROM detection_stats ORDER BY date DESC LIMIT 30");
        $stmt->execute();
        
        $stats = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $stats[] = $row;
        }
        
        echo json_encode($stats);
    } catch(PDOException $e) {
        echo json_encode(["error" => $e->getMessage()]);
    }
}
?>
