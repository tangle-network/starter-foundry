# Passkey Onboarding Capability
The passkey onboarding capability provides a seamless WebAuthn passkey-based sign-in and account creation flow. It includes passkey registration UI, biometric-gated sign-in, and a recovery flow.

## Overview
This capability is designed to enhance the security and usability of authentication processes in applications. By leveraging WebAuthn standards, it enables users to securely authenticate using passkeys, which are resistant to phishing and other types of attacks.

## Applies To
The passkey onboarding capability applies to the following families:
- nextjs-ts
- react-vite-ts
- kyc-onboarding

## Use Cases
- Implementing secure and user-friendly authentication flows in web applications.
- Enhancing account creation processes with passkey registration.
- Providing biometric-gated sign-in for an additional layer of security.
- Offering a recovery flow for users who encounter issues during the sign-in process.

## Extension Points
- Customizing the passkey registration UI to fit specific application branding and requirements.
- Integrating the biometric-gated sign-in with existing authentication systems.
- Developing additional recovery flow mechanisms tailored to specific user needs.

## Gotchas
- Ensuring compatibility with various browsers and devices that support WebAuthn.
- Handling potential issues with biometric authentication, such as false negatives or positives.
- Implementing proper security measures to protect user passkeys and sensitive information.

## Peer Capabilities
The passkey onboarding capability can be used in conjunction with other capabilities, such as:
- Agent Intel for AI-powered data intelligence.
- AI Agent Dashboard for agent observability.
- AI Agent Orchestrator for multi-agent orchestration.
- AI Chat Sessions for managing chat conversations.
- AI Chat UI for streaming AI chat interfaces.

By combining these capabilities, developers can create comprehensive and secure applications that leverage the latest advancements in authentication, AI, and user experience.