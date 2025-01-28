import React, { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, LAMPORTS_PER_SOL, Connection } from '@solana/web3.js';
import { SwapClient } from '../clients/swap_client';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, NATIVE_MINT } from '@solana/spl-token';

const PROGRAM_ID = new PublicKey('w3Z41mVWnu3k9HQZGBMMphBm4hgKZCsoTnFMr6shezk'); // Replace with your program ID

const NETWORK_TOKENS = {
    'mainnet-beta': {
        SOL: NATIVE_MINT.toBase58(),
        USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    },
    devnet: {
        SOL: NATIVE_MINT.toBase58(),
        USDC: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
    },
};

const TOKEN_METADATA = {
    [NATIVE_MINT.toBase58()]: {
        symbol: 'SOL',
        name: 'Wrapped SOL',
        decimals: 9,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    },
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    },
};

interface TokenBalance {
    mint: string;
    balance: number;
    symbol: string;
    name: string;
    decimals: number;
    logoURI?: string;
}

export const CreateSwap: React.FC = () => {
    const { connection } = useConnection();
    const walletContext = useWallet();
    const [userTokens, setUserTokens] = useState<TokenBalance[]>([]);
    const [selectedTokenA, setSelectedTokenA] = useState<TokenBalance | null>(null);
    const [tokenBType, setTokenBType] = useState<'SOL' | 'USDC'>('SOL');
    const [amountA, setAmountA] = useState('');
    const [priceB, setPriceB] = useState('');
    const [loading, setLoading] = useState(false);

    const network = connection.rpcEndpoint.includes('devnet') ? 'devnet' : 'mainnet-beta';

    const getTokenMint = (tokenType: 'SOL' | 'USDC') => {
        return new PublicKey(NETWORK_TOKENS[network][tokenType]);
    };

    const formatTokenAmount = (amount: number, decimals: number) => {
        return (amount / Math.pow(10, decimals)).toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: decimals,
        });
    };

    const fetchUserTokens = useCallback(async () => {
        if (!walletContext.publicKey) return;

        const tokenAccounts = await connection.getParsedProgramAccounts(TOKEN_PROGRAM_ID, {
            filters: [
                { dataSize: 165 },
                { memcmp: { offset: 32, bytes: walletContext.publicKey.toBase58() } },
            ],
        });

        const tokens = await Promise.all(
            tokenAccounts.map(async (account) => {
                if ('parsed' in account.account.data) {
                    const parsedData = account.account.data.parsed.info;
                    const mintAddress = parsedData.mint;
                    const balance = parsedData.tokenAmount.uiAmount;

                    const metadata = TOKEN_METADATA[mintAddress] || {
                        symbol: mintAddress.slice(0, 4),
                        name: `Token ${mintAddress.slice(0, 8)}...`,
                        decimals: parsedData.tokenAmount.decimals,
                        logoURI: '/default-token-icon.png',
                    };

                    return {
                        mint: mintAddress,
                        balance,
                        ...metadata,
                    } as TokenBalance;
                }
                return null;
            })
        );

        const filteredTokens = tokens.filter((token): token is TokenBalance => token !== null && token.balance > 0);
        setUserTokens(filteredTokens);
    }, [walletContext.publicKey, connection]);
    useEffect(() => {
        fetchUserTokens();
    }, [fetchUserTokens]);

    const handleAmountSelection = (percentage: number) => {
        if (!selectedTokenA) return;
        const amount = (selectedTokenA.balance * percentage) / 100;
        setAmountA(amount.toString());
    };

    // Create connection with commitment level
    const connectionWithCommitment = new Connection(connection.rpcEndpoint, 'confirmed');

    // Update the handleCreate function
    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!walletContext.publicKey || !selectedTokenA) return;

        setLoading(true);
        try {

            const client = new SwapClient(connectionWithCommitment, PROGRAM_ID, walletContext);
            const tokenBMint = getTokenMint(tokenBType);

            
            const decimals = selectedTokenA.decimals;
            const amountInSmallestUnit = Math.floor(Number(amountA) * Math.pow(10, decimals));
            const priceInSmallestUnit = Math.floor(Number(priceB) * Math.pow(10, tokenBType === 'SOL' ? 9 : 6));

            const signature = await client.createSwapPair(
                new PublicKey(selectedTokenA.mint),
                tokenBMint,
                amountInSmallestUnit,
                priceInSmallestUnit
            );


            console.log('View transaction on Solscan:', `https://solscan.io/tx/${signature}`);
            setSelectedTokenA(null);
            setAmountA('');
            setPriceB('');
            await fetchUserTokens();
        } catch (error) {

            console.error('Swap creation failed:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto p-4">
            <h2 className="text-2xl font-bold mb-4">Create Token Escrow</h2>
            {!walletContext.connected ? (
                <div className="text-center">
                    <p className="mb-4">Connect your wallet to create an escrow swap</p>
                    <WalletMultiButton />
                </div>
            ) : (
                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Select Token to Offer</label>
                        <select
                            className="w-full p-2 border rounded"
                            onChange={(e) =>
                                setSelectedTokenA(userTokens.find((t) => t.mint === e.target.value) || null)
                            }
                            value={selectedTokenA?.mint || ''}
                        >
                            <option value="">Select a token</option>
                            {userTokens.map((token) => (
                                <option key={token.mint} value={token.mint}>
                                    {token.name} ({token.symbol}) - {formatTokenAmount(token.balance, token.decimals)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedTokenA && (
                        <div>
                            <label className="block text-sm font-medium mb-1">Amount to Offer</label>
                            <div className="flex gap-2 mb-2">
                                <button type="button" onClick={() => handleAmountSelection(25)} className="bg-gray-200 px-2 py-1 rounded">
                                    25%
                                </button>
                                <button type="button" onClick={() => handleAmountSelection(50)} className="bg-gray-200 px-2 py-1 rounded">
                                    50%
                                </button>
                                <button type="button" onClick={() => handleAmountSelection(100)} className="bg-gray-200 px-2 py-1 rounded">
                                    Max
                                </button>
                            </div>
                            <input
                                type="number"
                                value={amountA}
                                onChange={(e) => setAmountA(e.target.value)}
                                max={selectedTokenA.balance}
                                className="w-full p-2 border rounded"
                                required
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium mb-1">Token You Want</label>
                        <select
                            className="w-full p-2 border rounded"
                            value={tokenBType}
                            onChange={(e) => setTokenBType(e.target.value as 'SOL' | 'USDC')}
                        >
                            <option value="SOL">SOL</option>
                            <option value="USDC">USDC</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Price You Want</label>
                        <input
                            type="number"
                            placeholder={`Amount in ${tokenBType}`}
                            value={priceB}
                            onChange={(e) => setPriceB(e.target.value)}
                            className="w-full p-2 border rounded"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !selectedTokenA}
                        className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
                    >
                        {loading ? 'Creating Escrow...' : 'Create Escrow Swap'}
                    </button>
                </form>
            )}
        </div>
    );
};