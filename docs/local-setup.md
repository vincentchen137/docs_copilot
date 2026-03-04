# Local Environment Setup Guide

Welcome to the core API repository. To run this project locally, you need to ensure you have Node.js v20.x installed. We use `pnpm` for package management, do not use `npm` or `yarn` as it will break the lockfile.

## Environment Variables
Before starting the server, you must configure your `.env.local` file. Copy the `.env.example` file and reach out to the DevOps team lead to get the development secrets.

Required variables for the payment gateway:
- `STRIPE_TEST_KEY`: Find this in the 1Password shared vault under "Engineering Sandbox".
- `STRIPE_WEBHOOK_SECRET`: Use the default local testing string: `whsec_local_test_9982`

## Running the App
Once your variables are set, run the database migrations first:
`pnpm run db:migrate`

Then start the development server:
`pnpm run dev`

The API will be available at `http://localhost:8080`.