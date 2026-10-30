---
source: "OWASP Secure Coding Practices - Quick Reference Guide"
version: "2.1 (Draft v2.1 - With identities added; pie de página: Version 2.0, November 2010)"
url: "https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/"
license: "CC BY-SA 3.0 - Copyright 2010 The OWASP Foundation"
retrieved_at: "2026-10-30"
category: "cryptographic-practices"
languages: ["all"]
cwe: []
---

# Cryptographic Practices

- [101] All cryptographic functions used to protect secrets from the application user must be implemented on a trusted system (e.g., The server)
- [102] Protect master secrets from unauthorized access
- [103] Cryptographic modules should fail securely
- [104] All random numbers, random file names, random GUIDs, and random strings should be generated using the cryptographic module’s approved random number generator when these random values are intended to be un-guessable
- [105] Cryptographic modules used by the application should be compliant to FIPS 140-2 or an equivalent standard. (See http://csrc.nist.gov/groups/STM/cmvp/validation.html)
- [106] Establish and utilize a policy and process for how cryptographic keys will be managed
