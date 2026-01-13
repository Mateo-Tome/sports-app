/**
 * functions/backfill-shareIndex.js
 *
 * One-time script to backfill: shareIndex/{shareId}
 * from existing videos/{videoId} docs that already have shareId.
 *
 * Setup (recommended):
 *   1) Download a Firebase Admin SDK service account key JSON (see steps below)
 *   2) Save it as: functions/serviceAccountKey.json
 *
 * Run:
 *   cd functions
 *   node backfill-shareIndex.js
 */

const path = require("path");
const admin = require("firebase-admin");

// ---- Configure service account path (recommended local run) ----
const keyPath = path.join(__dirname, "serviceAccountKey.json");

// This will throw a clear error if the file is missing
let serviceAccount;
try {
  serviceAccount = require(keyPath);
} catch (e) {
  console.error("\n❌ Missing service account key file.");
  console.error("Create/download it and save it here:\n  " + keyPath + "\n");
  console.error("Then run again:\n  cd functions && node backfill-shareIndex.js\n");
  process.exit(1);
}

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

function cleanShareId(v) {
  return (v ?? "").toString().trim();
}

async function run() {
  console.log("Backfill starting...");
  console.log("Using project_id:", serviceAccount.project_id || "(unknown)");
  console.log("Reading videos collection...");

  const snap = await db.collection("videos").get();

  let total = 0;
  let withShareId = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of snap.docs) {
    total++;

    const v = doc.data() || {};
    const shareId = cleanShareId(v.shareId);

    if (!shareId) {
      skipped++;
      continue;
    }

    withShareId++;

    const ref = db.doc(`shareIndex/${shareId}`);

    try {
      const existing = await ref.get();

      const payload = {
        videoId: doc.id,
        ownerUid: v.ownerUid || null,
        isPublic: v.isPublic === true,
        updatedAt: Date.now(),
      };

      if (!existing.exists) {
        await ref.set({ ...payload, createdAt: Date.now() }, { merge: true });
        created++;
        console.log(`[CREATE] shareIndex/${shareId} -> videoId=${doc.id}`);
      } else {
        await ref.set(payload, { merge: true });
        updated++;
        console.log(`[UPDATE] shareIndex/${shareId} -> videoId=${doc.id}`);
      }
    } catch (e) {
      errors++;
      console.error(`[ERROR] shareId=${shareId} videoId=${doc.id}`, e?.message || e);
    }
  }

  console.log("---- Backfill complete ----");
  console.log("total videos:", total);
  console.log("videos w/ shareId:", withShareId);
  console.log("created shareIndex:", created);
  console.log("updated shareIndex:", updated);
  console.log("skipped (no shareId):", skipped);
  console.log("errors:", errors);

  process.exit(errors > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error("Backfill failed:", e?.message || e);
  process.exit(1);
});
