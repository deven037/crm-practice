# CRM staging redeploy and rollback runbook

This runbook covers the frontend at https://automation-crm.netlify.app/ and the API service `crm-practice-api` on Render. Deven owns both hosting services. Use the provider dashboards with an authorized account; do not put credentials or tokens in this repository or ticket comments.

## Before changing staging

1. Agree on the target commit with the release owner. Record its full commit SHA and the PR or release that contains it.
2. Confirm the target branch and deploy trigger in the Netlify site and Render service settings. This repository does not establish which branches are connected or whether deploys are automatic.
3. Check the provider's latest deploy record and save its status and commit/build identifier. If the provider does not expose an identifier, record it as Unknown and ask Deven to confirm. A successful HTTP response alone does not identify the deployed commit.
4. Check the API health endpoint: https://crm-practice-api.onrender.com/api/health. Record the response and time. Do not treat this as proof that the frontend and API are on the intended release.

## Redeploy the frontend (Netlify)

1. In the authorized Netlify dashboard, open the site serving `automation-crm.netlify.app`.
2. Confirm the site's connected repository, production branch, and deploy context with Deven before triggering anything. If a deploy is already running for the agreed commit, monitor that deploy instead of starting a duplicate.
3. When the connected settings are confirmed, use the site's deploy controls to deploy the agreed commit. If the dashboard does not offer that commit or the connected branch is unclear, stop and ask Deven to correct or confirm the site configuration.
4. Wait for the deploy to finish successfully. Record the deploy URL/ID, commit if shown, status, and completion time.
5. Open the staging URL and a nested CRM route directly. The repository's `public/_redirects` rule sends paths to `/index.html` with status 200 so client-side routes can load.
6. Recheck the API health endpoint. Record any failure and contact Deven; do not claim the release is ready based on the frontend response alone.

## Redeploy the API (Render)

1. In the authorized Render dashboard, open the `crm-practice-api` web service and confirm it is the service described by `server/render.yaml` (`rootDir: server`, build `npm install && npm run build`, start `npm start`).
2. Confirm the agreed commit is available in the service's configured branch. Follow the service's current dashboard procedure to deploy that commit; do not change environment variables as part of a redeploy.
3. Monitor the deployment until it reports success. Record the deploy ID, commit if shown, status, and completion time.
4. Request `https://crm-practice-api.onrender.com/api/health` and confirm it responds. If it fails, retain the previous known-good deploy and proceed to rollback.

## Rollback

1. Stop further deploys and record the failing deploy's ID, commit/build ID, status, and observed symptoms.
2. Identify the last known-good deploy from the provider's deploy history. Confirm its commit/build ID with Deven if the dashboard does not show one.
3. In the affected provider dashboard, use its rollback or redeploy control to restore that specific known-good deploy. If the target cannot be identified unambiguously, stop and ask Deven; do not guess a commit.
4. Wait for the provider to report success. Record the restored deploy ID and commit/build ID.
5. Verify the frontend URL and a nested route, and check the API health endpoint. Confirm with the release owner that both services represent the intended compatible release before resuming QA.
6. If rollback does not restore service, leave staging QA paused and contact Deven with the recorded deploy identifiers and health results.

## Release record and QA handoff

For each deploy or rollback, record the service, target commit/build ID (or Unknown), provider deploy ID, status, and timestamp on the release ticket. Tell Quinn the staging URL and whether the deployed identifier matches the agreed release. Keep QA paused while that identity is Unknown or either service fails its health check.

## Repository references

- `server/render.yaml` defines the Render service, build command, start command, and environment variables.
- `server/README.md` describes the Render Blueprint setup.
- `public/_redirects` routes frontend paths to `/index.html`.

These files do not define provider credentials, connected branches, auto-deploy behavior, or the dashboard controls available to an operator. Deven must confirm those account-specific details before the first operation.
