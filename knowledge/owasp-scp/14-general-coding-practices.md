---
source: "OWASP Secure Coding Practices - Quick Reference Guide"
version: "2.1 (Draft v2.1 - With identities added; pie de página: Version 2.0, November 2010)"
url: "https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/"
license: "CC BY-SA 3.0 - Copyright 2010 The OWASP Foundation"
retrieved_at: "2026-10-30"
category: "general-coding-practices"
languages: ["all"]
cwe: []
---

# General Coding Practices

- [202] Use tested and approved managed code rather than creating new unmanaged code for common tasks
- [203] Utilize task specific built-in APIs to conduct operating system tasks. Do not allow the application to issue commands directly to the Operating System, especially through the use of application initiated command shells
- [204] Use checksums or hashes to verify the integrity of interpreted code, libraries, executables, and configuration files
- [205] Utilize locking to prevent multiple simultaneous requests or use a synchronization mechanism to prevent race conditions
- [206] Protect shared variables and resources from inappropriate concurrent access
- [207] Explicitly initialize all your variables and other data stores, either during declaration or just before the first usage
- [208] In cases where the application must run with elevated privileges, raise privileges as late as possible, and drop them as soon as possible
- [209] Avoid calculation errors by understanding your programming language's underlying representation and how it interacts with numeric calculation. Pay close attention to byte size discrepancies, precision, signed/unsigned distinctions, truncation, conversion and casting between types, "not-a-number" calculations, and how your language handles numbers that are too large or too small for its underlying representation
- [210] Do not pass user supplied data to any dynamic execution function
- [211] Restrict users from generating new code or altering existing code
- [212] Review all secondary applications, third party code and libraries to determine business necessity and validate safe functionality, as these can introduce new vulnerabilities
- [213] Implement safe updating. If the application will utilize automatic updates, then use cryptographic signatures for your code and ensure your download clients verify those signatures. Use encrypted channels to transfer the code from the host server
