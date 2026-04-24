# zk-mixer-ui Starter

## Quickstart
To get started with the zk-mixer-ui starter, run the following commands:
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
* `VITE_ETHEREUM_L1_RPC_URL`: The URL of the Ethereum L1 RPC endpoint. Obtain the value from your Ethereum L1 provider.
* `VITE_ETHEREUM_L1_CHAIN_ID`: The chain ID of the Ethereum L1 network. Obtain the value from your Ethereum L1 provider.
* `VITE_ZERO_KNOWLEDGE_PROVER_URL`: The URL of the zero-knowledge prover service. Obtain the value from your zero-knowledge prover provider.
* `VITE_MIXER_CONTRACT_ADDRESS`: The address of the mixer contract on the Ethereum L1 network. Obtain the value from your Ethereum L1 provider.

## Architecture
The project consists of two main directories: `src/main` and `src/App`. `src/main` contains the main application logic, while `src/App` contains the React components.
The project uses the following dependencies:
* `ethers.js`: For interacting with the Ethereum L1 network.
* `zero-knowledge-prover`: For generating zero-knowledge proofs.
* `vite`: For building and serving the application.

## Extension Points
The following files are likely to be edited when building on this starter:
* `src/main/index.ts`: This file contains the main application logic and is a good starting point for customizing the application.
* `src/App/components/Mixer.tsx`: This file contains the React component for the mixer and can be customized to fit specific use cases.
* `src/App/components/ZeroKnowledgeProver.tsx`: This file contains the React component for the zero-knowledge prover and can be customized to fit specific use cases.