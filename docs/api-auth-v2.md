# Authentication API v2 Specifications

The V2 Authentication API handles all user sessions across the web and mobile clients. 

## Token Management
To authenticate with any protected V2 endpoint, you must pass a JWT (JSON Web Token) in the `Authorization` header as a Bearer token. 

- **Expiration:** Access tokens expire exactly 60 minutes after issuance.
- **Refresh:** Refresh tokens expire after 7 days of inactivity.

## Common Auth Errors
If you receive a `401 Unauthorized` error, your access token has expired. The client application must automatically call the `/api/v2/auth/refresh` endpoint using the HTTP-only refresh cookie to obtain a new access token.

Do not force the user to log in again unless the `/refresh` endpoint returns a `403 Forbidden` error.