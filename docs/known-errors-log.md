# Known Errors and Troubleshooting Log

This document tracks common production errors and the standard operating procedures to resolve them.

## Error: 409 Conflict on User Registration
**Symptoms:** A user attempts to sign up but receives a `409 Conflict` error, even though they have never logged in before.
**Root Cause:** This occurs when a user's email was pre-provisioned via the enterprise SSO pipeline, but the local database hasn't fully synchronized with the identity provider. 
**Resolution:** Instruct the user to wait 5 minutes and try logging in directly via the SSO portal instead of the standard registration form. Do NOT attempt to manually delete the shadow record in the database.

## Error: Stripe Webhook Timeout (Code: WH_504)
**Symptoms:** Stripe dashboard reports failed webhook deliveries to our production endpoint.
**Root Cause:** The `invoice.payment_succeeded` webhook handler is taking longer than 3 seconds to process because it is synchronously generating a PDF receipt.
**Resolution:** This is a known technical debt issue. For now, manually trigger a retry in the Stripe dashboard. The long-term fix (moving PDF generation to an SQS background worker) is scheduled for Sprint 42.