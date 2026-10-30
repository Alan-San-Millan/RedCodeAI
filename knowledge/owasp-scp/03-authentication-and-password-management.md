---
source: "OWASP Secure Coding Practices - Quick Reference Guide"
version: "2.1 (Draft v2.1 - With identities added; pie de página: Version 2.0, November 2010)"
url: "https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/"
license: "CC BY-SA 3.0 - Copyright 2010 The OWASP Foundation"
retrieved_at: "2026-10-30"
category: "authentication-and-password-management"
languages: ["all"]
cwe: []
---

# Authentication and Password Management

- [23] Require authentication for all pages and resources, except those specifically intended to be public
- [24] All authentication controls must be enforced on a trusted system (e.g., The server)
- [25] Establish and utilize standard, tested, authentication services whenever possible
- [26] Use a centralized implementation for all authentication controls, including libraries that call external authentication services
- [27] Segregate authentication logic from the resource being requested and use redirection to and from the centralized authentication control
- [28] All authentication controls should fail securely
- [29] All administrative and account management functions must be at least as secure as the primary authentication mechanism
- [30] If your application manages a credential store, it should ensure that only cryptographically strong one-way salted hashes of passwords are stored and that the table/file that stores the passwords and keys is write-able only by the application. (Do not use the MD5 algorithm if it can be avoided)
- [31] Password hashing must be implemented on a trusted system (e.g., The server).
- [32] Validate the authentication data only on completion of all data input, especially for sequential authentication implementations
- [33] Authentication failure responses should not indicate which part of the authentication data was incorrect. For example, instead of "Invalid username" or "Invalid password", just use "Invalid username and/or password" for both. Error responses must be truly identical in both display and source code
- [34] Utilize authentication for connections to external systems that involve sensitive information or functions
- [35] Authentication credentials for accessing services external to the application should be encrypted and stored in a protected location on a trusted system (e.g., The server). The source code is NOT a secure location
- [36] Use only HTTP POST requests to transmit authentication credentials
- [37] Only send non-temporary passwords over an encrypted connection or as encrypted data, such as in an encrypted email. Temporary passwords associated with email resets may be an exception
- [38] Enforce password complexity requirements established by policy or regulation. Authentication credentials should be sufficient to withstand attacks that are typical of the threats in the deployed environment. (e.g., requiring the use of alphabetic as well as numeric and/or special characters)
- [39] Enforce password length requirements established by policy or regulation. Eight characters is commonly used, but 16 is better or consider the use of multi-word pass phrases
- [40] Password entry should be obscured on the user's screen. (e.g., on web forms use the input type "password")
- [41] Enforce account disabling after an established number of invalid login attempts (e.g., five attempts is common). The account must be disabled for a period of time sufficient to discourage brute force guessing of credentials, but not so long as to allow for a denial-of-service attack to be performed
- [42] Password reset and changing operations require the same level of controls as account creation and authentication.
- [43] Password reset questions should support sufficiently random answers. (e.g., "favorite book" is a bad question because “The Bible” is a very common answer)
- [44] If using email based resets, only send email to a pre-registered address with a temporary link/password
- [45] Temporary passwords and links should have a short expiration time
- [46] Enforce the changing of temporary passwords on the next use
- [47] Notify users when a password reset occurs
- [48] Prevent password re-use
- [49] Passwords should be at least one day old before they can be changed, to prevent attacks on password re-use
- [50] Enforce password changes based on requirements established in policy or regulation. Critical systems may require more frequent changes. The time between resets must be administratively controlled
- [51] Disable "remember me" functionality for password fields
- [52] The last use (successful or unsuccessful) of a user account should be reported to the user at their next successful login
- [53] Implement monitoring to identify attacks against multiple user accounts, utilizing the same password. This attack pattern is used to bypass standard lockouts, when user IDs can be harvested or guessed
- [54] Change all vendor-supplied default passwords and user IDs or disable the associated accounts
- [55] Re-authenticate users prior to performing critical operations
- [56] Use Multi-Factor Authentication for highly sensitive or high value transactional accounts
- [57] If using third party code for authentication, inspect the code carefully to ensure it is not affected by any malicious code
