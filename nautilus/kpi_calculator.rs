use serde::{Deserialize, Serialize};
use serde_json::{Value};
use sha2::{Sha256, Digest};
use ed25519_dalek::{Keypair, Signer};
use std::time::{SystemTime, UNIX_EPOCH};

/// KPI calculation result (without attestation)
#[derive(Default, Serialize, Deserialize)]
pub struct KPIResult {
    pub kpi: f64,
    pub change: f64,
    pub file_type: String,
}

/// TEE Attestation structure (144 bytes)
/// Format:
/// - kpi_value: u64 (8 bytes, little-endian)
/// - computation_hash: 32 bytes (SHA-256)
/// - timestamp: u64 (8 bytes, little-endian)
/// - tee_public_key: 32 bytes
/// - signature: 64 bytes (Ed25519)
#[derive(Serialize, Deserialize)]
pub struct TEEAttestation {
    pub kpi_value: u64,
    pub computation_hash: [u8; 32],
    pub timestamp: u64,
    pub tee_public_key: [u8; 32],
    pub signature: [u8; 64],
}

impl TEEAttestation {
    /// Convert attestation to bytes (144 bytes)
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(144);

        // kpi_value (8 bytes, little-endian)
        bytes.extend_from_slice(&self.kpi_value.to_le_bytes());

        // computation_hash (32 bytes)
        bytes.extend_from_slice(&self.computation_hash);

        // timestamp (8 bytes, little-endian)
        bytes.extend_from_slice(&self.timestamp.to_le_bytes());

        // tee_public_key (32 bytes)
        bytes.extend_from_slice(&self.tee_public_key);

        // signature (64 bytes)
        bytes.extend_from_slice(&self.signature);

        assert_eq!(bytes.len(), 144, "Attestation must be exactly 144 bytes");
        bytes
    }
}

/// Complete KPI result with TEE attestation
#[derive(Serialize, Deserialize)]
pub struct KPIResultWithAttestation {
    pub kpi_result: KPIResult,
    pub attestation: TEEAttestation,
    pub attestation_bytes: Vec<u8>, // 144 bytes for easy blockchain submission
}

// 判斷檔案類型
fn identify_file_type(data: &Value) -> String {
    if data.get("journalEntryId").is_some() {
        return "JournalEntry".to_string();
    }
    if let Some(asset_list) = data.get("assetList").and_then(|v| v.as_array()) {
        if !asset_list.is_empty() && asset_list[0].get("assetID").is_some() {
            return "FixedAssetsRegister".to_string();
        }
    }
    if data.get("employeeDetails").is_some() {
        return "PayrollExpense".to_string();
    }
    if data.get("reportTitle").and_then(|v| v.as_str()) == Some("Corporate Overhead Report") {
        return "OverheadReport".to_string();
    }
    "Unknown".to_string()
}

// Journal Entry
fn process_journal_entry(data: &Value) -> f64 {
    let mut amount = 0.0;

    if let Some(credits) = data.get("credits").and_then(|v| v.as_array()) {
        for credit in credits {
            if credit.get("account").and_then(|v| v.as_str()) == Some("Sales Revenue") {
                amount = credit.get("amount").and_then(|v| v.as_f64()).unwrap_or(0.0);
                break;
            }
        }
    }
    amount
}

// Fixed Assets
fn process_fixed_assets(data: &Value) -> f64 {
    let mut total = 0.0;

    if let Some(list) = data.get("assetList").and_then(|v| v.as_array()) {
        for asset in list {
            let cost = asset.get("originalCost").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let residual = asset.get("residualValue").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let life = asset.get("usefulLife_years").and_then(|v| v.as_f64()).unwrap_or(1.0);

            let monthly_dep = (cost - residual) / (life * 12.0);
            total += monthly_dep;
        }
    }
    -total  // KPI 是扣除
}

// Payroll
fn process_payroll(data: &Value) -> f64 {
    let gross_pay = data.get("grossPay").and_then(|v| v.as_f64()).unwrap_or(0.0);
    -gross_pay
}

// Overhead
fn process_overhead(data: &Value) -> f64 {
    let overhead = data.get("totalOverheadCost").and_then(|v| v.as_f64()).unwrap_or(0.0);
    -(overhead * 0.1)
}

/// Calculate hash of input documents for attestation
fn calculate_documents_hash(documents_json: &str) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(documents_json.as_bytes());
    let result = hasher.finalize();

    let mut hash = [0u8; 32];
    hash.copy_from_slice(&result);
    hash
}

/// Get current Unix timestamp in milliseconds
fn get_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards")
        .as_millis() as u64
}

/// Main entry point for TEE execution (legacy, without attestation)
pub fn calculate_kpi(json_str: &str, current_kpi: f64) -> KPIResult {
    let data: Value = serde_json::from_str(json_str).unwrap();

    let file_type = identify_file_type(&data);
    let mut change = 0.0;

    match file_type.as_str() {
        "JournalEntry" => change = process_journal_entry(&data),
        "FixedAssetsRegister" => change = process_fixed_assets(&data),
        "PayrollExpense" => change = process_payroll(&data),
        "OverheadReport" => change = process_overhead(&data),
        _ => {}
    }

    KPIResult {
        kpi: current_kpi + change,
        change,
        file_type,
    }
}

