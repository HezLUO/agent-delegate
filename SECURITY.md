# Security Policy

`agent-delegate` is local-first and should not store source file contents or complete command output by default.

## Reporting Security Issues

Before a public repository and private advisory process exist, do not file sensitive vulnerabilities in public issues.

For now, report suspected security issues directly to the project maintainer through a private channel.

## Scope

Security-sensitive areas include:

- Secret-like content detection and rejection.
- MCP stdio behavior.
- Local session event storage.
- Generated brief content that might accidentally request write access in v1.

## Supported Versions

No public release has been published yet. Security support begins with the first public release.
