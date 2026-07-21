const anchor = require("@coral-xyz/anchor");
const { Program, AnchorProvider, BN } = anchor;
const { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const { createHash } = require("crypto");
const { expect, assert } = require("chai");
const promptchainIdl = require("../../target/idl/promptchain.json");

function sha256(data) {
  return createHash("sha256").update(data, "utf8").digest();
}

function findPromptPda(cid) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("prompt"), sha256(cid)],
    new PublicKey(promptchainIdl.address),
  );
}

function findVersionPda(prompt, versionNumber) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(versionNumber);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("version"), prompt.toBuffer(), buf],
    new PublicKey(promptchainIdl.address),
  );
}

function findLicensePda(authority, name) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("license"), authority.toBuffer(), Buffer.from(name)],
    new PublicKey(promptchainIdl.address),
  );
}

describe("PromptChain Kernel (Layer 0)", () => {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);

  const program = new Program(promptchainIdl, provider);
  const authority = provider.wallet.publicKey;

  const cid = "QmTest1234567890abcdef";
  const metadataUri = "https://ipfs.example.com/metadata.json";
  const licenseName = "MIT-like";
  const changelogUri = "https://ipfs.example.com/changelog.json";

  it("publish: creates a new prompt", async () => {
    const [promptPda] = findPromptPda(cid);

    await program.methods
      .publish(cid, metadataUri, null)
      .accounts({
        prompt: promptPda,
        authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const prompt = await program.account.prompt.fetch(promptPda);
    expect(prompt.authority.toString()).to.equal(authority.toString());
    expect(prompt.originalAuthority.toString()).to.equal(authority.toString());
    expect(prompt.ipfsCid).to.equal(cid);
    expect(prompt.metadataUri).to.equal(metadataUri);
    expect(prompt.license.toString()).to.equal(PublicKey.default.toString());
    expect(prompt.totalVersions).to.equal(1);
    expect(prompt.totalUses.toNumber()).to.equal(0);
  });

  it("publish: fails with empty CID", async () => {
    const [promptPda] = findPromptPda("");
    try {
      await program.methods
        .publish("", metadataUri, null)
        .accounts({
          prompt: promptPda,
          authority,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      assert.fail("Expected error");
    } catch (e) {
      expect(e.error.errorCode.code).to.equal("EmptyCid");
    }
  });

  it("publish: fails with empty metadata URI", async () => {
    const cid2 = "QmTestEmptyUri";
    const [promptPda] = findPromptPda(cid2);
    try {
      await program.methods
        .publish(cid2, "", null)
        .accounts({
          prompt: promptPda,
          authority,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      assert.fail("Expected error");
    } catch (e) {
      expect(e.error.errorCode.code).to.equal("EmptyMetadataUri");
    }
  });

  it("publish: fails with CID exceeding max length", async () => {
    const longCid = "x".repeat(71);
    try {
      const [promptPda] = findPromptPda(longCid);
      await program.methods
        .publish(longCid, metadataUri, null)
        .accounts({
          prompt: promptPda,
          authority,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      assert.fail("Expected error");
    } catch (e) {
      expect(e.error.errorCode.code).to.equal("CidTooLong");
    }
  });

  it("create_version: creates a new version", async () => {
    const [promptPda] = findPromptPda(cid);
    const promptBefore = await program.account.prompt.fetch(promptPda);
    const versionNumber = promptBefore.totalVersions;

    const [versionPda] = findVersionPda(promptPda, versionNumber);

    const versionCid = "QmVersionCid12345";
    const versionMetadataUri = "https://ipfs.example.com/v1/metadata.json";

    await program.methods
      .createVersion(versionCid, versionMetadataUri, changelogUri)
      .accounts({
        prompt: promptPda,
        version: versionPda,
        authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const promptAfter = await program.account.prompt.fetch(promptPda);
    expect(promptAfter.totalVersions).to.equal(versionNumber + 1);

    const version = await program.account.promptVersion.fetch(versionPda);
    expect(version.parent.toString()).to.equal(promptPda.toString());
    expect(version.versionNumber).to.equal(versionNumber);
    expect(version.author.toString()).to.equal(authority.toString());
    expect(version.ipfsCid).to.equal(versionCid);
    expect(version.metadataUri).to.equal(versionMetadataUri);
    expect(version.changelogUri).to.equal(changelogUri);
  });

    it("create_version: fails if not the prompt authority", async () => {
    const [promptPda] = findPromptPda(cid);
    const promptData = await program.account.prompt.fetch(promptPda);
    const versionNumber = promptData.totalVersions;
    const [versionPda] = findVersionPda(promptPda, versionNumber);

    const wrongUser = Keypair.generate();
    const airdropSig = await provider.connection.requestAirdrop(
      wrongUser.publicKey,
      2 * LAMPORTS_PER_SOL,
    );
    await provider.connection.confirmTransaction(airdropSig);

    try {
      await program.methods
        .createVersion("QmWrongAuth", metadataUri, changelogUri)
        .accounts({
          prompt: promptPda,
          version: versionPda,
          authority: wrongUser.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([wrongUser])
        .rpc();
      assert.fail("Expected error");
    } catch (e) {
      const code = e.error?.errorCode?.code || "unknown";
      expect(code).to.equal("Unauthorized");
    }
  });

  it("set_license: creates a new license", async () => {
    const [licensePda] = findLicensePda(authority, licenseName);

    await program.methods
      .setLicense(licenseName, true, true, 500)
      .accounts({
        license: licensePda,
        authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const license = await program.account.license.fetch(licensePda);
    expect(license.authority.toString()).to.equal(authority.toString());
    expect(license.name).to.equal(licenseName);
    expect(license.commercialAllowed).to.be.true;
    expect(license.attributionRequired).to.be.true;
    expect(license.royaltyBasisPoints).to.equal(500);
  });

  it("set_license: fails with empty name", async () => {
    const [licensePda] = findLicensePda(authority, "");
    try {
      await program.methods
        .setLicense("", true, true, 500)
        .accounts({
          license: licensePda,
          authority,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      assert.fail("Expected error");
    } catch (e) {
      expect(e.error.errorCode.code).to.equal("EmptyName");
    }
  });

  it("set_license: fails with royalty > 100%", async () => {
    const name = "TestRoyaltyTooHigh";
    const [licensePda] = findLicensePda(authority, name);
    try {
      await program.methods
        .setLicense(name, true, true, 10001)
        .accounts({
          license: licensePda,
          authority,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      assert.fail("Expected error");
    } catch (e) {
      expect(e.error.errorCode.code).to.equal("RoyaltyTooHigh");
    }
  });

  it("transfer: transfers prompt to new authority and subsequent PDA lookup still works", async () => {
    const [promptPda] = findPromptPda(cid);
    const newAuthority = Keypair.generate();

    // Transfer to new authority
    await program.methods
      .transfer(newAuthority.publicKey)
      .accounts({
        prompt: promptPda,
        currentAuthority: authority,
      })
      .rpc();

    // Read prompt with same PDA (still derivable from hash_cid)
    const prompt = await program.account.prompt.fetch(promptPda);
    expect(prompt.authority.toString()).to.equal(newAuthority.publicKey.toString());

    // Transfer back to original authority
    await program.methods
      .transfer(authority)
      .accounts({
        prompt: promptPda,
        currentAuthority: newAuthority.publicKey,
      })
      .signers([newAuthority])
      .rpc();

    const promptAfter = await program.account.prompt.fetch(promptPda);
    expect(promptAfter.authority.toString()).to.equal(authority.toString());
  });

  it("transfer: fails with same authority", async () => {
    const [promptPda] = findPromptPda(cid);
    try {
      await program.methods
        .transfer(authority)
        .accounts({
          prompt: promptPda,
          currentAuthority: authority,
        })
        .rpc();
      assert.fail("Expected error");
    } catch (e) {
      expect(e.error.errorCode.code).to.equal("SameAuthority");
    }
  });

  it("transfer: fails if not current authority", async () => {
    const [promptPda] = findPromptPda(cid);
    const wrongUser = Keypair.generate();
    const newAuth = Keypair.generate();
    try {
      await program.methods
        .transfer(newAuth.publicKey)
        .accounts({
          prompt: promptPda,
          currentAuthority: wrongUser.publicKey,
        })
        .signers([wrongUser])
        .rpc();
      assert.fail("Expected error");
    } catch (e) {
      expect(e.error.errorCode.code).to.equal("Unauthorized");
    }
  });

  it("use_prompt: increments usage count without royalty (no license)", async () => {
    const [promptPda] = findPromptPda(cid);
    const promptBefore = await program.account.prompt.fetch(promptPda);
    const usesBefore = promptBefore.totalUses.toNumber();

    // Pass null for license when prompt has no license
    await program.methods
      .usePrompt(new BN(0))
      .accounts({
        prompt: promptPda,
        license: null,
        payer: authority,
        licenseAuthority: authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const promptAfter = await program.account.prompt.fetch(promptPda);
    expect(promptAfter.totalUses.toNumber()).to.equal(usesBefore + 1);
  });

  it("use_prompt: transfers royalty when configured", async () => {
    const licenseCid = "QmPromptWithLicense";
    const [promptPda] = findPromptPda(licenseCid);
    const licName = "RoyaltyLic";

    // Create a license with 10% royalty
    const [licensePda] = findLicensePda(authority, licName);
    await program.methods
      .setLicense(licName, true, true, 1000)
      .accounts({
        license: licensePda,
        authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Publish a prompt with that license
    await program.methods
      .publish(licenseCid, metadataUri, licensePda)
      .accounts({
        prompt: promptPda,
        authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const payer = Keypair.generate();
    const airdropSig = await provider.connection.requestAirdrop(
      payer.publicKey,
      2 * LAMPORTS_PER_SOL,
    );
    await provider.connection.confirmTransaction(airdropSig);

    const payerBalanceBefore = await provider.connection.getBalance(payer.publicKey);
    const licAuthBalanceBefore = await provider.connection.getBalance(authority);

    const maxPayment = new BN(LAMPORTS_PER_SOL);
    await program.methods
      .usePrompt(maxPayment)
      .accounts({
        prompt: promptPda,
        license: licensePda,
        payer: payer.publicKey,
        licenseAuthority: authority,
        systemProgram: SystemProgram.programId,
      })
      .signers([payer])
      .rpc();

    const expectedRoyalty = Math.floor(LAMPORTS_PER_SOL * 0.1);
    const payerBalanceAfter = await provider.connection.getBalance(payer.publicKey);
    const licAuthBalanceAfter = await provider.connection.getBalance(authority);

    expect(payerBalanceAfter).to.be.lessThan(payerBalanceBefore);
    expect(licAuthBalanceAfter - licAuthBalanceBefore).to.be.at.least(expectedRoyalty - 50000);
  });

  it("use_prompt: fails with mismatched license", async () => {
    // Create a prompt WITH a license
    const mismatchCid = "QmWithLicenseMismatch";
    const realLicName = "RealLicense";
    const [realLicPda] = findLicensePda(authority, realLicName);
    await program.methods
      .setLicense(realLicName, true, true, 0)
      .accounts({
        license: realLicPda,
        authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const [promptPda] = findPromptPda(mismatchCid);
    await program.methods
      .publish(mismatchCid, metadataUri, realLicPda)
      .accounts({
        prompt: promptPda,
        authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Try to use it with a DIFFERENT license
    const otherLicName = "WrongLicense3";
    const [wrongLicensePda] = findLicensePda(authority, otherLicName);
    await program.methods
      .setLicense(otherLicName, true, true, 0)
      .accounts({
        license: wrongLicensePda,
        authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    try {
      await program.methods
        .usePrompt(new BN(0))
        .accounts({
          prompt: promptPda,
          license: wrongLicensePda,
          payer: authority,
          licenseAuthority: authority,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      assert.fail("Expected error");
    } catch (e) {
      const code = e.error?.errorCode?.code || "unknown";
      expect(code).to.equal("LicenseMismatch");
    }
  });

  it("publish: creates a prompt with a license reference", async () => {
    const cidWithLic = "QmWithLicenseRef2";
    const licName = "CC-BY-SA-2";
    const [licPda] = findLicensePda(authority, licName);

    await program.methods
      .setLicense(licName, true, true, 0)
      .accounts({
        license: licPda,
        authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const [promptPda] = findPromptPda(cidWithLic);
    await program.methods
      .publish(cidWithLic, metadataUri, licPda)
      .accounts({
        prompt: promptPda,
        authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const prompt = await program.account.prompt.fetch(promptPda);
    expect(prompt.license.toString()).to.equal(licPda.toString());
  });

  it("publish: works with CIDs between 32 and 70 bytes", async () => {
    const longCid = "QmCIDThatIsLongerThan32BytesButStillWithinThe70CharMaxLimit";
    assert.isAtMost(longCid.length, 70);
    assert.isAbove(longCid.length, 32);
    const [promptPda] = findPromptPda(longCid);

    await program.methods
      .publish(longCid, metadataUri, null)
      .accounts({
        prompt: promptPda,
        authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const prompt = await program.account.prompt.fetch(promptPda);
    expect(prompt.ipfsCid).to.equal(longCid);
  });

  it("original_authority never changes after transfer", async () => {
    const transferCid = "QmTransferTestOriginalAuth";
    const [promptPda] = findPromptPda(transferCid);

    await program.methods
      .publish(transferCid, metadataUri, null)
      .accounts({
        prompt: promptPda,
        authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const newOwner = Keypair.generate();
    await program.methods
      .transfer(newOwner.publicKey)
      .accounts({
        prompt: promptPda,
        currentAuthority: authority,
      })
      .rpc();

    const prompt = await program.account.prompt.fetch(promptPda);
    expect(prompt.authority.toString()).to.equal(newOwner.publicKey.toString());
    expect(prompt.originalAuthority.toString()).to.equal(authority.toString());
  });
});
