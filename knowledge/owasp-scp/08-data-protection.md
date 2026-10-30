---
source: "OWASP Secure Coding Practices - Quick Reference Guide"
version: "2.1 (Draft v2.1 - With identities added; pie de página: Version 2.0, November 2010)"
url: "https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/"
license: "CC BY-SA 3.0 - Copyright 2010 The OWASP Foundation"
retrieved_at: "2026-10-30"
category: "data-protection"
languages: ["all"]
cwe: []
---

# Data Protection

- [131] Implement least privilege, restrict users to only the functionality, data and system information that is required to perform their tasks
- [132] Protect all cached or temporary copies of sensitive data stored on the server from unauthorized access and purge those temporary working files a soon as they are no longer required.
- [133] Encrypt highly sensitive stored information, like authentication verification data, even on the server side. Always use well vetted algorithms, see "Cryptographic Practices" for additional guidance
- [134] Protect server-side source-code from being downloaded by a user
- [135] Do not store passwords, connection strings or other sensitive information in clear text or in any non-cryptographically secure manner on the client side. This includes embedding in insecure formats like: MS viewstate, Adobe flash or compiled code
- [136] Remove comments in user accessible production code that may reveal backend system or other sensitive information
- [137] Remove unnecessary application and system documentation as this can reveal useful information to attackers
- [138] Do not include sensitive information in HTTP GET request parameters
- [139] Disable auto complete features on forms expected to contain sensitive information, including authentication
- [140] Disable client side caching on pages containing sensitive information. Cache-Control: no-store, may be used in conjunction with the HTTP header control "Pragma: no-cache", which is less effective, but is HTTP/1.0 backward compatible
- [141] The application should support the removal of sensitive data when that data is no longer required. (e.g. personal information or certain financial data)
- [142] Implement appropriate access controls for sensitive data stored on the server. This includes cached data, temporary files and data that should be accessible only by specific system users
