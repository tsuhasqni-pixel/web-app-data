# Cloudflare deployment gate

Target Worker/project name: `web-app-data`.

The application is a Vite build, so Workers Builds must execute:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

`wrangler.jsonc` points `assets.directory` to `./dist`. The repository CI performs `npx wrangler deploy --dry-run` only; it does not publish.

## Account separation rule

The old Cloudflare account and the new Cloudflare account are independent deployment targets. Never infer the account from project names. Before any live deployment, verify the account containing the intended `web-app-data` Worker and its GitHub integration. If repository cloning fails, resolve GitHub installation/access first; build and Wrangler settings are downstream and cannot be evaluated until cloning succeeds.

## Headless deployment option
If Cloudflare's direct Git clone/OAuth path remains unreliable, use `GitHub Actions → Wrangler → Cloudflare` with a narrowly scoped Cloudflare API token stored only in GitHub Secrets. This is deployment authentication, not end-user login. Keep production branch/main merge gated on preview and E2E success.
