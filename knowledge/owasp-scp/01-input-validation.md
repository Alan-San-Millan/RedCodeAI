---
source: "OWASP Secure Coding Practices - Quick Reference Guide"
version: "2.1 (Draft v2.1 - With identities added; pie de página: Version 2.0, November 2010)"
url: "https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/"
license: "CC BY-SA 3.0 - Copyright 2010 The OWASP Foundation"
retrieved_at: "2026-10-30"
category: "input-validation"
languages: ["all"]
cwe: []
---

# Input Validation

- [1] Conduct all data validation on a trusted system (e.g., The server)
- [2] Identify all data sources and classify them into trusted and untrusted. Validate all data from untrusted sources (e.g., Databases, file streams, etc.)
- [3] There should be a centralized input validation routine for the application
- [4] Specify proper character sets, such as UTF-8, for all sources of input
- [5] Encode data to a common character set before validating (Canonicalize)
- [6] All validation failures should result in input rejection
- [7] Determine if the system supports UTF-8 extended character sets and if so, validate after UTF-8 decoding is completed
- [8] Validate all client provided data before processing, including all parameters, URLs and HTTP header content (e.g. Cookie names and values). Be sure to include automated post backs from JavaScript, Flash or other embedded code
- [9] Verify that header values in both requests and responses contain only ASCII characters
- [10] Validate data from redirects (An attacker may submit malicious content directly to the target of the redirect, thus circumventing application logic and any validation performed before the redirect)
- [11] Validate for expected data types
- [12] Validate data range
- [13] Validate data length
- [14] Validate all input against a "white" list of allowed characters, whenever possible
- [15] If any potentially hazardous characters must be allowed as input, be sure that you implement additional controls like output encoding, secure task specific APIs and accounting for the utilization of that data throughout the application . Examples of common hazardous characters include: < > " ' % ( ) & + \ \' \"
- [16] If your standard validation routine cannot address the following inputs, then they should be checked discretely
  - Check for null bytes (%00)
  - Check for new line characters (%0d, %0a, \r, \n)
  - Check for “dot-dot-slash" (../ or ..\) path alterations characters. In cases where UTF-8 extended character set encoding is supported, address alternate representation like: %c0%ae%c0%ae/ (Utilize canonicalization to address double encoding or other forms of obfuscation attacks)
