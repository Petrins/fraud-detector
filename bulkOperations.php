<?php
// Enhanced bulk save function with optimized performance and security
function bulkSaveReputationsBatch($data) {
    global $CONFIG;
    
    // Validate input
    if (!isset($data['domains']) || !is_array($data['domains']) || empty($data['domains'])) {
        echo json_encode(["success" => false, "error" => "Invalid input data"]);
        return;
    }
    
    // Limit batch size for performance
    $domains = $data['domains'];
    $chunkSize = $CONFIG['PERFORMANCE']['CHUNK_SIZE'] ?? 50;
    $totalDomains = count($domains);
    $processedCount = 0;
    
    // Start timing for performance metrics
    $startTime = microtime(true);
    
    // Process domains in chunks using our transaction wrapper
    $chunks = array_chunk($domains, $chunkSize);
    $errors = [];
    
    foreach ($chunks as $chunk) {
        $result = withTransaction(function($conn) use ($chunk) {
            global $CONFIG;
            
            // Prepare statement once for the chunk
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
            
            $timestamp = time();
            $successCount = 0;
            
            // Consider using a multi-value insert for better performance with MySQL
            foreach ($chunk as $domain) {
                // Data validation
                if (!isset($domain['domain']) || empty($domain['domain'])) {
                    continue;
                }
                
                // Sanitize and validate inputs
                $domainStr = filter_var($domain['domain'], FILTER_SANITIZE_STRING);
                if (!$domainStr || !filter_var('http://' . $domainStr, FILTER_VALIDATE_URL)) {
                    continue;
                }
                
                // Extract and validate numeric values
                $harmless = isset($domain['harmless']) ? intval($domain['harmless']) : 0;
                $malicious = isset($domain['malicious']) ? intval($domain['malicious']) : 0;
                $suspicious = isset($domain['suspicious']) ? intval($domain['suspicious']) : 0;
                $undetected = isset($domain['undetected']) ? intval($domain['undetected']) : 0;
                $confidence = isset($domain['confidence']) ? floatval($domain['confidence']) : 0.0;
                $entropy = isset($domain['entropy']) ? floatval($domain['entropy']) : 0.0;
                $lexical_diversity = isset($domain['lexical_diversity']) ? floatval($domain['lexical_diversity']) : 0.0;
                $is_branded = isset($domain['is_branded']) ? intval($domain['is_branded']) : 0;
                
                // Bind parameters with proper types
                $stmt->bindParam(':domain', $domainStr, PDO::PARAM_STR);
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
                
                // Log for security tracking (sample a subset to avoid log bloat)
                if (mt_rand(1, 10) == 1) {
                    logDatabaseActivity("domain_reputation", $domainStr, "bulk_insert");
                }
                
                $successCount++;
            }
            
            return ['success' => true, 'count' => $successCount];
        });
        
        if (isset($result['success']) && $result['success']) {
            $processedCount += $result['count'];
        } else {
            $errors[] = $result['error'] ?? 'Unknown error';
        }
    }
    
    // Calculate performance metrics
    $endTime = microtime(true);
    $executionTime = round($endTime - $startTime, 2);
    
    // Log performance metrics
    if ($CONFIG['LOGGING']['LEVEL'] === 'DEBUG' || $CONFIG['LOGGING']['LEVEL'] === 'INFO') {
        error_log("Bulk import performance: processed {$processedCount}/{$totalDomains} domains in {$executionTime} seconds");
    }
    
    // Return results
    if (empty($errors)) {
        echo json_encode([
            "success" => true, 
            "count" => $processedCount,
            "execution_time" => $executionTime,
            "metrics" => [
                "domains_per_second" => round($processedCount / max(0.001, $executionTime), 2)
            ]
        ]);
    } else {
        echo json_encode([
            "success" => $processedCount > 0,
            "count" => $processedCount,
            "total" => $totalDomains,
            "errors" => $errors,
            "execution_time" => $executionTime
        ]);
    }
}
