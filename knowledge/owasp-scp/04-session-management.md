---
source: "OWASP Secure Coding Practices - Quick Reference Guide"
version: "2.1 (Draft v2.1 - With identities added; pie de página: Version 2.0, November 2010)"
url: "https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/"
license: "CC BY-SA 3.0 - Copyright 2010 The OWASP Foundation"
retrieved_at: "2026-10-30"
category: "session-management"
languages: ["all"]
cwe: []
---

# Session Management

- [58] Use the server or framework’s session management controls. The application should only recognize these session identifiers as valid
- [59] Session identifier creation must always be done on a trusted system (e.g., The server)
- [60] Session management controls should use well vetted algorithms that ensure sufficiently random session identifiers
- [61] Set the domain and path for cookies containing authenticated session identifiers to an appropriately restricted value for the site
- [62] Logout functionality should fully terminate the associated session or connection
- [63] Logout functionality should be available from all pages protected by authorization
- [64] Establish a session inactivity timeout that is as short as possible, based on balancing risk and business functional requirements. In most cases it should be no more than several hours
- [65] Disallow persistent logins and enforce periodic session terminations, even when the session is active. Especially for applications supporting rich network connections or connecting to critical systems. Termination times should support business requirements and the user should receive sufficient notification to mitigate negative impacts
- [66] If a session was established before login, close that session and establish a new session after a successful login
- [67] Generate a new session identifier on any re-authentication
- [68] Do not allow concurrent logins with the same user ID
- [69] Do not expose session identifiers in URLs, error messages or logs. Session identifiers should only be located in the HTTP cookie header. For example, do not pass session identifiers as GET parameters
- [70] Protect server side session data from unauthorized access, by other users of the server, by implementing appropriate access controls on the server
- [71] Generate a new session identifier and deactivate the old one periodically. (This can mitigate certain session hijacking scenarios where the original identifier was compromised)
- [72] Generate a new session identifier if the connection security changes from HTTP to HTTPS, as can occur during authentication. Within an application, it is recommended to consistently utilize HTTPS rather than switching between HTTP to HTTPS.
- [73] Supplement standard session management for sensitive server-side operations, like account management, by utilizing per-session strong random tokens or parameters. This method can be used to prevent Cross Site Request Forgery attacks
- [74] Supplement standard session management for highly sensitive or critical operations by utilizing per-request, as opposed to per-session, strong random tokens or parameters
- [75] Set the "secure" attribute for cookies transmitted over an TLS connection
- [76] Set cookies with the HttpOnly attribute, unless you specifically require client-side scripts within your application to read or set a cookie's value
