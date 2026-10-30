---
source: "OWASP Secure Coding Practices - Quick Reference Guide"
version: "2.1 (Draft v2.1 - With identities added; pie de página: Version 2.0, November 2010)"
url: "https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/"
license: "CC BY-SA 3.0 - Copyright 2010 The OWASP Foundation"
retrieved_at: "2026-10-30"
category: "output-encoding"
languages: ["all"]
cwe: []
---

# Output Encoding

- [17] Conduct all encoding on a trusted system (e.g., The server)
- [18] Utilize a standard, tested routine for each type of outbound encoding
- [19] Contextually output encode all data returned to the client that originated outside the application's trust boundary. HTML entity encoding is one example, but does not work in all cases
- [20] Encode all characters unless they are known to be safe for the intended interpreter
- [21] Contextually sanitize all output of un-trusted data to queries for SQL, XML, and LDAP
- [22] Sanitize all output of un-trusted data to operating system commands
