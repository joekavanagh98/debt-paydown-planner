// Run by the root package.json's preinstall hook. Blocks any
// `npm install` that lands at the repo root (where a stray install
// would create a node_modules outside any version folder).
//
// Each version folder has its own package.json; that is where the
// real installs belong. Update the example version below if v5 is
// no longer the active focus.

const ACTIVE_VERSION = "v5-backend";

console.error(`
  npm install must be run inside a version folder, not the repo root.

  Recovery (paste this):
    cd ${ACTIVE_VERSION} && npm install

  (Replace ${ACTIVE_VERSION} with whatever version folder you are
  working on.)
`);

process.exit(1);
