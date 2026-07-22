import { Program } from "@coral-xyz/anchor";
import { getProvider } from "../index";
import idl from "../idl/promptchain.json";

export async function licenseCommand(options: {
  keypair?: string;
  rpcUrl: string;
}): Promise<void> {
  try {
    const provider = await getProvider(options.keypair, options.rpcUrl);
    const authority = provider.wallet.publicKey;
    const program = new Program(idl as any, provider) as any;

    const licenses = await program.account.license.all([
      {
        memcmp: {
          offset: 8,
          bytes: authority.toBase58(),
        },
      },
    ]);

    if (licenses.length === 0) {
      console.log("No licenses found.");
      console.log("\nTo create a license, use:");
      console.log(`  promptchain set-license --name "MIT" --commercial --attribution --royalty 0`);
      return;
    }

    console.log(`Licenses for ${authority.toBase58()}:\n`);
    for (const l of licenses) {
      console.log(`  Name:                ${(l.account as any).name}`);
      console.log(`  Address:             ${l.publicKey.toBase58()}`);
      console.log(`  Commercial Allowed:  ${(l.account as any).commercialAllowed}`);
      console.log(`  Attribution Required: ${(l.account as any).attributionRequired}`);
      console.log(`  Royalty BP:          ${(l.account as any).royaltyBasisPoints}`);
      console.log();
    }
  } catch (err) {
    console.error("Failed to list licenses:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
