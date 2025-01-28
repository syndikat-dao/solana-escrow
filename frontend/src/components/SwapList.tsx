import React, { useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { SwapClient, SwapPair } from '../clients/swap_client';
import { PublicKey } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('w3Z41mVWnu3k9HQZGBMMphBm4hgKZCsoTnFMr6shezk');

export const SwapList: React.FC = () => {
    const [swapPairs, setSwapPairs] = useState<SwapPair[]>([]);
    const { connection } = useConnection();
    const walletContext = useWallet();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadSwapPairs = async () => {
            if (!walletContext.connected) return;
            
            try {
                const client = new SwapClient(connection, PROGRAM_ID, walletContext);
                const pairs = await client.listSwapPairs();
                setSwapPairs(pairs);
            } catch (error) {
                console.error('Error loading swap pairs:', error);
            } finally {
                setLoading(false);
            }
        };

        loadSwapPairs();
    }, [connection, walletContext]);

    const handleSwap = async (swapPairId: string) => {
        if (!walletContext.connected) return;

        try {
            const client = new SwapClient(connection, PROGRAM_ID, walletContext);
            await client.executeSwap(new PublicKey(swapPairId));
            const pairs = await client.listSwapPairs();
            setSwapPairs(pairs);
        } catch (error) {
            console.error('Swap execution failed:', error);
        }
    };

    if (loading) return <div>Loading swap pairs...</div>;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {swapPairs.map(pair => (
                <div key={pair.id} className="border rounded-lg p-4 shadow">
                    <div className="mb-2">Token A: {pair.tokenAMint.toString()}</div>
                    <div className="mb-2">Token B: {pair.tokenBMint.toString()}</div>
                    <div className="mb-2">Amount: {pair.amountA}</div>
                    <div className="mb-2">Price: {pair.priceB}</div>
                    {walletContext.publicKey && 
                     !pair.creatorPubkey.equals(walletContext.publicKey) && 
                     pair.isActive && (
                        <button
                            onClick={() => handleSwap(pair.id)}
                            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                        >
                            Swap
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
};
