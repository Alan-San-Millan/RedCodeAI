---
source: "OWASP Secure Coding Practices - Quick Reference Guide"
version: "2.1 (Draft v2.1 - With identities added; pie de página: Version 2.0, November 2010)"
url: "https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/"
license: "CC BY-SA 3.0 - Copyright 2010 The OWASP Foundation"
retrieved_at: "2026-10-30"
category: "memory-management"
languages: ["all"]
cwe: []
---

# Memory Management

- [194] Utilize input and output control for un-trusted data
- [195] Double check that the buffer is as large as specified
- [196] When using functions that accept a number of bytes to copy, such as strncpy(), be aware that if the destination buffer size is equal to the source buffer size, it may not NULL-terminate the string
- [197] Check buffer boundaries if calling the function in a loop and make sure there is no danger of writing past the allocated space
- [198] Truncate all input strings to a reasonable length before passing them to the copy and concatenation functions
- [199] Specifically close resources, don’t rely on garbage collection. (e.g., connection objects, file handles, etc.)
- [200] Use non-executable stacks when available
- [201] Avoid the use of known vulnerable functions (e.g., printf, strcat, strcpy etc.)
- [202] Properly free allocated memory upon the completion of functions and at all exit points
