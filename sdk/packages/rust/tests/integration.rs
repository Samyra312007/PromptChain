use promptchain::*;

#[test]
fn test_find_prompt_pda() {
    let (pda, bump) = find_prompt_pda("QmTest123");
    assert!(bump < 255);
    assert!(pda.to_string().len() > 30);
}

#[test]
fn test_find_license_pda() {
    let auth = solana_sdk::pubkey::Pubkey::new_unique();
    let (pda, bump) = find_license_pda(&auth, "MIT");
    assert!(bump < 255);
    assert!(pda.to_string().len() > 30);
}

#[test]
fn test_find_token_config_pda() {
    let (pda, bump) = find_token_config_pda();
    assert!(bump < 255);
    assert!(pda.to_string().len() > 30);
}

#[test]
fn test_find_dao_config_pda() {
    let (pda, bump) = find_dao_config_pda();
    assert!(bump < 255);
    assert!(pda.to_string().len() > 30);
}

#[test]
fn test_hash_cid() {
    let hash = hash_cid("QmTest123");
    assert_eq!(hash.len(), 32);
}

#[test]
fn test_prompt_metadata_serde() {
    let metadata = types::PromptMetadata {
        name: "Test".into(),
        description: "Desc".into(),
        prompt_text: "Text".into(),
        target_model: None,
        benchmarks: None,
        category: "code".into(),
        tags: vec![],
        task_description: "Task".into(),
        changelog: None,
        fork_of: None,
        created_at: "now".into(),
        updated_at: "now".into(),
        language: "en".into(),
    };
    let json = serde_json::to_string(&metadata).unwrap();
    assert!(json.contains("Test"));
}
