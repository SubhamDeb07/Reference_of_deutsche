# Authentication Flow Using JWT and Refresh Tokens

## Overview

This document outlines the authentication flow implemented in the backend application, utilizing JWT for access tokens and refresh tokens for maintaining sessions securely. The system leverages MongoDB for storing token-related data.

### Authentication Process

#### 1. User Credentials Submission

- **Action**: Users initiate the login process by submitting their email and password through the login API endpoint.

#### 2. Credentials Validation

- **Action**: The system validates the submitted credentials against the stored user data.
- **Success Criteria**: The password must correctly match the stored password for the provided email.

#### 3. Token Generation

- **Action**: Upon successful validation, the system generates two types of tokens:
  - **Primary Token (Access Token)**: Used for accessing secured endpoints. It has a shorter expiry period and must be included in the authorization header as a Bearer Token for subsequent requests.
  - **Secondary Token (Refresh Token)**: Used to request a new access token once the current access token expires. It has a longer lifespan than the access token.

#### 4. Token Storage

- **Action**: Both tokens are stored in a MongoDB collection named `keystore`.
- **Stored Details**:
  - `client`: Identifier of the client device or session.
  - `primaryKey`: The generated access token.
  - `secondaryKey`: The generated refresh token.
  - `status`: Current status of the tokens (e.g., active, expired).

#### 5. Token Transmission to Client

- **Action**: The system sends both the Primary (Access) and Secondary (Refresh) Tokens back to the client through a secure channel.

#### 6. Access Token Usage

- **Action**: The client must include the Access Token in the HTTP Authorization header as a Bearer Token for each API request.
- **Header Format**: `Authorization: Bearer <access_token>`

#### 7. Middleware Token Validation

- **Action**: For every secured API request, middleware on the server validates the Access Token.
- **Failure Handling**: If the token is invalid or expired, the request is rejected with an appropriate error message indicating authentication failure.

#### 8. Refresh Token Mechanism

- **Action**: If the Access Token is expired, the client can request a new set of tokens using the Refresh Token.
- **Process**:
  - Client sends the Refresh Token to a specific API endpoint designed for token renewal.
  - Server validates the Refresh Token and generates a new set of Primary and Secondary Tokens if the Refresh Token is valid.

#### 9. Logout Process

- **Action**: Users can terminate their session by invoking the logout API endpoint.
- **Process**:
  - The client sends a request to the logout endpoint.
  - **Server Action**: Upon receiving the logout request, the server will delete the document from the `keystore` collection that matches the provided `client` identifier (`_id`) of loggedin user.
  - This action effectively revokes all issued tokens by removing them from the database, ensuring that they cannot be used for further API requests.
- **Response**: The server confirms the successful deletion of the token records and sends a response indicating that the user has been successfully logged out.
