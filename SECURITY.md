# PADQ Security Policy

## Supported versions

Security updates are provided for the latest publicly deployed PADQ V1 release.
Pre-release builds, archived branches, forks, and older deployments are not
supported unless the same issue also affects the current production version.

## Report a vulnerability privately

Please report suspected vulnerabilities through
[GitHub private vulnerability reporting](https://github.com/Sceyo/PadQ/security/advisories/new).

Do **not** open a public GitHub issue, discussion, or pull request for a suspected
security vulnerability. A public report may expose PADQ users before a fix is
available.

Include the following when possible:

- A clear description of the issue and its potential impact.
- The affected page, feature, commit, or production URL.
- Reproduction steps or a minimal proof of concept.
- Relevant browser, device, and network details.
- Any suggested mitigation, if known.

Do not include real player information, authentication tokens, Firebase keys
that are not already public client configuration, or other sensitive data in
the report. If a secret is discovered, describe where it was found without
reposting its value.

## Response expectations

- PADQ aims to acknowledge a complete report within 72 hours.
- The reporter should receive a status update at least every seven days while a
  confirmed issue is being investigated.
- Fix and disclosure timing depends on severity, reproducibility, and the risk
  to active sessions.
- PADQ does not currently operate a paid bug-bounty program.

## Good-faith research

Good-faith testing must avoid privacy violations, data destruction, service
disruption, social engineering, physical attacks, automated traffic that could
exhaust Firebase Spark or Vercel Hobby quotas, and access to sessions or data
that the researcher does not own or have permission to test.

Stop testing and report the issue if you encounter private player data, gain
unauthorized write access, or could affect an active event. Use test rooms and
test data wherever possible.

## Coordinated disclosure

Please allow reasonable time for investigation and remediation before public
disclosure. PADQ will coordinate disclosure details with the reporter after the
risk to users has been addressed.
