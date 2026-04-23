import React, { useState, useEffect } from 'react';
import { useWallet } from '@binance-chain/bsc-use-wallet';
import { Link } from 'react-router-dom';
import { MintButton } from './MintButton';
import { MintedCountDisplay } from './MintedCountDisplay';
import { OpenSeaLink } from './OpenSeaLink';

const MintPage = () => {
  const [mintedCount, setMintedCount] = useState(0);
  const wallet = useWallet();
  const contractAddress = process.env.CONTRACT_ADDRESS;

  useEffect(() => {
    const fetchMintedCount = async () => {
      // fetch minted count from contract
      const response = await fetch(`https://api.${contractAddress}.com/minted-count`);
      const data = await response.json();
      setMintedCount(data.count);
    };
    fetchMintedCount();
  }, [contractAddress]);

  const handleMint = async () => {
    // mint NFT logic
  };

  return (
    <div>
      <h1>Mint Page</h1>
      <MintButton onMint={handleMint} />
      <MintedCountDisplay count={mintedCount} />
      <OpenSeaLink contractAddress={contractAddress} />
      {wallet.account && <p>Connected to {wallet.account}</p>}
    </div>
  );
};

export default MintPage;