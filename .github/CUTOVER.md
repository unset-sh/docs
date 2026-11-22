# Switch to organisation documentation

The existing site stays live until the first real organisation export is ready. Prepare and review each change before stopping the app mirror. A local preview or fixture build is not proof that a source can publish autonomously.

## Changes and access

- Framework: [docs PR #1](https://github.com/unset-sh/docs/pull/1), including removal of the legacy `unset/` copy.
- First source: [profile-recipes PR #5](https://github.com/unset-sh/profile-recipes/pull/5), which owns the pages and its exporter. Its job may replace only `profile-recipes/` in this repository. See its [publishing setup guide](https://github.com/unset-sh/profile-recipes/blob/b7429f9bc8f3c50ab4231b5298321880fecc929a/.github/DOCS-PUBLISHING.md).
- App: [retirement PR #1987](https://github.com/Undefined6799/unset/pull/1987) removes its mirror workflow and exporter. Keep the app's own documentation and local site checks.
- Map: reconcile [organisation map PR #5](https://github.com/unset-sh/.github/pull/5) with the move of shared automation into `unset-sh/tooling`; `.github` retains the organisation map and community defaults. Do not merge obsolete ownership descriptions.

The owner configures the source's `docs-mirror` environment for `main` only and its `DOCS_DEPLOY_KEY` secret. The corresponding public key needs write access on `unset-sh/docs`. Never print, commit, or copy private key material through a review or chat.

The shared [publishing-key procedure](https://github.com/unset-sh/tooling/blob/838a965d14d0887291046c279422becb7b0228f3/docs/site/manage-docs-publishing-key.md) lives in `tooling` alongside the maintained workflow documentation. That procedure does not give the tooling documentation exporter write access: its reusable workflow only prepares an artifact. Use it for key setup, verification, rotation, retirement and local cleanup; source runbooks own their exporter-specific details.

The existing app key could be reused for the same destination if the owner still has its private half and chooses to configure it in the source. GitHub does not return stored secret values. A separate source key allows the app key to be revoked independently. If the key is reused, do not delete that shared key during app cleanup.

A deploy key is not scoped to a folder. The source exporter must constrain and check its changed paths, and must use normal pushes so concurrent updates cannot be overwritten. The root build needs no deploy key: public brand and map reads need no stored credential, and Pages provides the deployment permissions to its separate job.

## Cutover order

1. Verify the source exporter and framework checks at their reviewed commits. Merge the source change, configure its access, and let its `main` job publish the real section into `unset-sh/docs`.
2. Confirm that successful source run, inspect its destination commit, and verify it changes only `profile-recipes/`. A job skipped for missing access does not satisfy this prerequisite.
3. Merge the app-mirror retirement. Confirm no old mirror job is queued or running; cancel any such run. Before the root merge, the owner must remove the app's credential access: revoke its old destination key if the new source has a separate key, or remove the app's environment secret if the destination key is reused. Old runs can be rerun with their original commit, so deleting the workflow alone does not prevent an old root-writing exporter from being invoked. See [GitHub's rerun behaviour](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs).
4. Bring the current docs `main`, including the source's exported section, into the framework branch. Resolve framework changes without modifying the source-owned export. Confirm `unset/` is absent and the aligned map describes current and pending work accurately.
5. Run `npm run check`, both build modes, and `bash scripts/build.sh --publish`. The publication build must render the real source's landing page. Obtain independent review and green PR checks for the final commit.
6. Merge the framework through its PR. The `main` push runs the site build and its separate Pages deployment. Keep the previous Pages deployment available until the new site is verified.
7. Verify the live pages below. Remove any remaining empty app environment after its credential access has been retired. Retain the new source's key and environment.

## Verify the published result

- `https://docs.unset.sh/` and `/profile-recipes/` return successfully with a valid certificate. HTTP redirects to HTTPS, preserving the path. Pages must have HTTPS enforcement enabled; account for any earlier cached HTTP response.
- The organisation page shows the intended source commit and the current ownership map. The external app is context only; its old `/unset/` documentation is absent.
- The brand provenance at `/_brand/provenance.json` records the installed version, exact source archive, integrity and framework commit. Fonts and styles come from that verified package.
- Navigation, search, copy controls, light and dark themes, and narrow layouts work. Browser policy errors and broken local links are absent.
- Pages retain `noindex,nofollow`, same-origin assets, and no login, cookies or analytics.
- A subsequent source documentation change updates only its section; the resulting docs push rebuilds successfully. Failed source or site checks leave the previously published site available.

Record the source run, destination commit, app-retirement merge, final framework commit, Pages run, and live verification in the cutover PR. Do not describe this checklist as completed without those results.

## Recovery

Before the root merge, a failed prerequisite leaves the current site live. Fix access or the export in its owning repository; keep the app mirror until the first source is ready. If the app mirror has already been stopped, the last deployed site remains available while the framework is repaired.

After the root merge, fix a failing build through a framework PR or revert the failing framework change to a verified organisation-site commit. Avoid restoring the app mirror or legacy root files over the new framework. A successful deployment with a rendering regression needs a reviewed fix or a verified earlier organisation-site build. Rerunning an entire workflow resolves the current compatible brand release and organisation map again, so it is not an exact replay of the previous artifact. Check the resulting artifact and provenance before restoring it.

If a source export is faulty, repair the owning source and export again. Do not hand-edit its mirrored pages here. If a brand release fails validation, the publishing run stops and the current site remains live; changing the accepted release line or relaxing rollback checks requires review.
