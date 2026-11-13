# Free Render deployment from GitHub

GitHub stores the source; Render runs the Node/WebSocket server and serves the browser app over HTTPS. GitHub Pages alone cannot run this server. Musicians still join by name and room code. Only the person managing hosting needs a Render account.

## First deployment

1. Sign in to [Render](https://dashboard.render.com). If using GitHub sign-in, review and authorize the requested identity permissions. Complete any account terms yourself.
2. Create a **Blueprint** from `https://github.com/TKC-pixel/roomtone-practice-room`, branch `main`, using the root `render.yaml`. If GitHub installation is required, select only this repository.
3. Review the plan: one **Free** Node web service, no paid database, disk or custom domain. The region in the configuration is Frankfurt; change it before initial creation if your group needs another region.
4. Deploy. The build installs locked dependencies and runs syntax/integration checks. The server listens on `0.0.0.0:10000`. Render supplies its HTTPS URL, which the start command sets as `PUBLIC_ORIGIN` for the origin checks.
5. Open the actual `https://...onrender.com` URL shown in the service dashboard. Visit `/health`; it should return `ok: true`. Do not assume the service name guarantees a particular hostname.
6. Join a test room and share that URL with another musician. Verify chat, shared timing, and then audio. Use **Room tools → Connection check** for diagnostics.

If you create a Web Service manually instead of a Blueprint, use these settings:

| Setting | Value |
| --- | --- |
| Repository | `https://github.com/TKC-pixel/roomtone-practice-room` |
| Branch | `main` |
| Runtime | Node |
| Instance | Free |
| Build command | `npm ci && npm run check && npm test` |
| Start command | `PUBLIC_ORIGIN="$RENDER_EXTERNAL_URL" npm start` |
| Health check | `/health` |
| Environment | `NODE_VERSION=24`, `HOST=0.0.0.0`, `PORT=10000`, `MAX_PARTICIPANTS=8`, `ICE_TRANSPORT_POLICY=all` |
| Auto deploy | Off; deploy manually between rehearsals |

Environment variables configured in Render override the committed local `.env` defaults. Do not configure direct certificate/key files on this service: Render terminates HTTPS. For a custom domain, adjust the allowed public origin in the start command/environment to that exact HTTPS origin.

## Free-tier limits

This is a rehearsal preview deployment, not a guaranteed always-on production service. Render's free service sleeps after 15 minutes without incoming HTTP or WebSocket traffic and can take about a minute to wake. The free filesystem is ephemeral: room roles, shared setlists, chat and session history in the JSON store disappear on restart, redeploy or sleep. Keep copies of important setlists. Durable storage requires a separate persistence solution or a paid persistent disk; the current application does not implement an external database adapter.

Render also applies monthly usage limits. Select only Free resources, review account usage/billing limits, and do not authorize paid upgrades. The Blueprint creates no paid resources. Auto-deploy is disabled to avoid deploying a GitHub update in the middle of rehearsal; use **Manual Deploy → Deploy latest commit** when everyone has left.

## Audio connectivity and TURN

WebSocket signaling on Render is not a TURN audio relay. The default STUN configuration can work on permissive networks, but restrictive networks need your own TURN service. Add `ICE_SERVERS_JSON` in Render's environment settings using the structure in [SETUP.md](SETUP.md); keep real relay credentials out of GitHub. No TURN provider or free relay allowance is included in this deployment.

After configuring TURN, temporarily use `ICE_TRANSPORT_POLICY=relay`, redeploy, reconnect two musicians and send audio. Check that the diagnostics show a relay path and received packets. Restore `all` if you want direct connections where possible. Hosting does not remove network/audio-device latency; complete [hardware and network acceptance](TESTING.md) before a full rehearsal.

## References

- [Render free service limits](https://render.com/docs/free)
- [Render WebSocket support](https://render.com/docs/websocket)
- [Blueprint configuration](https://render.com/docs/blueprint-spec)
- [Render environment variables](https://render.com/docs/environment-variables)
