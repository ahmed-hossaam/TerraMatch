import { createHash } from "node:crypto";

export const PRESERVED_PRODUCTION_ARTIFACT_KEY = "evidence/m2/raw/georoc/ETN-SDV-1-FEOT.csv";

/**
 * Permit the known Production incident key to remain on its existing
 * immutable version only when metadata and a private Blob readback agree.
 * A valid but different repository version is recorded, never written over it.
 */
export async function verifyExistingImmutableArtifact({ store, key, repositoryBytes }) {
  if (!store || key !== PRESERVED_PRODUCTION_ARTIFACT_KEY) return null;
  const { rows } = await store.pool.query(
    "SELECT sha256, byte_size, immutable FROM terramatch_artifacts WHERE artifact_key = $1",
    [key],
  );
  const row = rows[0];
  if (!row || row.immutable !== true) return null;

  const persistedBytes = await store.readBytes(key);
  const persistedHash = createHash("sha256").update(persistedBytes).digest("hex");
  const metadataSize = Number(row.byte_size);
  if (persistedBytes.byteLength !== metadataSize || persistedHash !== row.sha256) return null;

  return {
    key,
    preservedSha256: row.sha256,
    preservedByteSize: metadataSize,
    repositorySha256: createHash("sha256").update(repositoryBytes).digest("hex"),
    repositoryByteSize: repositoryBytes.byteLength,
    existingBlobVerified: true,
  };
}
