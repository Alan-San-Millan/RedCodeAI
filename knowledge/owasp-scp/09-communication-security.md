---
source: "OWASP Secure Coding Practices - Quick Reference Guide"
version: "2.1 (Draft v2.1 - With identities added; pie de página: Version 2.0, November 2010)"
url: "https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/"
license: "CC BY-SA 3.0 - Copyright 2010 The OWASP Foundation"
retrieved_at: "2026-10-30"
category: "communication-security"
languages: ["all"]
cwe: []
---

# Communication Security

- [143] Implement encryption for the transmission of all sensitive information. This should include TLS for protecting the connection and may be supplemented by discrete encryption of sensitive files or non-HTTP based connections
- [144] TLS certificates should be valid and have the correct domain name, not be expired, and be installed with intermediate certificates when required
- [145] Failed TLS connections should not fall back to an insecure connection
- [146] Utilize TLS connections for all content requiring authenticated access and for all other sensitive information
- [147] Utilize TLS for connections to external systems that involve sensitive information or functions
- [148] Utilize a single standard TLS implementation that is configured appropriately
- [149] Specify character encodings for all connections
- [150] Filter parameters containing sensitive information from the HTTP referer, when linking to external sites
