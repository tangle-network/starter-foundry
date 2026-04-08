# Publishing `@tangle-network/starter-foundry`

The package publishes to npm via `.github/workflows/publish.yml` on
`git tag v*` push. Two authentication paths are supported, in priority
order:

1. **OIDC trusted publishing (preferred — set this up once)**
2. NPM_TOKEN secret (legacy fallback, remove once OIDC is live)

This document walks through both. Read the OIDC section first; the
fallback exists only because the very first publish from a fresh
repo can't use OIDC until the trusted-publisher entry is created on
npmjs.org, and that entry can only be created against an existing
package.

---

## OIDC trusted publishing setup (one-time)

### Prerequisites

- The package must already exist on npmjs.org with at least one
  published version (so you have an "Access" tab to configure on
  the package settings page). For starter-foundry the existing 0.1
  / 0.2 / 0.3 versions satisfy this.
- You need owner / maintainer permissions on the package. If you're
  not sure, run `npm owner ls @tangle-network/starter-foundry` and
  check that your username is in the list.
- The github repository must be public OR the npm package must be
  on a paid org plan that supports private trusted publishing.
  starter-foundry is public, so this is fine.

### Steps

1. Sign in to https://www.npmjs.com with the account that owns
   `@tangle-network/starter-foundry`.

2. Navigate to:
   https://www.npmjs.com/package/@tangle-network/starter-foundry/access

3. Scroll to the **"Trusted publishers"** section and click
   **"Add trusted publisher"**.

4. Choose **"GitHub Actions"** as the publisher type.

5. Fill in the form:

   | Field | Value |
   |---|---|
   | **Organization or user** | `tangle-network` |
   | **Repository** | `starter-foundry` |
   | **Workflow filename** | `publish.yml` |
   | **Environment name** | *(leave blank)* |

   The workflow filename is the file name relative to
   `.github/workflows/`, NOT the full path. We use `publish.yml`,
   not `.github/workflows/publish.yml`.

   The environment name should be left blank unless you've set up
   a Github environment for production publishes. If you do set
   one, the workflow's `jobs.publish` block needs `environment:
   production` (or whatever the name is) to match.

6. Click **"Add publisher"**.

### Verify

After saving, the trusted publisher entry should appear in the list
on the package's Access page. The next `npm publish` from the
release workflow will use OIDC automatically — no NPM_TOKEN
required.

You can verify by:

1. Tagging a new release: `git tag v0.5.1 && git push origin main --tags`
2. Watching the workflow run in Github Actions
3. Confirming the "Publish to npm" step succeeds without consuming
   the NPM_TOKEN secret (the workflow log will show
   `npm notice Publishing to https://registry.npmjs.org/ with tag
   latest using trusted publisher OIDC`)

Once verified, the NPM_TOKEN repository secret can be deleted from
Settings → Secrets and Variables → Actions.

---

## NPM_TOKEN fallback (legacy)

For the very first publish, or if OIDC trusted publishing hasn't
been configured yet:

1. Sign in to https://www.npmjs.com.
2. Navigate to your account settings → **Access tokens**.
3. Click **"Generate new token"** → **"Granular Access Token"**.
4. Configure:
   - **Token name**: `starter-foundry github actions`
   - **Expiration**: 1 year (or shorter)
   - **Packages and scopes**: `@tangle-network/starter-foundry` only,
     `read and write`
   - **Allowed IP ranges**: leave blank (Github Actions IPs change)
5. Generate the token. Copy it immediately — you can't view it
   again.
6. In the starter-foundry repo settings → Secrets and Variables →
   Actions → New repository secret:
   - Name: `NPM_TOKEN`
   - Value: paste the token from step 5
7. Save.

The release workflow will fall back to this token if OIDC isn't
configured. Rotate or delete the token once OIDC is live.

---

## Cutting a release

Once authentication is set up (either path):

```bash
# 1. Bump the version
npm version 0.5.1 --no-git-tag-version
git add package.json
git commit -m "chore: release v0.5.1"

# 2. Tag and push
git tag v0.5.1
git push origin main --tags

# 3. Watch the workflow run
gh run watch
```

The workflow:

1. Checks out the repo
2. Verifies `package.json` version matches the tag
3. Builds (`npm run build`)
4. Packs the tarball (so any failure surfaces before publish)
5. Publishes to npm with `--provenance --access public` (OIDC if
   configured, NPM_TOKEN otherwise)
6. Creates a Github release with auto-generated notes
7. Attaches the tarball to the release

If any step fails, the publish is skipped and the workflow exits
non-zero. Re-running after fixing the issue is safe — npm will
reject duplicate version publishes, so partial state is impossible.

---

## Why provenance attestation matters

The `--provenance` flag attaches a sigstore attestation to every
published tarball. The attestation cryptographically links the
published artifact back to the exact git commit, workflow run, and
runner that produced it. Consumers (including blueprint-agent) can
verify this with:

```bash
npm view @tangle-network/starter-foundry --json | jq '.dist'
```

The output includes a `signatures` array and (for npm CLI 9.5+)
provenance metadata. Without provenance, supply-chain attacks are
indistinguishable from legitimate publishes. With provenance, an
attacker would need to compromise the github org AND the workflow
file AND get past the sigstore log AND trick consumers into
accepting an unattested update.

The workflow forces this on every publish — it cannot be disabled
without editing the workflow file in a commit that itself becomes
part of the attestation chain.
