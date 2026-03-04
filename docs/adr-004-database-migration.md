# ADR 004: Migration from DynamoDB to PostgreSQL

**Date:** October 15, 2025
**Status:** Accepted and Implemented

## Context
Our initial MVP utilized AWS DynamoDB for the core user data layer. This allowed for rapid iteration and schemaless development. However, as the platform has grown, the product team requested a new admin reporting dashboard that requires complex filtering, sorting, and aggregations across multiple entities (Users, Orders, and Organizations).

Executing these relational queries on DynamoDB proved to be extremely slow and cost-prohibitive due to the heavy read-capacity units (RCUs) required for table scans.

## Decision
We decided to migrate the core transactional database from DynamoDB to a managed AWS RDS PostgreSQL instance. 

## Consequences
- **Positive:** We can now execute complex JOIN queries in milliseconds, enabling real-time analytics for the admin dashboard.
- **Negative:** We had to write a heavy, one-time data migration script, and developers must now strictly manage database schema changes using Prisma migrations.