/// Calculate cumulative KPI with TEE attestation
///
/// This function processes multiple documents and generates a cryptographic
/// attestation proving the computation was performed in a trusted execution environment.
///
/// # Arguments
/// * `documents_json` - JSON array of all financial documents
/// * `tee_keypair` - TEE's Ed25519 keypair for signing attestation
///
/// # Returns
/// * `KPIResultWithAttestation` - KPI result with cryptographic proof
pub fn calculate_kpi_with_attestation(
    documents_json: &str,
    tee_keypair: &Keypair,
) -> KPIResultWithAttestation {
    // Parse documents array
    let documents: Vec<Value> = serde_json::from_str(documents_json)
        .expect("Invalid documents JSON");

    // Calculate cumulative KPI
    let mut cumulative_kpi = 0.0;
    let mut last_file_type = String::from("Unknown");

    for document in &documents {
        let file_type = identify_file_type(document);
        let change = match file_type.as_str() {
            "JournalEntry" => process_journal_entry(document),
            "FixedAssetsRegister" => process_fixed_assets(document),
            "PayrollExpense" => process_payroll(document),
            "OverheadReport" => process_overhead(document),
            _ => 0.0,
        };

        cumulative_kpi += change;
        last_file_type = file_type;
    }

    // Calculate computation hash (hash of all input documents)
    let computation_hash = calculate_documents_hash(documents_json);

    // Get current timestamp
    let timestamp = get_timestamp_ms();

    // Convert KPI to u64 (for blockchain, multiply by 1000 to preserve 3 decimals)
    // Example: 1234.567 -> 1234567
    let kpi_value_u64 = (cumulative_kpi * 1000.0).round() as u64;

    // Build message to sign: kpi_value || computation_hash || timestamp
    let mut message = Vec::new();
    message.extend_from_slice(&kpi_value_u64.to_le_bytes());
    message.extend_from_slice(&computation_hash);
    message.extend_from_slice(&timestamp.to_le_bytes());

    // Sign the message
    let signature_obj = tee_keypair.sign(&message);
    let signature_bytes = signature_obj.to_bytes();

    // Extract public key
    let public_key_bytes = tee_keypair.public.to_bytes();

    // Create attestation
    let attestation = TEEAttestation {
        kpi_value: kpi_value_u64,
        computation_hash,
        timestamp,
        tee_public_key: public_key_bytes,
        signature: signature_bytes,
    };

    // Convert attestation to bytes for blockchain submission
    let attestation_bytes = attestation.to_bytes();

    // Create KPI result
    let kpi_result = KPIResult {
        kpi: cumulative_kpi,
        change: cumulative_kpi, // In cumulative mode, change equals final KPI
        file_type: last_file_type,
    };

    KPIResultWithAttestation {
        kpi_result,
        attestation,
        attestation_bytes,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::Keypair;
    use rand::rngs::OsRng;

    #[test]
    fn test_calculate_kpi_with_attestation() {
        // Generate a test TEE keypair
        let mut csprng = OsRng{};
        let tee_keypair = Keypair::generate(&mut csprng);

        // Sample financial documents
        let documents_json = r#"[
            {
                "journalEntryId": "JE-2025-001",
                "credits": [
                    {"account": "Sales Revenue", "amount": 50000.0}
                ]
            },
            {
                "employeeDetails": {},
                "grossPay": 20000.0
            }
        ]"#;

        // Calculate KPI with attestation
        let result = calculate_kpi_with_attestation(documents_json, &tee_keypair);

        // Verify KPI calculation
        // Sales Revenue: +50000, Payroll: -20000 => Total: 30000
        assert_eq!(result.kpi_result.kpi, 30000.0);

        // Verify attestation bytes length
        assert_eq!(result.attestation_bytes.len(), 144);

        // Verify attestation structure
        assert_eq!(result.attestation.kpi_value, 30000000); // 30000.0 * 1000

        println!("✅ KPI calculation with attestation successful");
        println!("KPI: {}", result.kpi_result.kpi);
        println!("Attestation bytes: {} bytes", result.attestation_bytes.len());
    }

    #[test]
    fn test_attestation_serialization() {
        let mut csprng = OsRng{};
        let tee_keypair = Keypair::generate(&mut csprng);

        let documents_json = r#"[{"journalEntryId": "JE-001", "credits": [{"account": "Sales Revenue", "amount": 1000.0}]}]"#;

        let result = calculate_kpi_with_attestation(documents_json, &tee_keypair);

        // Verify we can deserialize the bytes back
        let bytes = &result.attestation_bytes;

        // Extract kpi_value
        let kpi_value = u64::from_le_bytes([
            bytes[0], bytes[1], bytes[2], bytes[3],
            bytes[4], bytes[5], bytes[6], bytes[7],
        ]);

        assert_eq!(kpi_value, result.attestation.kpi_value);
        println!("✅ Attestation serialization test passed");
    }
}
