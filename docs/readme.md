# Backend System Documentation for Deutsche Aligners

## Overview

This document provides a comprehensive overview and technical documentation for the backend system of Deutsche Aligners, a platform designed to facilitate seamless order processing between lab and clinic. The system handles user management, order processing, notify delays and track payments.

## Getting Started

### Prerequisites

- Node.js 18: [Install Nodejs on Ubuntu](https://www.digitalocean.com/community/tutorials/how-to-install-node-js-on-ubuntu-22-04)
- NPM
- Redis: [Configure Redis on ubuntu](https://redis.io/docs/install/install-redis/install-redis-on-linux).
- Mongodb Atlas
- Code Editor (VS code)
- Git / Github

### Setup Instructions

1. Clone the repository: `git clone git@github.com:bluemandarin-official/deutsche-backend.git`
2. Navigate to the project directory: `cd deutsche-backend`
3. Copy .env.example to .env file and provide all the values for variables. (Details in deployement docs).
4. Install dependencies: `npm install`
5. *npm run watch* to start appliction.
6. Start the server: `npm run watch`
7. Access the application at `http://localhost:3000`

## Architecture

The backend is built on a 3-tier architecture, enabling scalability and ease of maintenance. It uses **Node.js** along with expressjs for the application logic, **MongoDB** for data storage with ORM **mongoose**, **RabbitMQ**, **NodeJs Events** for events.

## Codebase Overview

### Folder structure

- `src`: This is the main source code directory. It contains the application's source code, including routes, helpers, and database configurations.
  - `routes`: Contains the route handlers for the application. For example, [``src/routes/access/login.ts``] handles login operations.
  - `helpers`: Contains helper functions, middlewares and utilities used across the application.
  - `database`: Contains the database schema and common functions (repository).
  - `config`: Contains configuration files, such as the redis configuration.
- `build`: This directory is specified in `tsconfig.json` as the output directory for the compiled TypeScript files. It's ignored by Git as specified in `.gitignore`.
- `node_modules`: This directory contains third-party libraries installed via npm. It's also ignored by Git.
- `keys`: This directory contains key files such as SSH for the application. (Currently not using).
- `logs`: This directory is used for storing error logs output from winston.
- `deployment.md`: Instructions for deploying the application.
- `tsconfig.json`: configuration for the TypeScript compiler.
- `.gitignore`: Specifies files and directories that Git should ignore.
- `.env.test.example`: An example file showing how to set environment variables for testing.

### Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB
- **Messaging System**: BullMQ (redis)
- **External Services**: AWS SES for emails, currency becon for currency exchange.

## Deployment Workflow

Our deployment process utilizes three primary Git branches to manage the development and release lifecycle:

- **`main`**: This branch reflects the production state.
- **`preprod`**: This branch is used for QA testing before the production release.
- **`dev`**: This branch serves as the development stage where initial testing is performed.

## Workflow Steps

1. **Issue Assignment**:
    - For each new issue or ticket, create a feature branch from dev named after the ticket or issue ID.

2. **Development and Local Testing**:
    - Perform development and initial testing locally on your feature branch.

3. **Code Review and Pull Request**:
    - Once local testing is completed, create a pull request from your feature branch to the `dev` branch.
    - The code must be reviewed and approved by the team before it can be merged into `dev`.

4. **Staging Deployment**:
    - Upon approval and merging to the `dev` branch, changes will automatically be deployed to the staging server via GitHub Actions. This environment is used for initial stage validations.

5. **Pre-Production Testing**:
    - After thorough testing and validation in the staging environment, merge your changes from the `dev` branch to the `preprod` branch.
    - The `preprod` branch deployment is used for QA testing. This environment mimics the production environment.

6. **Production Release**:
    - Once QA testing is passed and the code is approved, the final step is to merge the `preprod` branch into the `main` branch.
    - Merging to `main` triggers a GitHub Actions CI/CD pipeline that automatically deploys the changes to the production environment.

## Continuous Integration and Continuous Deployment

- We use GitHub Actions for our CI/CD to automate testing and deployment. Each push to `dev`, `preprod`, and `main` triggers specific workflows configured in our GitHub Actions setup to ensure smooth transitions through environments and maintain stability in production.

## Statuses

orderstatuses inside deliveries: [
        {
            name: "DENTIST_APPROVED",
            description: "The order has been approved by the dentistadmin."
        },
        {
            name: "PRODUCTION_PENDING",
            description: "After picking up by the production manager."
        },
        {
            name: "DELIVERY_PENDING",
            description: "After Completing Production"
        },
        {
            name: "IN_SHIPMENT",
            description: "The order delivered by production manager"
        },
        {
            name: "DELIVERED",
            description: "The order marked recieved by production manager"
        }
    ]

Quotestatuses: [
        {
            name: "PENDING",
            description: "Initial stage of creation"
        },
        {
            name: "REWORK",
            description: "The quote sent to rework by dentist or dentistadmin."
        },
        {
            name: "PENDING_APPROVAL",
            description: "The quote is pending approval by labAdmin."
        },
        {
            name: "ADMIN_APPROVED",
            description: "The quote has been approved by labadmin."
        },
        {
            name: "ADMIN_CANCELED",
            description: "The labadmin has canceled the quote."
        },
        {
            name: "DENTIST_REVIEWED",
            description: "The quote has been reviewed by  dentist."
        },
        {
            name: "DENTIST_APPROVED",
            description: "The quote has been approved by  dentistAdmin."
        },
        {
            name: "DENTIST_CANCELED",
            description: "The dentist has canceled the quote."
        }
    ]