---
source: "OWASP Secure Coding Practices - Quick Reference Guide"
version: "2.1 (Draft v2.1 - With identities added; pie de página: Version 2.0, November 2010)"
url: "https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/"
license: "CC BY-SA 3.0 - Copyright 2010 The OWASP Foundation"
retrieved_at: "2026-10-30"
category: "access-control"
languages: ["all"]
cwe: []
---

# Access Control

- [77] Use only trusted system objects, e.g. server side session objects, for making access authorization decisions
- [78] Use a single site-wide component to check access authorization. This includes libraries that call external authorization services
- [79] Access controls should fail securely
- [80] Deny all access if the application cannot access its security configuration information
- [81] Enforce authorization controls on every request, including those made by server side scripts, "includes" and requests from rich client-side technologies like AJAX and Flash
- [82] Segregate privileged logic from other application code
- [83] Restrict access to files or other resources, including those outside the application's direct control, to only authorized users
- [84] Restrict access to protected URLs to only authorized users
- [85] Restrict access to protected functions to only authorized users
- [86] Restrict direct object references to only authorized users
- [87] Restrict access to services to only authorized users
- [88] Restrict access to application data to only authorized users
- [89] Restrict access to user and data attributes and policy information used by access controls
- [90] Restrict access security-relevant configuration information to only authorized users
- [91] Server side implementation and presentation layer representations of access control rules must match
- [92] If state data must be stored on the client, use encryption and integrity checking on the server side to catch state tampering.
- [93] Enforce application logic flows to comply with business rules
- [94] Limit the number of transactions a single user or device can perform in a given period of time. The transactions/time should be above the actual business requirement, but low enough to deter automated attacks
- [95] Use the "referer" header as a supplemental check only, it should never be the sole authorization check, as it is can be spoofed
- [96] If long authenticated sessions are allowed, periodically re-validate a user’s authorization to ensure that their privileges have not changed and if they have, log the user out and force them to re- authenticate
- [97] Implement account auditing and enforce the disabling of unused accounts (e.g., After no more than 30 days from the expiration of an account’s password.)
- [98] The application must support disabling of accounts and terminating sessions when authorization ceases (e.g., Changes to role, employment status, business process, etc.)
- [99] Service accounts or accounts supporting connections to or from external systems should have the least privilege possible
- [100] Create an Access Control Policy to document an application's business rules, data types and access authorization criteria and/or processes so that access can be properly provisioned and controlled. This includes identifying access requirements for both the data and system resources
