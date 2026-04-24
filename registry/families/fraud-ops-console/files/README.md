# fraud-ops-console starter
## Quickstart
To get started with the fraud-ops-console starter, run the following commands:
```bash
npm install
npm run dev
```
or
```bash
pnpm install
pnpm run dev
```
This will install the required dependencies and start the development server.

## Environment
The following environment variables are used in the project:
* VITE_PORT: The port number to use for the development server. Default value is 3000. Obtain the value from your system administrator or use the default value.
* VITE_HOST: The host IP address to use for the development server. Default value is 127.0.0.1. Obtain the value from your system administrator or use the default value.
* FRAUD_API_KEY: The API key for the fraud detection service. Obtain the value from the fraud detection service provider.
* RISK_MANAGEMENT_API_KEY: The API key for the risk management service. Obtain the value from the risk management service provider.
* COMPLIANCE_API_KEY: The API key for the compliance service. Obtain the value from the compliance service provider.

## Architecture
The project is divided into two main directories: `src/main` and `src/App`. 
* `src/main` contains the main application logic, including the fraud detection, risk management, and compliance services.
* `src/App` contains the frontend code, including the React components and the Vite configuration.
The project uses the following dependencies:
* `react`: The React library for building user interfaces.
* `vite`: The Vite development server and build tool.
* `typescript`: The TypeScript compiler and type checker.

## Extension Points
The following files are likely to be edited when building on this starter:
* `src/main/fraudDetection.ts`: This file contains the fraud detection logic and can be modified to implement custom fraud detection rules.
* `src/main/riskManagement.ts`: This file contains the risk management logic and can be modified to implement custom risk management rules.
* `src/App/components/FraudConsole.tsx`: This file contains the React component for the fraud console and can be modified to implement custom UI components. 

To address the missing script issue, add a 'dev' script to the package.json file:
```json
"scripts": {
  "dev": "vite"
}
```