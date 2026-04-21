# Partner: `chainlink`

Partner pack for Chainlink — price feeds, VRF, Automation, CCIP cross-chain messaging. Biases frontend + contract scaffolds toward the Chainlink SDK and Data Feeds addresses.

**Applies to**: frontend-static, react-vite-ts, nextjs-ts, fullstack-ts, api-service, evm-infra-ts, agent-service-ts, forge-contracts, hardhat-contracts

## First moves

- Read chainlink-config.json — contains pre-filled Price Feed addresses for Ethereum + Base. Add more chains as needed from https://docs.chain.link/data-feeds/price-feeds/addresses
- For price feeds: call the AggregatorV3Interface `latestRoundData()` on the aggregator address. Returns (roundId, answer, startedAt, updatedAt, answeredInRound). Check `updatedAt` is recent.
- For VRF v2.5: subscribe your contract at vrf.chain.link, fund with LINK, request randomness via `requestRandomWords()`. Response arrives via `fulfillRandomWords()` callback.
- For CCIP: use the Router addresses in chainlink-config.json. Messages are gas-paid in LINK or native on the source chain.

## Gotchas

- Price Feed decimals vary per pair (8 for most USD pairs, 18 for ETH-denominated). Always use `aggregator.decimals()` instead of assuming 8.
- VRF has a REQUEST pattern — randomness is NOT synchronous. Your callback is invoked 1-10 blocks later. Design UX around that gap.
- CCIP rate-limits per lane. Check https://docs.chain.link/ccip/supported-networks for current caps before designing high-throughput flows.
- Stale feed data: a feed may go stale in low-volume pairs. Add a stalenessThreshold (e.g. 1 hour) and revert on stale data.
