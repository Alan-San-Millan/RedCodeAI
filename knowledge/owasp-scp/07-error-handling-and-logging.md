---
source: "OWASP Secure Coding Practices - Quick Reference Guide"
version: "2.1 (Draft v2.1 - With identities added; pie de página: Version 2.0, November 2010)"
url: "https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/"
license: "CC BY-SA 3.0 - Copyright 2010 The OWASP Foundation"
retrieved_at: "2026-10-30"
category: "error-handling-and-logging"
languages: ["all"]
cwe: []
---

# Error Handling and Logging

- [107] Do not disclose sensitive information in error responses, including system details, session identifiers or account information
- [108] Use error handlers that do not display debugging or stack trace information
- [109] Implement generic error messages and use custom error pages
- [110] The application should handle application errors and not rely on the server configuration
- [111] Properly free allocated memory when error conditions occur
- [112] Error handling logic associated with security controls should deny access by default
- [113] All logging controls should be implemented on a trusted system (e.g., The server)
- [114] Logging controls should support both success and failure of specified security events
- [115] Ensure logs contain important log event data
- [116] Ensure log entries that include un-trusted data will not execute as code in the intended log viewing interface or software
- [117] Restrict access to logs to only authorized individuals
- [118] Utilize a master routine for all logging operations
- [119] Do not store sensitive information in logs, including unnecessary system details, session identifiers or passwords
- [120] Ensure that a mechanism exists to conduct log analysis
- [121] Log all input validation failures
- [122] Log all authentication attempts, especially failures
- [123] Log all access control failures
- [124] Log all apparent tampering events, including unexpected changes to state data
- [125] Log attempts to connect with invalid or expired session tokens
- [126] Log all system exceptions
- [127] Log all administrative functions, including changes to the security configuration settings
- [128] Log all backend TLS connection failures
- [129] Log cryptographic module failures
- [130] Use a cryptographic hash function to validate log entry integrity
